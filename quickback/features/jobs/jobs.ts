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
    title:          q.text({ maxLength: 200 }).required(),
    department:     q.text({ maxLength: 100 }).required(),
    status:         q.enum(["draft", "open", "closed"]).default("draft").required().index(),
    salaryMin:      q.int().optional(),
    salaryMax:      q.int().optional(),
    description:    q.text({ maxLength: 8000 }).optional(),
    organizationId: q.scope("organization"),
  },
  // `firewall` block omitted — `q.scope("organization")` triggers the
  // compiler's isolation auto-detection, which synthesises the org predicate
  // and the soft-delete predicate (deletedAt is auto-detected separately)
  // into a complete firewall config. Normalized with candidates / applications
  // for consistency.
  guards: {
    createable: ["title", "department", "status", "salaryMin", "salaryMax", "description"],
    updatable:  ["title", "department", "status", "salaryMin", "salaryMax", "description"],
  },
  // CMS metadata — pure rendering hints. The compiler bakes these into the
  // schema registry (`/api/v1/schema`) which the CMS consumes; no runtime
  // behaviour change. `displayColumn` also drives FK label resolution on
  // GET/list responses for any feature that references jobs (e.g. the
  // `_jobId_label` enrichment on applications.routes).
  displayColumn: "title",
  defaultSort: { field: "createdAt", order: "desc" },
  inputHints: {
    description: "richtext",   // tiptap editor instead of plain textarea
    status:      "select",     // enum → dropdown
    salaryMin:   "currency",
    salaryMax:   "currency",
    department:  "select",
  },
  read: { access: { roles: ["owner", "admin", "member"] } },
  crud: {
    create: { access: { roles: ["owner", "admin"] } },
    update: { access: { roles: ["owner", "admin"] } },
    delete: { access: { roles: ["owner"] }, mode: "soft" },
  },
});
