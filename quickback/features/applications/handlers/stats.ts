import type { ActionExecutor } from "@quickback/types";
import { count } from "drizzle-orm";
import { applications } from "../schema";

export const execute: ActionExecutor = async ({ db }) => {
  const rows = await db
    .select({ status: applications.status, n: count() })
    .from(applications)
    .groupBy(applications.status);

  const byStatus: Record<string, number> = {};
  let total = 0;
  for (const r of rows as Array<{ status: string; n: number }>) {
    byStatus[r.status] = r.n;
    total += r.n;
  }
  return { byStatus, total };
};
