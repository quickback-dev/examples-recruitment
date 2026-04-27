/**
 * Interviews — scheduled meetings between candidates and the hiring team.
 *
 * Exercises everything the existing 3 features don't:
 *
 *  - Two scope columns: `q.scope("organization")` AND `q.scope("owner")`.
 *    With two scopes, auto-derivation refuses ("which one isolates?") and
 *    the user must declare `firewall: [...]` explicitly.
 *  - Explicit predicate-array `firewall` form. Demonstrates that org-scope
 *    is the tenant boundary and the owner column rides as a *systemManaged*
 *    auto-populated field (so clients can't backdate ownership) while
 *    per-row owner gating happens at the access layer, not the firewall.
 *  - `firewallErrorMode: "hide"` — opaque 404 instead of the default 403
 *    for cross-tenant probes. Used here because interviewer notes are
 *    sensitive enough that we don't even want to leak "the row exists".
 *  - `access.or[]` combinator: any of `{ roles: ['admin'] }` /
 *    `{ userRole: ['admin'] }` / `{ roles: [...], record: { … } }`
 *    satisfies the gate. Three different ways to grant access.
 *  - `access.record` field-condition with `$ctx.userId` interpolation —
 *    the static-DSL equivalent of "only the owner can do this," authored
 *    declaratively so the access pre-record check still admits role-only
 *    callers and the per-row filter fires post-fetch.
 *  - `userRole: ["admin"]` — Better Auth platform-admin tier (distinct
 *    from org `roles: ["admin"]`). Read more at
 *    `marketing/docs/content/docs/compiler/definitions/access.mdx`.
 *
 * On the deliberately-NOT-demonstrated side: function-form access
 * (`access: async (ctx, record) => …`). The runtime supports it (see
 * `runtime-templates/runtime-helpers.ts:evaluateAccess`), but the
 * `feature()` source parser doesn't extract arrow functions, so it's
 * only authorable via paths that bypass static parsing. For the q-DSL
 * the static `access.record: { …: { equals: '$ctx.userId' } }` form is
 * the canonical "owner-only" expression, and that's what's used below.
 */
import { feature, q } from "@quickback/compiler";
import applications from "../applications/applications";

export default feature("interviews", {
  columns: {
    id:             q.id(),
    applicationId:  q.text().required().references(() => applications.id, { onDelete: "cascade" }),
    // Owner column — q.scope("owner") makes it systemManaged (clients
    // cannot submit `scheduledBy` on POST/PATCH) AND auto-populated from
    // ctx.userId on create. Whoever creates the interview owns it.
    scheduledBy:    q.scope("owner"),
    organizationId: q.scope("organization"),
    scheduledAt:    q.timestamp().required(),
    durationMin:    q.int().default(30).required(),
    location:       q.text({ maxLength: 200 }).optional(),
    status:         q.enum(["scheduled", "completed", "no-show", "cancelled"]).default("scheduled").required().index(),
    privateNotes:   q.text({ maxLength: 4000 }).optional(),
  },

  // Explicit firewall — required when two scope columns are present.
  // We tenant-scope by org only (so admins/owners see *everyone's*
  // interviews in their tenant). Per-row owner gating happens at the
  // `access.record` layer below — a layered approach that keeps the
  // firewall a coarse tenant boundary and lets the access policy
  // express "members see only their own."
  firewall: [
    { field: "organizationId", equals: "ctx.activeOrgId" },
    { field: "deletedAt",      isNull: true },
  ],
  // Cross-tenant probes return 404, not 403. Trades a tiny bit of debugging
  // signal for callers ("you used a wrong id" indistinguishable from "wrong
  // org") in exchange for not confirming row existence to attackers.
  firewallErrorMode: "hide",

  guards: {
    createable: ["applicationId", "scheduledAt", "durationMin", "location", "privateNotes"],
    updatable:  ["scheduledAt", "durationMin", "location", "privateNotes"],
    immutable:  ["applicationId"],
    protected:  {
      // status mutations are gated to the action route — direct PATCH
      // attempts on `status` are 400.
      status: ["complete", "reschedule", "cancel"],
    },
  },

  read: {
    access: {
      // OR — any of these grants read access:
      or: [
        // Org admins / owners / recruiters see every interview in
        // their tenant. `recruiter` is a custom role declared in
        // `quickback.config.ts` → `auth.roleHierarchy`.
        { roles: ["admin", "owner", "recruiter"] },
        // Better Auth platform admins (user.role === 'admin') —
        // separate tier, distinct from org admin. Use for support
        // staff who need cross-tenant read access without joining
        // every org as a member.
        { userRole: ["admin"] },
        // Members AND interviewers see ONLY interviews they scheduled.
        // The `record` condition is evaluated post-fetch, so the LIST
        // endpoint runs the org-firewall query, fans out to every row,
        // and filters out rows where `scheduledBy !== $ctx.userId`.
        // `interviewer` is the lowest tier — they only ever see their
        // own conducted interviews; `member` is included because the
        // Better Auth default-org-role is also semantically "no special
        // privileges in this tenant."
        {
          roles: ["member", "interviewer"],
          record: { scheduledBy: { equals: "$ctx.userId" } },
        },
      ],
    },
  },

  crud: {
    // Anyone authenticated in the org (including bare interviewers)
    // can schedule an interview — they then own it. `member+`
    // expands to [member, recruiter, admin, owner]; we OR
    // `interviewer` in explicitly so the lowest tier can also book.
    create: { access: { roles: ["interviewer", "member+"] } },
    update: {
      access: {
        or: [
          { roles: ["admin", "owner", "recruiter"] },
          { userRole: ["admin"] },
          // Owner-only update for everyone else: same record-condition
          // shape as read, applied to the canonical UPDATE.
          {
            roles: ["member", "interviewer"],
            record: { scheduledBy: { equals: "$ctx.userId" } },
          },
        ],
      },
    },
    delete: { access: { roles: ["owner"] }, mode: "soft" },
  },

  displayColumn: "scheduledAt",
  defaultSort: { field: "scheduledAt", order: "asc" },
  inputHints: {
    scheduledAt:   "datetime",
    status:        "select",
    location:      "select",
    privateNotes:  "textarea",
    applicationId: "lookup",
  },
});
