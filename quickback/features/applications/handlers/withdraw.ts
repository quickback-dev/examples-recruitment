import type { ActionExecutor } from "@quickback/types";
import { applications } from "../schema";

export const execute: ActionExecutor = async ({ db, auditFields, whereRecord }) => {
  const [updated] = await db
    .update(applications)
    .set({ status: "withdrawn", modifiedAt: auditFields.modifiedAt })
    .where(whereRecord!(applications))
    .returning();
  return updated;
};
