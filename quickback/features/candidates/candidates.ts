/**
 * Candidates — the people being considered for jobs.
 *
 * Exercises:
 *  - PII masking: email/phone masked for non-recruiter roles
 *  - Views: `pipeline` (lean columns for list UI) vs `full` (restricted)
 *  - Mixed `.required()` / `.optional()` chains
 *  - Org-scoped firewall with softDelete
 *  - Authored with `feature()` single-export sugar
 */
import { feature, q } from "@quickback/compiler";

export default feature("candidates", {
  columns: {
    id:             q.id(),
    name:           q.text().required(),
    email:          q.text().required(),
    phone:          q.text().optional(),
    resumeUrl:      q.text().optional(),
    source:         q.enum(["linkedin", "referral", "careers-page", "other"]).default("other").required(),
    internalNotes:  q.text().optional(),
    organizationId: q.text().required(),
  },
  firewall: { organization: {}, softDelete: {} },
  guards: {
    createable: ["name", "email", "phone", "resumeUrl", "source", "internalNotes"],
    updatable:  ["name", "email", "phone", "resumeUrl", "source", "internalNotes"],
  },
  masking: {
    email:         { type: "email", show: { roles: ["owner", "admin"] } },
    phone:         { type: "phone", show: { roles: ["owner", "admin"] } },
    internalNotes: { type: "redact", show: { roles: ["owner", "admin"] } },
  },
  crud: {
    list:   { access: { roles: ["owner", "admin", "member"] } },
    get:    { access: { roles: ["owner", "admin", "member"] } },
    create: { access: { roles: ["owner", "admin"] } },
    update: { access: { roles: ["owner", "admin"] } },
    delete: { access: { roles: ["owner"] }, mode: "soft" },
  },
  views: {
    pipeline: {
      fields: ["id", "name", "source"],
      access: { roles: ["owner", "admin", "member"] },
    },
    full: {
      fields: ["id", "name", "email", "phone", "resumeUrl", "source", "internalNotes"],
      access: { roles: ["owner", "admin"] },
    },
  },
});
