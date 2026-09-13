import { requireOperator } from "@/server/auth";
import { requireEnvironment } from "@/server/config";
import { errorResponse } from "@/server/errors";
import { openRepositories } from "@/server/repositories";

export async function POST(request: Request, context: RouteContext<"/api/cases/[id]/recheck">) {
  try {
    requireOperator(request, requireEnvironment("RECTIFY_OPERATOR_TOKEN"));
    const { id } = await context.params;
    const repositories = openRepositories();
    try {
      return Response.json({ jobId: repositories.cases.queue(id, "RECHECK") }, { status: 202 });
    } finally {
      repositories.close();
    }
  } catch (error: unknown) {
    return errorResponse(error);
  }
}
