/**
 * Recruitment — Quickback config
 *
 * Every feature is authored with the `q` DSL (see `features/*`).
 * Compiles to a Hono API on Cloudflare Workers + D1.
 *
 * BEFORE DEPLOYING: replace the placeholder UUIDs below with the IDs
 * from `wrangler d1 create` / `wrangler kv namespace create`, then
 * run `quickback compile` so the generated `wrangler.toml` picks them
 * up. See `README.md` → "Deploy" for the step-by-step.
 */

import {
  defineConfig,
  defineRuntime,
  defineDatabase,
  defineAuth,
} from "@quickback/compiler";

export default defineConfig({
  // Worker name on Cloudflare. Rename to whatever you want — this just
  // becomes the default `name = "..."` in the generated wrangler.toml.
  name: "recruitment-example",
  template: "hono",

  features: {
    organizations: true,
  },

  // Cloudflare Email (send_email binding) — used by Better Auth for
  // password resets, email verification, and organization invitations.
  // Replace `from` with an address on a domain you've enabled for
  // Cloudflare Email Routing. Without this block, email-using auth
  // surfaces still compile but won't actually deliver.
  email: {
    from: "noreply@example.com",
    fromName: "Recruitment | Account Services",
  },

  auth: {
    // Recruiting-tool role hierarchy. The `+` suffix in feature
    // access (e.g. `roles: ["recruiter+"]`) walks RIGHT in this list,
    // so `recruiter+` expands to `[recruiter, admin, owner]` and
    // `member+` to `[member, recruiter, admin, owner]`.
    //
    //  - `interviewer` — sees only interviews they're conducting (used in
    //    the per-record owner gate on `interviews.read`)
    //  - `member`     — Better Auth default role; tenant-wide read of
    //    non-PII fields, no mutation rights on candidates / applications
    //  - `recruiter`  — can advance / reject applications, see PII
    //  - `admin`      — manage jobs, postings, and (via Better Auth) org
    //    membership
    //  - `owner`      — destructive ops (hard / soft delete, withdrawal)
    //
    // Roles outside Better Auth's defaults (`member`, `admin`, `owner`)
    // need to be assigned explicitly when adding a member to an org —
    // Better Auth's `addMember` accepts an arbitrary string, the
    // hierarchy here just teaches Quickback how `+` expansion works.
    roleHierarchy: ["interviewer", "member", "recruiter", "admin", "owner"],
  },

  providers: {
    runtime: defineRuntime("cloudflare", {
      compatibilityDate: "2025-01-01",
      // Replace for deploy — add your custom domain(s) here, or remove the
      // routes entry to publish to a workers.dev subdomain. Multi-domain
      // deploys auto-add a unified `quickback.{baseDomain}` route + a
      // `webhook.{baseDomain}` subdomain when webhooks are enabled.
      // routes: [
      //   { pattern: "recruit.example.com", custom_domain: true },
      // ],
      observability: { enabled: true },
    }),

    database: defineDatabase("cloudflare-d1", {
      generateId: "prefixed",
      namingConvention: "snake_case",
      splitDatabases: true,
      authBinding: "AUTH_DB",
      featuresBinding: "DB",
      webhooksBinding: "WEBHOOKS_DB",
      // Replace these placeholder UUIDs with the real IDs from
      // `wrangler d1 create <name>` / `wrangler kv namespace create
      // <name>`, then run `quickback compile` to regenerate
      // `wrangler.toml`. See README.md → "Deploy".
      authDatabaseId: "00000000-0000-0000-0000-000000000001",
      featuresDatabaseId: "00000000-0000-0000-0000-000000000002",
      webhooksDatabaseId: "00000000-0000-0000-0000-000000000003",
      // KV namespace for Better Auth rate-limit counters + session
      // overflow. Same fork-and-replace pattern.
      kvNamespaceId: "00000000000000000000000000000004",
    }),

    auth: defineAuth("better-auth", {
      emailAndPassword: { enabled: true },
      plugins: ["organization", "bearer", "jwt"],
      // trustedOrigins is omitted — the compiler seeds the standard
      // localhost dev set (8787, 3000, 5173) and the runtime CORS check
      // also auto-trusts BETTER_AUTH_URL when it's set. For prod, set
      // BETTER_AUTH_URL via `wrangler secret put` (or list extra origins
      // here explicitly).
      session: {
        expiresInDays: 7,
        updateAgeInDays: 1,
      },
      // Global rate limit — generous default for general traffic. Sign-in
      // and OTP endpoints get a much tighter per-route override (5 / 60s)
      // so password / code-guessing attempts can't burn 100 attempts per
      // IP per minute.
      rateLimit: {
        enabled: true,
        window: 60,
        max: 100,
        customRules: {
          "/sign-in/email":      { window: 60, max: 5 },
          "/sign-in/email-otp":  { window: 60, max: 5 },
          "/email-otp/send":     { window: 60, max: 3 },
          "/email-otp/verify":   { window: 60, max: 5 },
          "/forget-password":    { window: 60, max: 3 },
          "/reset-password":     { window: 60, max: 5 },
        },
      },
    }),
  },

  // Embedded SPAs — both ride on the unified workers.dev origin:
  //   /cms/*      → packages/cms (CMS data UI, gated to platform admins)
  //   /account/*  → packages/account (login/profile/orgs)
  // Built into the worker bundle at compile time; zero extra deploys.
  //
  // CMS defaults to `access: 'admin'` — only `user.role === 'admin'` (the
  // Better Auth platform-admin tier, distinct from the per-org `admin`
  // role) can reach /cms/*. Non-admins are redirected to /account/profile.
  // Pass `cms: { access: 'user' }` to allow any authenticated user.
  cms: true,
  account: true,

  // /openapi.json is public by default (MCP-discoverable). Mount Scalar
  // at /docs as a browseable UI on top of the same spec — opens in any
  // browser, no extra dependencies.
  openapi: { docs: "scalar" },

});
