import type { ActionExecutor } from "@quickback/types";
import { atsImports } from "../schema";

export const execute: ActionExecutor = async ({ db, ctx, input, auditFields }) => {
  // SQLite UPSERT against the composite unique
  // (organizationId, sourceSystem, externalId).
  //
  // The batch is processed row-at-a-time rather than in one
  // multi-row INSERT … ON CONFLICT … because Drizzle's set: clause
  // can't reference `excluded.<col>` from the inserted batch
  // through its query builder, and the compiler refuses raw
  // `sql\`excluded.payload\`` without `allowRawSql: true` on the
  // action. Per-row upsert is fine for `records.max(100)`; if you
  // need higher throughput, opt into raw SQL on this action and
  // collapse to a single statement.
  let upserted = 0;
  for (const r of input.records as Array<{ externalId: string; payload: string }>) {
    await db
      .insert(atsImports)
      .values({
        id: crypto.randomUUID(),
        externalId: r.externalId,
        sourceSystem: input.sourceSystem,
        payload: r.payload,
        status: "pending" as const,
      })
      .onConflictDoUpdate({
        target: [atsImports.organizationId, atsImports.sourceSystem, atsImports.externalId],
        set: {
          payload: r.payload,
          status: "pending",
          error: null,
          modifiedAt: auditFields!.modifiedAt,
          modifiedBy: ctx.userId,
        },
      });
    upserted++;
  }

  return { upserted, sourceSystem: input.sourceSystem };
};
