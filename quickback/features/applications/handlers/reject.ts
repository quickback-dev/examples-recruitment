import type { ActionExecutor } from "@quickback/types";
import { eq } from "drizzle-orm";
import { applications } from "../schema";

export const execute: ActionExecutor = async ({ db, record, input, auditFields }) => {
  const suffix = input.reason ? ` — ${input.reason}` : "";
  const appendedNotes = `${record.notes ?? ""}${record.notes ? "\n" : ""}Rejected${suffix}`.trim();
  const [updated] = await db
    .update(applications)
    .set({
      status: "rejected",
      notes: appendedNotes,
      modifiedAt: auditFields.modifiedAt,
    })
    .where(eq(applications.id, record.id))
    .returning();
  return updated;
};
