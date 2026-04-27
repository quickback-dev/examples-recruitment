/**
 * Reports — a tableless feature directory.
 *
 * Tableless features have no `defineTable` / `feature()` and live in
 * their own directory. Useful for cross-resource utilities (CSV
 * exports, support-tier introspection) that don't map cleanly to a
 * single CRUD-shaped table.
 *
 * One action exposed here:
 *
 *  - `pipelineCsv` — `responseType: "file"`. Hono streams a
 *    `text/csv` body with `Content-Disposition: attachment` so the
 *    browser triggers a download. Useful when an admin needs to
 *    paste a snapshot into a spreadsheet.
 *
 * The cross-tenant `unsafe: { … }` admin demo is *not* shown here.
 * Two compiler bugs to fix first:
 *   1. tableless features don't emit the `attachScopeTo` import
 *      that the unsafe-action route generator references;
 *   2. the static source parser flattens a nested `unsafe: {…}`
 *      config into a phantom top-level action named "unsafe".
 * Once those land, this feature gains a `crossTenantStats` action
 * with `unsafe: { adminOnly, crossTenant, targetScope: "all" }`.
 *
 * Streaming responses (`responseType: "stream"`) are also supported,
 * but the canonical pattern is Cloudflare Durable Objects — see
 * `marketing/docs/content/docs/stack/realtime/` — which is a better
 * demo than a contrived heartbeat handler.
 */
import { z } from "zod";

// Tableless feature — the runtime expects a plain `{ actions }`
// object here rather than `defineActions(table, …)` because there's
// no parent table to bind. Same shape as `defineActions`'s second
// arg, just without the wrapping call.
export default { actions: {
  pipelineCsv: {
    description: "Export the application pipeline as CSV.",
    standalone: true,
    path: "/reports/pipeline.csv",
    method: "GET",
    responseType: "file",
    input: z.object({}),
    access: { roles: ["admin", "owner", "recruiter"] },
    handler: "./handlers/pipeline-csv",
  },
} };
