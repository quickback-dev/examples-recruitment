import { ActionExecutor, TransitionLostError } from "@quickback/types";
import { interviews } from "../schema";
import { interviewScores } from "../interview_scores";

export const execute: ActionExecutor = async ({
  db,
  ctx,
  record,
  input,
  auditFields,
  whereTransition,
}) => {
  // 1) Flip the parent's status under the TOCTOU-safe transition guard.
  const [updated] = await db
    .update(interviews)
    .set({ status: "completed", modifiedAt: auditFields!.modifiedAt })
    .where(whereTransition!(interviews))
    .returning();
  if (!updated) throw new TransitionLostError("status", record.status, "completed");

  // 2) Insert the score row into the internal Drizzle table. The
  //    scoped `db` auto-stamps `organizationId`, `createdBy`,
  //    `createdAt`, etc. — we just supply the business columns and
  //    a generated id.
  await db.insert(interviewScores).values({
    id: crypto.randomUUID(),
    interviewId: record.id,
    scorerId: ctx.userId,
    rating: input.rating,
    recommendation: input.recommendation,
    comments: input.comments ?? null,
  });

  return updated;
};
