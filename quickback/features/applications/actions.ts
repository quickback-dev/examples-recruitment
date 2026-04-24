/**
 * Application status transitions — the only way to mutate `status` on an
 * applications record. The resource's `guards.protected.status` lists these
 * action names, so direct PATCH attempts on `status` are rejected.
 *
 * Each action uses `access.record` to gate on the *current* status — you
 * can't advance an already-rejected application, etc. The guard layer
 * handles the role check; the record-condition handles the state check.
 *
 * Handlers live in `./handlers/<name>.ts` and are wired via `handler:`.
 * The compiler preserves handler-file imports across recompiles (inline
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
      notes: z.string().optional(),
    }),
    access: {
      roles: ["owner", "admin"],
      // Can only advance from an earlier open state. `hired`, `rejected`, and
      // `withdrawn` are terminal — use dedicated actions if reopening.
      record: { status: { in: ["applied", "screening", "interview"] } },
    },
    handler: "./handlers/advance",
  },

  hire: {
    description: "Finalize an offer — the candidate accepted.",
    input: z.object({}),
    access: {
      roles: ["owner"],
      record: { status: { equals: "offer" } },
    },
    handler: "./handlers/hire",
  },

  reject: {
    description: "Reject an application with an optional reason.",
    input: z.object({
      reason: z.string().optional(),
    }),
    access: {
      roles: ["owner", "admin"],
      // Cannot reject someone already hired or who withdrew.
      record: { status: { notIn: ["hired", "withdrawn"] } },
    },
    handler: "./handlers/reject",
  },

  withdraw: {
    description: "Candidate withdrew their application.",
    input: z.object({}),
    access: {
      roles: ["owner", "admin", "member"],
      record: { status: { notIn: ["hired", "rejected", "withdrawn"] } },
    },
    handler: "./handlers/withdraw",
  },
});
