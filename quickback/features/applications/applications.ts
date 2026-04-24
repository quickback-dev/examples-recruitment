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
    appliedAt:      q.timestamp().optional(),
    notes:          q.text().optional(),
    organizationId: q.text().required(),
  },
  firewall: { organization: {}, softDelete: {} },
  guards: {
    createable: ["jobId", "candidateId", "notes", "appliedAt"],
    updatable:  ["notes"],
    immutable:  ["jobId", "candidateId"],
    protected:  {
      // `status` can only be mutated through these actions, not via PATCH.
      status: ["advance", "reject", "hire", "withdraw"],
    },
  },
  crud: {
    list:   { access: { roles: ["owner", "admin", "member"] } },
    get:    { access: { roles: ["owner", "admin", "member"] } },
    create: { access: { roles: ["owner", "admin", "member"] } },
    update: { access: { roles: ["owner", "admin"] } },
    delete: { access: { roles: ["owner"] }, mode: "soft" },
  },
  references: {
    // Explicit FK-label mappings — would otherwise be inferred by "Id"-stripped convention.
    jobId: "jobs",
    candidateId: "candidates",
  },
  views: {
    pipeline: {
      fields: ["id", "jobId", "candidateId", "status", "appliedAt"],
      access: { roles: ["owner", "admin", "member"] },
    },
  },
});
