# Quickback Example: Recruitment

A pre-compiled [Quickback](https://quickback.dev) project — a full hiring pipeline (jobs, postings, candidates, applications, interviews, scoring, ATS imports, reports). Clone, `npm install`, `npm run dev`, and you have a working secure multi-tenant API in under a minute.

## What this example shows

- **PII masking** with multiple shapes (`email`, `phone`, `ssn`, `name`, `redact`) gated by role; owner override via `show.or: 'owner'` so a recruiter sees their own candidates' resume URLs unmasked
- **Field-level guards** — `createable` / `updatable` / `immutable` / `protected` allowlists, enforced at compile time
- **Record-scoped actions** with state-machine transitions and TOCTOU-safe `whereTransition` UPDATEs (concurrent `hire` + `reject` → exactly one wins, the other gets 409 `ACCESS_TRANSITION_LOST`)
- **Org-scoped firewall** with `firewallErrorMode: "hide"` (opaque 404s for cross-tenant probes on sensitive resources like `interviews`)
- **PUBLIC routes** (`job-postings` browses unauthenticated via `?organizationId=`; every call audit-logged)
- **Custom role hierarchy** — `interviewer < member < recruiter < admin < owner`, with `+` suffix expansion and `access.or[]` combinators that mix org roles, Better Auth platform-admin tier, and per-record `$ctx.userId` gates
- **Drizzle interop** — `interview_scores` is a sibling `sqliteTable` (no `defineTable`) used internally by the `complete` action handler; auto-injected `organizationId` and audit fields keep tenant scoping
- **`guards: false`** on `ats-imports` for a trusted-feed staging table where the schema *is* the allowlist
- **Tableless feature** — `reports/` ships only standalone actions (CSV file response on `/api/v1/reports/pipeline.csv`)
- **Soft deletes + audit fields** injected automatically; CMS metadata (`displayColumn`, `defaultSort`, `inputHints`) drives the `/cms` SPA

## Project structure

```
.
├── package.json           ← runtime dependencies
├── wrangler.toml          ← Cloudflare Workers config
├── drizzle.config.ts      ← generated drizzle config
├── src/                   ← COMPILED Hono API (routes, auth, db, middleware)
├── openapi.json           ← generated OpenAPI spec
├── schema-registry.json   ← generated schema registry
└── quickback/             ← SOURCE
    ├── quickback.config.ts  ← project config (providers, databases, auth)
    ├── features/            ← resource definitions (schema + security rules)
    ├── drizzle/             ← migration state (tracked in git)
    └── reports/             ← security contract reports
```

You write `quickback/`. The compiler writes everything else.

## Run it

```sh
npm install
npm run dev
```

You'll get a Cloudflare Worker on `http://localhost:8787` with:

- `/api/v1/candidates` — list/create/update/delete candidates
- `/api/v1/jobs` — job postings
- `/api/v1/applications` — candidate applications (with action-based lifecycle)
- `/auth/*` — Better Auth endpoints (login, signup, OTP, magic link, passkeys)
- `/openapi.json` — auto-generated API spec

Health check: `curl http://localhost:8787/health`

## Modify it

Edit anything under `quickback/` — add a field to a resource, change a role, add a new action. Then recompile:

```sh
npx @quickback-dev/cli compile
```

The generated files under `src/`, `drizzle.config.ts`, `openapi.json`, etc. regenerate. Your handler code under `quickback/features/*/actions.ts` is **never overwritten**.

## Deploy (Cloudflare)

1. Create the three D1 databases and one KV namespace:

   ```sh
   npx wrangler d1 create recruitment-example-auth
   npx wrangler d1 create recruitment-example-features
   npx wrangler d1 create recruitment-example-webhooks
   npx wrangler kv namespace create recruitment-example-kv
   ```

   Each command prints an ID. Keep them — you'll paste them in the next step.

2. Open `quickback/quickback.config.ts` and replace the placeholder UUIDs:

   ```ts
   database: defineDatabase("cloudflare-d1", {
     // ...
     authDatabaseId:     "<id from `wrangler d1 create recruitment-example-auth`>",
     featuresDatabaseId: "<id from `wrangler d1 create recruitment-example-features`>",
     webhooksDatabaseId: "<id from `wrangler d1 create recruitment-example-webhooks`>",
     kvNamespaceId:      "<id from `wrangler kv namespace create recruitment-example-kv`>",
   }),
   ```

   This is the right place for these IDs — they live in source control with the rest of your config, and `quickback compile` regenerates `wrangler.toml` from them. Editing `wrangler.toml` directly works too, but the next compile will overwrite your changes.

3. Recompile so the generated `wrangler.toml` picks up the new IDs:

   ```sh
   npx @quickback-dev/cli compile
   ```

4. Apply migrations to the remote DBs and set the auth signing secret:

   ```sh
   npx wrangler d1 migrations apply recruitment-example-auth --remote
   npx wrangler d1 migrations apply recruitment-example-features --remote
   npx wrangler d1 migrations apply recruitment-example-webhooks --remote
   npx wrangler secret put BETTER_AUTH_SECRET   # paste a strong random value
   ```

5. Deploy:

   ```sh
   npx wrangler deploy
   ```

   By default the worker ships to a `*.workers.dev` subdomain. To bind a custom domain, add a `routes` block to `runtime` in `quickback/quickback.config.ts` (see the commented example) and recompile before redeploying.

## About Quickback

Quickback is a compiler. You declare your schema and security rules in TypeScript; it emits a production-ready Hono API, Drizzle migrations, and Better Auth wiring — standard code you own. There's no runtime, no lock-in. Stop using Quickback tomorrow and this project still ships.

Learn more: **[quickback.dev](https://quickback.dev)** · [docs](https://docs.quickback.dev) · [CLI on npm](https://www.npmjs.com/package/@quickback-dev/cli)

## License

MIT — see [LICENSE](./LICENSE).
