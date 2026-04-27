/**
 * ATS imports — staging table for upstream feeds (Greenhouse, Lever,
 * Workday). Demonstrates the `guards: false` opt-out, which the rest
 * of the example doesn't use.
 *
 *  - **`guards: false`** — clients can write *any* user-defined
 *    field on POST/PATCH. The compiler still rejects writes to the
 *    system-managed allowlist (`id`, `organizationId`, `createdAt`,
 *    `createdBy`, `modifiedAt`, `modifiedBy`, `deletedAt`,
 *    `deletedBy`), but the per-resource `createable` /
 *    `updatable` allowlists go away. Useful when a trusted internal
 *    feed is the only writer and the schema's column shape *is* the
 *    allowlist.
 *  - **Composite uniqueness on (sourceSystem, externalId)** — the
 *    natural idempotency key for an external feed. The `upsertBatch`
 *    action below uses ON CONFLICT against this index to make
 *    repeated POSTs of the same payload safe.
 *  - **Status as a normal field**, not transition-protected. Imports
 *    flip status freely as the worker processes them; the demo
 *    skips the state-machine guard so `guards: false` reads cleanly
 *    against a normal mutable resource.
 *
 * Tradeoff: opting out of guards means malformed but-schema-valid
 * payloads can write anything in the column set. Pair with a strict
 * Zod input schema in any wrapper actions and a write-side gate
 * (`crud.create.access`) that's tight enough to keep this from
 * being a cross-tenant ingestion vector.
 */
import { feature, q } from "@quickback/compiler";

export default feature("atsImports", {
  columns: {
    id:           q.id(),
    externalId:   q.text({ maxLength: 200 }).required().filterable("eq"),
    sourceSystem: q.enum(["greenhouse", "lever", "workday", "other"]).required().filterable("eq"),
    // Raw upstream payload — we don't try to parse on ingest. The
    // worker that consumes `pending` rows is responsible for
    // mapping into `candidates` / `applications`.
    payload:      q.text({ maxLength: 16000 }).required(),
    status:       q.enum(["pending", "processed", "failed"]).default("pending").required().index(),
    error:        q.text({ maxLength: 4000 }).optional(),
    organizationId: q.scope("organization"),
  },
  unique: [{ columns: ["organizationId", "sourceSystem", "externalId"] }],
  // Disables the per-field createable / updatable / immutable
  // allowlist. System-managed fields stay protected — see the
  // top-of-file comment for the always-protected set.
  guards: false,
  read: {
    access: { roles: ["admin", "owner"] },
  },
  crud: {
    create: { access: { roles: ["admin", "owner"] } },
    update: { access: { roles: ["admin", "owner"] } },
    delete: { access: { roles: ["owner"] }, mode: "soft" },
  },
  displayColumn: "externalId",
  defaultSort: { field: "createdAt", order: "desc" },
  inputHints: {
    payload:      "textarea",
    sourceSystem: "select",
    status:       "select",
  },
});
