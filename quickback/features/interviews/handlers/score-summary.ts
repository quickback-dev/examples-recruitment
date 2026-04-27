import type { ActionExecutor } from "@quickback/types";
import { avg, count, desc } from "drizzle-orm";
import { interviewScores } from "../interview_scores";

export const execute: ActionExecutor = async ({ db }) => {
  // Org scoping is automatic — `db` is the scoped Drizzle client, so
  // the WHERE clause includes `organization_id = ctx.activeOrgId`
  // for every table touched, including the internal `interview_scores`
  // table. No explicit `where(eq(...))` needed.
  const avgRating = avg(interviewScores.rating).mapWith(Number);
  const rows = (await db
    .select({
      interviewId: interviewScores.interviewId,
      avgRating,
      scorerCount: count(),
    })
    .from(interviewScores)
    .groupBy(interviewScores.interviewId)
    .orderBy(desc(avgRating))) as Array<{
    interviewId: string;
    avgRating: number | null;
    scorerCount: number;
  }>;

  return {
    interviews: rows.map((r) => ({
      interviewId: r.interviewId,
      averageRating: r.avgRating ?? 0,
      scorerCount: r.scorerCount,
    })),
    totalScored: rows.length,
  };
};
