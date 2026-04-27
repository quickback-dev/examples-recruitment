import { ActionExecutor, TransitionLostError } from "@quickback/types";
import { applications } from "../schema";

export const execute: ActionExecutor = async ({ db, record, input, auditFields, whereTransition }) => {
  const suffix = input.reason ? ` — ${input.reason}` : "";
  const appendedNotes = `${record.notes ?? ""}${record.notes ? "\n" : ""}Rejected${suffix}`.trim();
  const [updated] = await db
    .update(applications)
    .set({
      status: "rejected",
      notes: appendedNotes,
      modifiedAt: auditFields!.modifiedAt,
    })
    .where(whereTransition!(applications))
    .returning();
  if (!updated) throw new TransitionLostError("status", record.status, "rejected");
  return updated;
};
