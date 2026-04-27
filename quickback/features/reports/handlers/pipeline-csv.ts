import type { ActionExecutor } from "@quickback/types";
import { applications } from "../../applications/schema";

export const execute: ActionExecutor = async ({ db, c }) => {
  // Scoped `db` — query is automatically org-firewalled and
  // soft-delete-filtered. Cross-tenant access happens through the
  // separate `crossTenantStats` action, not here.
  const rows = (await db
    .select({
      id: applications.id,
      jobId: applications.jobId,
      candidateId: applications.candidateId,
      status: applications.status,
      appliedAt: applications.appliedAt,
    })
    .from(applications)) as Array<{
    id: string;
    jobId: string;
    candidateId: string;
    status: string;
    appliedAt: string | null;
  }>;

  const header = ["id", "jobId", "candidateId", "status", "appliedAt"].join(",");
  const lines = rows.map((r) =>
    [r.id, r.jobId, r.candidateId, r.status, r.appliedAt ?? ""]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","),
  );
  const body = [header, ...lines].join("\n") + "\n";

  // `responseType: "file"` in the action def doesn't auto-set
  // headers — the handler is responsible for the Content-Disposition
  // and content-type. Returning a `Response` lets us hand Hono the
  // raw bytes plus headers.
  return new Response(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="pipeline-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
};
