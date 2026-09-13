import { getRunsResponseSchema } from "@rectify/core";
import { requireOperator } from "@/server/auth";
import { requireEnvironment } from "@/server/config";
import { errorResponse } from "@/server/errors";
import { openRepositories } from "@/server/repositories";

export function GET(request: Request) {
  try {
    requireOperator(request, requireEnvironment("RECTIFY_OPERATOR_TOKEN"));
    const repositories = openRepositories();
    try {
      return Response.json(
        getRunsResponseSchema.parse({ runs: repositories.runs.list(), nextCursor: null }),
      );
    } finally {
      repositories.close();
    }
  } catch (error: unknown) {
    return errorResponse(error);
  }
}
