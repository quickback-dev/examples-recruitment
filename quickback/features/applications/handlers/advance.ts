import type { ActionExecutor } from "@quickback/types";
import { applications } from "../schema";

export const execute: ActionExecutor = async ({ db, record, input, auditFields, whereRecord }) => {
  const [updated] = await db
    .update(applications)
    .set({
      status: input.nextStatus,
      notes: input.notes ?? record.notes,
      modifiedAt: auditFields.modifiedAt,
    })
    .where(whereRecord!(applications))
    .returning();
  return updated;
};
