import { ActionExecutor, TransitionLostError } from "@quickback/types";
import { applications } from "../schema";

export const execute: ActionExecutor = async ({ db, record, auditFields, whereTransition }) => {
  const [updated] = await db
    .update(applications)
    .set({ status: "hired", modifiedAt: auditFields!.modifiedAt })
    .where(whereTransition!(applications))
    .returning();
  if (!updated) throw new TransitionLostError("status", record.status, "hired");
  return updated;
};
