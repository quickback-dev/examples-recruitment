/**
 * Candidates — the people being considered for jobs.
 *
 * Exercises:
 *  - Column DSL: `.filterable()` / `.searchable()` opt-ins
 *  - `q.scope("organization")` declares a tenant-scope column in one place;
 *    the compiler auto-derives the firewall predicate AND adds it to
 *    systemManaged guards, so the explicit `firewall: [...]` block can drop
 *    its organization clause (soft-delete still ridges in via auto-detection
 *    on `deletedAt`)
 *  - PII masking with a single `query.roles` role gate that covers ?filter,
 *    ?sort, and ?search uniformly. Non-admins see masked payloads AND can't
 *    enumerate via query strings. The `full` view re-opens all three for
 *    admins via its own `query.{cap}` allowlist — the validator enforces
 *    `view.access.roles ∩ masking.query.roles ≠ ∅` before permitting the
 *    opt-in (with `show.roles` as the fallback when `query` is omitted).
 *  - Unified read pipeline with named views and per-view query allowlists
 *  - `feature()` single-export sugar
 */
import { feature, q } from "@quickback/compiler";

export default feature("candidates", {
  columns: {
    id:             q.id(),
    name:           q.text().required().filterable("like").searchable(),
    email:          q.text().required().filterable("eq").searchable(),
    phone:          q.text().optional().filterable("eq"),
    resumeUrl:      q.text().optional(),
    source:         q.enum(["linkedin", "referral", "careers-page", "other"]).default("other").required().filterable("eq"),
    internalNotes:  q.text().optional().searchable(),
    organizationId: q.scope("organization"),
  },
  // `firewall` block omitted — `q.scope("organization")` triggers the
  // compiler's isolation auto-detection, which synthesises both the org
  // predicate and the soft-delete predicate (deletedAt is auto-detected
  // separately) into a complete firewall config.
  guards: {
    createable: ["name", "email", "phone", "resumeUrl", "source", "internalNotes"],
    updatable:  ["name", "email", "phone", "resumeUrl", "source", "internalNotes"],
  },
  masking: {
    // Precedence: each `masking[col]` rule says "this column is redacted
    // for callers outside `show.roles`." `query.roles` says "and only these
    // roles can filter / sort / search the column either." Omitting
    // `query` defaults to `show.roles` — i.e. "if you can see it, you can
    // query it" — which is the right shape for almost all PII.
    //
    // A view can opt back in by listing the column in its own
    // `query.{filterable,searchable,sortable}` allowlist; the validator
    // requires the view's access roles intersect `query.roles` (or
    // `show.roles` when `query` is absent), so the opt-in can never reach
    // a caller who'd see the value masked.
    email:         { type: "email",  show: { roles: ["admin+"] } },
    phone:         { type: "phone",  show: { roles: ["admin+"] } },
    internalNotes: { type: "redact", show: { roles: ["admin+"] } },
  },
  read: {
    access: { roles: ["member+"] },
    views: {
      pipeline: {
        fields: ["id", "name", "source"],
        access: { roles: ["member+"] },
        query: {
          filterable: ["source"],
          searchable: ["name"],
          sortable:   ["createdAt", "name"],
          defaultSort: "-createdAt",
        },
      },
      full: {
        fields: ["id", "name", "email", "phone", "resumeUrl", "source", "internalNotes"],
        access: { roles: ["admin+"] },
        query: {
          filterable: ["source", "email", "phone"],
          searchable: ["name", "email", "internalNotes"],
          sortable:   ["createdAt", "name", "email"],
        },
      },
    },
  },
  crud: {
    create: { access: { roles: ["admin+"] } },
    update: { access: { roles: ["admin+"] } },
    delete: { access: { roles: ["owner"] }, mode: "soft" },
  },
});
