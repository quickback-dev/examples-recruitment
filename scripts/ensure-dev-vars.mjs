// Copy .dev.vars.example → .dev.vars on first run so `wrangler dev` has what it
// needs out of the box. Idempotent — does nothing if .dev.vars already exists.

import { existsSync, copyFileSync } from "node:fs";

const SRC = ".dev.vars.example";
const DEST = ".dev.vars";

if (existsSync(DEST)) {
  process.exit(0);
}

if (!existsSync(SRC)) {
  console.error(`[ensure-dev-vars] ${SRC} not found — skipping.`);
  process.exit(0);
}

copyFileSync(SRC, DEST);
console.log(`[ensure-dev-vars] Created ${DEST} from ${SRC} (dev-only secrets).`);
