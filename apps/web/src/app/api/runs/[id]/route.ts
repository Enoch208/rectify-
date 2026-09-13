import { requireOperator } from "@/server/auth";
import { requireEnvironment } from "@/server/config";
import { errorResponse } from "@/server/errors";
import { openRepositories } from "@/server/repositories";

export async function GET(request: Request, context: RouteContext<"/api/runs/[id]">) {
  try {
    requireOperator(request, requireEnvironment("RECTIFY_OPERATOR_TOKEN"));
    const { id } = await context.params;
    const repositories = openRepositories();
    try {
      return Response.json(repositories.runs.get(id));
    } finally {
      repositories.close();
    }
  } catch (error: unknown) {
    return errorResponse(error);
  }
}
