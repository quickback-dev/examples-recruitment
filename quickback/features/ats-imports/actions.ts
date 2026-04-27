/**
 * Bulk-upsert action for ATS feeds.
 *
 * The CRUD POST creates one row at a time and 409s on the unique
 * `(organizationId, sourceSystem, externalId)` index — fine for a
 * webhook driven 1:1, but a full Greenhouse re-sync hands you 5k
 * rows and a 1:1 retry loop is wasteful. This action takes a batch
 * of `{ externalId, payload }` pairs and INSERT … ON CONFLICT DO
 * UPDATE's them in one round-trip.
 *
 * Demonstrates: `standalone: true` against a parent resource (so the
 * action lives at a non-`:id` path but still has the `atsImports`
 * table in scope), idempotent SQLite UPSERT semantics, batched DB
 * writes inside a single handler.
 */
import { z } from "zod";
import { defineActions } from "@quickback/compiler";
import atsImports from "./ats-imports";

export default defineActions(atsImports, {
  upsertBatch: {
    description: "Idempotent batch upsert from an ATS feed.",
    standalone: true,
    path: "/ats-imports/upsert-batch",
    method: "POST",
    input: z.object({
      sourceSystem: z.enum(["greenhouse", "lever", "workday", "other"]),
      records: z
        .array(
          z.object({
            externalId: z.string().min(1).max(200),
            payload: z.string().max(16000),
          }),
        )
        .min(1)
        .max(100),
    }),
    access: { roles: ["admin", "owner"] },
    handler: "./handlers/upsert-batch",
  },
});
