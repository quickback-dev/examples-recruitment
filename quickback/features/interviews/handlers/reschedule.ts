import { ActionError, type ActionExecutor } from "@quickback/types";
import { interviews } from "../schema";

export const execute: ActionExecutor = async ({
  db,
  record,
  input,
  auditFields,
  whereRecord,
}) => {
  // Refuse to reschedule once the interview is past its terminal state.
  // Belt-and-suspenders alongside the route's role gate — the access
  // policy admits owners + admins, but neither should be able to
  // reschedule a completed/cancelled interview.
  if (record.status !== "scheduled") {
    throw new ActionError(
      `Cannot reschedule a ${record.status} interview`,
      "INTERVIEW_NOT_RESCHEDULABLE",
      409,
    );
  }

  const [updated] = await db
    .update(interviews)
    .set({
      scheduledAt: input.scheduledAt,
      durationMin: input.durationMin ?? record.durationMin,
      modifiedAt: auditFields!.modifiedAt,
    })
    .where(whereRecord!(interviews))
    .returning();
  return updated;
};
