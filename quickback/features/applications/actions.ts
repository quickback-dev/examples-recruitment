/**
 * Application status transitions — the only way to mutate `status` on an
 * applications record. The resource's `guards.protected.status` lists these
 * action names, so direct PATCH attempts on `status` are rejected.
 *
 * Each action declares a `transition` policy that compiles into a runtime
 * state-machine guard in the generated route. The guard checks both the
 * current value of `status` *and* the target the action is about to write,
 * so invalid jumps (`applied → offer`) and regressions (`interview → screening`)
 * fail with **409 ACCESS_ACTION_NOT_ALLOWED_FOR_STATE** before the handler
 * runs. Role failures stay **403 ACCESS_ROLE_REQUIRED** — the two are split
 * so callers can tell "wrong role" from "wrong state".
 *
 * Handlers live in `./handlers/<name>.ts` and are wired via `handler:`. The
 * compiler preserves handler-file imports across recompiles (inline
 * `execute: async (...)` bodies are stripped to placeholders in the
 * generated `actions.ts` — only the `handler:` path survives).
 */
import { z } from "zod";
import { defineActions } from "@quickback/compiler";
import applications from "./applications";

export default defineActions(applications, {
  advance: {
    description: "Move an application forward in the pipeline.",
    input: z.object({
      nextStatus: z.enum(["screening", "interview", "offer"]),
      notes: z.string().max(2000).optional(),
    }),
    access: { roles: ["owner", "admin"] },
    transition: {
      field: "status",
      via: "nextStatus",
      fromTo: {
        applied:   ["screening"],
        screening: ["interview"],
        interview: ["offer"],
      },
    },
    handler: "./handlers/advance",
  },

  hire: {
    description: "Finalize an offer — the candidate accepted.",
    input: z.object({}),
    access: { roles: ["owner"] },
    transition: {
      field: "status",
      to: "hired",
      fromTo: { offer: ["hired"] },
    },
    handler: "./handlers/hire",
  },

  reject: {
    description: "Reject an application with an optional reason.",
    input: z.object({
      // Bounded — reject's handler appends to existing notes, so unbounded
      // reason text compounds across rejections.
      reason: z.string().max(500).optional(),
    }),
    access: { roles: ["owner", "admin"] },
    transition: {
      field: "status",
      to: "rejected",
      fromTo: {
        applied:   ["rejected"],
        screening: ["rejected"],
        interview: ["rejected"],
        offer:     ["rejected"],
      },
    },
    handler: "./handlers/reject",
  },

  withdraw: {
    description: "Candidate withdrew their application.",
    input: z.object({}),
    // Tightened from `member` — withdraw is a state mutation that should be a
    // hiring-team decision, not something any org member can fire on any
    // candidate's application. (Members can still *read* applications via
    // read.access.)
    access: { roles: ["owner", "admin"] },
    transition: {
      field: "status",
      to: "withdrawn",
      fromTo: {
        applied:   ["withdrawn"],
        screening: ["withdrawn"],
        interview: ["withdrawn"],
        offer:     ["withdrawn"],
      },
    },
    handler: "./handlers/withdraw",
  },

  /**
   * Standalone action — exercises the no-record route generator and the
   * empty-input-schema (`Record<string, never>`) path. Returns a count of
   * applications grouped by status for the active org's pipeline.
   *
   * Standalone actions don't bind to `:id` and don't receive `record` in the
   * handler params. The transition DSL doesn't apply here.
   */
  stats: {
    description: "Count applications by status across the org's pipeline.",
    standalone: true,
    path: "/applications/stats",
    method: "GET",
    input: z.object({}),
    access: { roles: ["owner", "admin", "member"] },
    handler: "./handlers/stats",
  },
});
