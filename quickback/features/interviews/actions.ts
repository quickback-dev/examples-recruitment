/**
 * Interview state transitions + score capture.
 *
 * Two record-bound actions that exercise the auth shapes the parent
 * feature opted into:
 *
 *  - `complete`   — flips status `scheduled → completed` AND inserts a
 *    row into the internal `interview_scores` table. Demonstrates a
 *    handler writing to a sibling Drizzle-interop table via the scoped
 *    `db` (the org-id stamp on inserts and the org-scoped firewall on
 *    reads come for free because the parent is org-scoped).
 *  - `reschedule` — moves the interview to a new datetime. State stays
 *    `scheduled`; only `scheduledAt` / `durationMin` change.
 *
 * Both actions inherit the parent feature's owner-only access rule for
 * non-admins (see `interviews.ts` — `access.record: { scheduledBy:
 * { equals: '$ctx.userId' } }`). Org admins / owners and Better Auth
 * platform admins (`userRole: 'admin'`) can act on any interview in
 * the tenant; everyone else can only act on interviews they
 * scheduled.
 *
 * Standalone read action — `scoreSummary` — demonstrates the
 * `standalone: true` shape against an internal Drizzle table. Returns
 * the per-interview average rating across all scorers in the active
 * org.
 *
 * Why no inline `execute:` bodies: the `feature()` source parser
 * strips arrow-function bodies to placeholders during compile (only
 * the `handler:` path survives a recompile cleanly). Real
 * implementations live in `./handlers/<name>.ts`.
 */
import { z } from "zod";
import { defineActions } from "@quickback/compiler";
import interviews from "./interviews";

export default defineActions(interviews, {
  complete: {
    description: "Finalize an interview with a score and recommendation.",
    input: z.object({
      rating: z.number().int().min(1).max(5),
      recommendation: z.enum(["strong-no", "no", "neutral", "yes", "strong-yes"]),
      comments: z.string().max(2000).optional(),
    }),
    // Same OR shape as the parent feature's read access — admins of
    // either tier can complete any interview, owners can complete
    // their own. The runtime evaluates `record:` post-fetch, so a
    // member who tries to complete someone else's interview gets a
    // post-record 403 (not a 404 — the firewall already admitted the
    // row).
    access: {
      or: [
        { roles: ["admin", "owner", "recruiter"] },
        { userRole: ["admin"] },
        {
          roles: ["member", "interviewer"],
          record: { scheduledBy: { equals: "$ctx.userId" } },
        },
      ],
    },
    transition: {
      field: "status",
      to: "completed",
      fromTo: { scheduled: ["completed"] },
    },
    handler: "./handlers/complete",
  },

  reschedule: {
    description: "Move an interview to a new datetime.",
    input: z.object({
      scheduledAt: z.string().datetime(),
      // Optional duration override — falls through to the existing
      // value if omitted.
      durationMin: z.number().int().min(5).max(480).optional(),
    }),
    access: {
      or: [
        { roles: ["admin", "owner", "recruiter"] },
        { userRole: ["admin"] },
        {
          roles: ["member", "interviewer"],
          record: { scheduledBy: { equals: "$ctx.userId" } },
        },
      ],
    },
    // `transition` block intentionally omitted — reschedule doesn't
    // change `status`, only timing. The handler still uses
    // `whereRecord` (not `whereTransition`) since there's no
    // state-machine guard to bake in.
    handler: "./handlers/reschedule",
  },

  /**
   * Standalone aggregate — `GET /api/v1/interviews/score-summary`.
   *
   * Reads from the internal `interview_scores` Drizzle table directly
   * via the scoped `db`. Org admins / owners only (the parent's
   * firewall handles tenant isolation; the role gate adds the
   * "non-members can't enumerate scores" tier).
   */
  scoreSummary: {
    description: "Aggregate average rating per interview across the org.",
    standalone: true,
    path: "/interviews/score-summary",
    method: "GET",
    input: z.object({}),
    access: { roles: ["owner", "admin"] },
    handler: "./handlers/score-summary",
  },
});
