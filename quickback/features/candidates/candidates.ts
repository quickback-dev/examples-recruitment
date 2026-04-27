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
    name:           q.text({ maxLength: 200 }).required().filterable("like").searchable(),
    email:          q.text({ maxLength: 320 }).required().filterable("eq").searchable(),
    phone:          q.text({ maxLength: 32 }).optional().filterable("eq"),
    resumeUrl:      q.url({ maxLength: 2048 }).optional(),
    source:         q.enum(["linkedin", "referral", "careers-page", "other"]).default("other").required().filterable("eq"),
    internalNotes:  q.text({ maxLength: 4000 }).optional().searchable(),
    // Optional payroll/onboarding fields — present only after a candidate
    // accepts an offer. Both heavily masked: see `masking` below.
    legalName:      q.text({ maxLength: 200 }).optional(),
    governmentId:   q.text({ maxLength: 16 }).optional(),
    organizationId: q.scope("organization"),
  },
  // Composite uniqueness — a candidate's email is unique *per org*, not
  // globally. Without this, the same email could be added repeatedly to the
  // same tenant, silently creating duplicate candidate records.
  unique: [{ columns: ["organizationId", "email"] }],
  // `firewall` block omitted — `q.scope("organization")` triggers the
  // compiler's isolation auto-detection, which synthesises both the org
  // predicate and the soft-delete predicate (deletedAt is auto-detected
  // separately) into a complete firewall config.
  guards: {
    createable: ["name", "email", "phone", "resumeUrl", "source", "internalNotes", "legalName", "governmentId"],
    updatable:  ["name", "email", "phone", "resumeUrl", "source", "internalNotes", "legalName", "governmentId"],
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
    // `name`-shaped mask: keeps initials so the name column stays
    // recognisable in lists, but hides surnames from non-admins.
    legalName:     { type: "name",   show: { roles: ["admin+"] } },
    // `ssn` mask formats as ***-**-1234 even when only roles match.
    // Reserved for offer-letter / payroll flows; admin-only by design.
    governmentId:  { type: "ssn",    show: { roles: ["admin+"] } },
    // Owner override (createdBy === ctx.userId) bypasses the mask: a
    // recruiter sees the resume URL unmasked for candidates they
    // themselves added. Non-admins who didn't add the candidate see
    // the URL fully redacted.
    //
    // Note on `type: 'custom'`: the runtime supports a custom mask fn
    // (`mask: (v) => …`) but only when authored against the Drizzle
    // interop path. Features authored via `feature()` go through the
    // static source parser, which doesn't evaluate function expressions.
    // For q-DSL features stick to the named built-ins; promote to
    // `defineTable(...)` if a custom mask is required.
    resumeUrl: { type: "redact", show: { roles: ["admin+"], or: "owner" } },
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
        fields: ["id", "name", "email", "phone", "resumeUrl", "source", "internalNotes", "legalName", "governmentId"],
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
  // CMS metadata.
  displayColumn: "name",
  defaultSort: { field: "createdAt", order: "desc" },
  inputHints: {
    source:        "select",
    resumeUrl:     "lookup",
    internalNotes: "textarea",
    legalName:     "hidden",  // payroll flow only; not on the default form
    governmentId:  "hidden",
  },
});
