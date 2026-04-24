import type { ActionExecutor } from "@quickback/types";
import { eq } from "drizzle-orm";
import { applications } from "../schema";

export const execute: ActionExecutor = async ({ db, record, input, auditFields }) => {
  const [updated] = await db
    .update(applications)
    .set({
      status: input.nextStatus,
      notes: input.notes ?? record.notes,
      modifiedAt: auditFields.modifiedAt,
    })
    .where(eq(applications.id, record.id))
    .returning();
  return updated;
};
