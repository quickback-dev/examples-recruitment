/**
 * Job postings — the *public* face of an open role.
 *
 * Distinct from `jobs` (which is the internal record with salary range,
 * draft state, etc.). A `jobPosting` is the curated, careers-page-friendly
 * projection: a slug, a headline, a marketing-copy summary, and a target
 * application form.
 *
 * Exercises the parts of the access model nothing else in the example
 * does:
 *
 *  - `roles: ["PUBLIC"]` — read endpoints are *unauthenticated*. Anyone
 *    can hit `GET /api/v1/job-postings?organizationId=org_xyz` and the
 *    careers page renders. The firewall still applies, so the
 *    `organizationId` query param is mandatory (otherwise 400
 *    `ORG_REQUIRED`).
 *  - **Mandatory audit logging on every PUBLIC invocation.** The
 *    runtime automatically inserts an `audit_events` row (IP, input,
 *    result, timing) for every call to a PUBLIC route — no opt-in
 *    needed. Use cases: rate-limit visibility, abuse forensics,
 *    careers-page analytics.
 *  - **PUBLIC + org-scoped together.** Common pattern for B2B
 *    "tenant-owned public surfaces": each tenant has their own
 *    careers page; the firewall isolates one tenant's postings from
 *    another's.
 *  - Auth-gated mutations layered on top — the same resource exposes
 *    `POST` / `PATCH` / `DELETE` to admins/owners only, so the
 *    careers-page UI is read-only and the CMS handles writes.
 *  - Composite uniqueness on `(organizationId, slug)` so two tenants
 *    can both have `/careers/senior-engineer` without colliding.
 *
 * Why a separate feature instead of a view on `jobs`: views project
 * fields but don't change the auth gate — a PUBLIC view on a
 * member-only feature would be rejected by the validator (the view's
 * roles must be a subset of the parent's). Decoupling lets the
 * public-facing fields evolve without ever touching the internal
 * `jobs` schema, and any data leak risk is bounded to the columns
 * declared here.
 */
import { feature, q } from "@quickback/compiler";
import jobs from "../jobs/jobs";

export default feature("jobPostings", {
  columns: {
    id:             q.id(),
    // FK back to the internal `jobs` record. Kept in the response
    // shape (so internal tooling can join) but left out of the
    // public-careers UI by convention. `references()` adds an FK
    // constraint with cascade-on-delete: if the underlying job goes
    // away, its public posting follows.
    jobId:          q.text().required().references(() => jobs.id, { onDelete: "cascade" }),
    slug:           q.text({ maxLength: 200 }).required().filterable("eq"),
    headline:       q.text({ maxLength: 200 }).required().searchable(),
    summary:        q.text({ maxLength: 4000 }).optional().searchable(),
    location:       q.text({ maxLength: 100 }).optional().filterable("eq"),
    employmentType: q.enum(["full-time", "part-time", "contract", "internship"]).default("full-time").required().filterable("eq"),
    organizationId: q.scope("organization"),
  },
  // A tenant can't have two postings with the same slug.
  unique: [{ columns: ["organizationId", "slug"] }],
  guards: {
    createable: ["jobId", "slug", "headline", "summary", "location", "employmentType"],
    updatable:  ["slug", "headline", "summary", "location", "employmentType"],
    immutable:  ["jobId"],
  },
  read: {
    // PUBLIC — no auth required. The unauthenticated client must pass
    // `?organizationId=` (the firewall enforces it; missing → 400
    // ORG_REQUIRED). Each invocation lands in `audit_events` regardless
    // of outcome.
    access: { roles: ["PUBLIC"] },
  },
  // Mutations are auth-gated — unchanged from the rest of the example.
  // The PUBLIC read on the same resource doesn't widen the write
  // surface; the validator treats each verb's access independently.
  crud: {
    create: { access: { roles: ["admin", "owner"] } },
    update: { access: { roles: ["admin", "owner"] } },
    delete: { access: { roles: ["owner"] }, mode: "soft" },
  },
  references: { jobId: "jobs" },
  displayColumn: "headline",
  defaultSort: { field: "createdAt", order: "desc" },
  inputHints: {
    employmentType: "select",
    summary:        "richtext",
    jobId:          "lookup",
  },
});
