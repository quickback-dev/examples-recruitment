/**
 * q-recruit — Quickback config
 *
 * Every feature is authored with the `q` DSL (see `features/*`).
 * Compiles to a Hono API on Cloudflare Workers + D1.
 *
 * To deploy to your own Cloudflare account, see wrangler.toml for the
 * resource-creation steps. This config references those resource IDs below.
 */

import {
  defineConfig,
  defineRuntime,
  defineDatabase,
  defineAuth,
} from "@quickback/compiler";

export default defineConfig({
  name: "q-recruit",
  template: "hono",

  features: {
    organizations: true,
  },

  auth: {
    roleHierarchy: ["member", "admin", "owner"],
  },

  providers: {
    runtime: defineRuntime("cloudflare", {
      compatibilityDate: "2025-01-01",
      // Replace for deploy — add your custom domain(s) here, or remove the
      // routes entry to publish to a workers.dev subdomain.
      // routes: [
      //   { pattern: "recruit.yourdomain.com", custom_domain: true },
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
      // Replace these placeholder UUIDs with real D1 database IDs from
      // `wrangler d1 create <name>` before running `npm run deploy`.
      authDatabaseId: "00000000-0000-0000-0000-000000000001",
      featuresDatabaseId: "00000000-0000-0000-0000-000000000002",
      webhooksDatabaseId: "00000000-0000-0000-0000-000000000003",
    }),

    auth: defineAuth("better-auth", {
      emailAndPassword: { enabled: true },
      plugins: ["organization", "bearer", "jwt"],
      trustedOrigins: [
        "http://localhost:8787",
        // Add your production origin(s) before deploying.
      ],
      session: {
        expiresInDays: 7,
        updateAgeInDays: 1,
      },
      rateLimit: {
        enabled: true,
        window: 60,
        max: 100,
      },
    }),
  },

});
