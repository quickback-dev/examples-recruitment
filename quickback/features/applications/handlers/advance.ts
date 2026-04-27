import { ActionExecutor, TransitionLostError } from "@quickback/types";
import { applications } from "../schema";

export const execute: ActionExecutor = async ({ db, record, input, auditFields, whereTransition }) => {
  const [updated] = await db
    .update(applications)
    .set({
      status: input.nextStatus,
      notes: input.notes ?? record.notes,
      modifiedAt: auditFields!.modifiedAt,
    })
    .where(whereTransition!(applications))
    .returning();
  if (!updated) throw new TransitionLostError("status", record.status, input.nextStatus);
  return updated;
};
