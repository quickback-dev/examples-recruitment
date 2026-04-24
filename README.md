# Quickback Example: Recruitment

A pre-compiled [Quickback](https://quickback.dev) project — a hiring pipeline with candidates, jobs, and applications. Clone, `npm install`, `npm run dev`, and you have a working secure multi-tenant API in under a minute.

## What this example shows

- **PII masking** — `email` and `phone` redacted by role (`recruiter` sees email, `hiring-manager` doesn't)
- **Field-level guards** — what fields are creatable/updatable per resource, enforced at compile time
- **Record-scoped actions** — e.g. `approve` only works when `status = 'submitted'`
- **Org-scoped firewall** — every table auto-filters by organization; impossible to leak across tenants
- **Soft deletes + audit fields** — injected automatically by the compiler

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

First deploy needs D1 databases:

```sh
npx wrangler d1 create q-recruit-auth
npx wrangler d1 create q-recruit
npx wrangler d1 create q-recruit-webhooks
```

Copy the three database IDs into `wrangler.toml` under the `[[d1_databases]]` blocks. Then:

```sh
npx wrangler d1 migrations apply q-recruit-auth --remote
npx wrangler d1 migrations apply q-recruit --remote
npx wrangler deploy
```

## About Quickback

Quickback is a compiler. You declare your schema and security rules in TypeScript; it emits a production-ready Hono API, Drizzle migrations, and Better Auth wiring — standard code you own. There's no runtime, no lock-in. Stop using Quickback tomorrow and this project still ships.

Learn more: **[quickback.dev](https://quickback.dev)** · [docs](https://docs.quickback.dev) · [CLI on npm](https://www.npmjs.com/package/@quickback-dev/cli)

## License

MIT — see [LICENSE](./LICENSE).
