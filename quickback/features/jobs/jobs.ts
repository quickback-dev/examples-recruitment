/**
 * Jobs — the open positions in a hiring pipeline.
 *
 * Authored with the `feature()` single-export sugar. Exercises:
 *  - `q.id()` primary key (cuid2)
 *  - `q.enum()` for a small status vocabulary
 *  - `.default(v)` combined with `.required()`
 *  - Column-level `.index()` on status (common filter)
 *  - Org-scoped firewall with softDelete
 */
import { feature, q } from "@quickback/compiler";

export default feature("jobs", {
  columns: {
    id:             q.id(),
    title:          q.text().required(),
    department:     q.text().required(),
    status:         q.enum(["draft", "open", "closed"]).default("draft").required().index(),
    salaryMin:      q.int().optional(),
    salaryMax:      q.int().optional(),
    description:    q.text().optional(),
    organizationId: q.text().required(),
  },
  firewall: { organization: {}, softDelete: {} },
  guards: {
    createable: ["title", "department", "status", "salaryMin", "salaryMax", "description"],
    updatable:  ["title", "department", "status", "salaryMin", "salaryMax", "description"],
  },
  crud: {
    list:   { access: { roles: ["owner", "admin", "member"] } },
    get:    { access: { roles: ["owner", "admin", "member"] } },
    create: { access: { roles: ["owner", "admin"] } },
    update: { access: { roles: ["owner", "admin"] } },
    delete: { access: { roles: ["owner"] }, mode: "soft" },
  },
});
