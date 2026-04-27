/**
 * Applications — the association between a candidate and a job.
 *
 * Exercises:
 *  - Foreign keys: `jobId → jobs.id`, `candidateId → candidates.id`
 *  - Status column that's *protected* — only specific actions can mutate it
 *  - `references` mapping so the CMS resolves FK labels in list/get
 *  - Multi-scope WHERE: firewall.organization + softDelete
 *  - Authored with `feature()` single-export sugar
 *
 * Status lifecycle — `applied → screening → interview → offer → hired`, or
 * any state → `rejected` / `withdrawn`. Transitions are enforced by the
 * actions in `actions.ts`; clients can't set `status` directly via PATCH.
 */
import { feature, q } from "@quickback/compiler";
import jobs from "../jobs/jobs";
import candidates from "../candidates/candidates";

export default feature("applications", {
  columns: {
    id:             q.id(),
    jobId:          q.text().required().references(() => jobs.id, { onDelete: "cascade" }),
    candidateId:    q.text().required().references(() => candidates.id, { onDelete: "cascade" }),
    status: q
      .enum(["applied", "screening", "interview", "offer", "hired", "rejected", "withdrawn"])
      .default("applied")
      .required()
      .index(),
    // `appliedAt` is server-stamped on INSERT via `.defaultNow()` and is not
    // in the createable allowlist below, so clients can't backdate it. The
    // SQL default lowers to strftime() on SQLite / `now()` on Postgres.
    // Stays `.optional()` (column is NULL-able) only so adding the default
    // to an existing DB doesn't require a NOT-NULL backfill of historical
    // rows — new rows always populate via the default.
    appliedAt:      q.timestamp().defaultNow().optional(),
    notes:          q.text({ maxLength: 4000 }).optional(),
    organizationId: q.scope("organization"),
  },
  // Composite uniqueness — a candidate can only have one application per job
  // per org. Without this, repeated POSTs silently create duplicate rows.
  unique: [{ columns: ["jobId", "candidateId"] }],
  guards: {
    createable: ["jobId", "candidateId", "notes"],
    updatable:  ["notes"],
    immutable:  ["jobId", "candidateId"],
    protected:  {
      // `status` can only be mutated through these actions, not via PATCH.
      status: ["advance", "reject", "hire", "withdraw"],
    },
  },
  read: {
    access: { roles: ["owner", "admin", "member"] },
    views: {
      pipeline: {
        fields: ["id", "jobId", "candidateId", "status", "appliedAt"],
        access: { roles: ["owner", "admin", "member"] },
      },
    },
  },
  crud: {
    create: { access: { roles: ["owner", "admin", "member"] } },
    update: { access: { roles: ["owner", "admin"] } },
    delete: { access: { roles: ["owner"] }, mode: "soft" },
  },
  references: {
    // Explicit FK-label mappings — would otherwise be inferred by "Id"-stripped convention.
    jobId: "jobs",
    candidateId: "candidates",
  },
  // CMS metadata. `defaultSort` lands in the schema registry the CMS
  // consumes; `inputHints` overrides per-column form rendering. Status
  // is read-only here because PATCH is blocked by `guards.protected` —
  // the CMS will surface that as a non-editable field.
  defaultSort: { field: "appliedAt", order: "desc" },
  inputHints: {
    status: "select",
    notes:  "textarea",
    jobId:        "lookup",
    candidateId:  "lookup",
    appliedAt:    "datetime",
  },
});
