import {
  getCasesResponseSchema,
  postCaseRequestSchema,
  postCaseResponseSchema,
} from "@rectify/core";
import { requireOperator } from "@/server/auth";
import { getIntakeDirectory, getProviderEnvironments, requireEnvironment } from "@/server/config";
import { resolveIntake } from "@rectify/store";
import { errorResponse } from "@/server/errors";
import { openRepositories } from "@/server/repositories";
import { parseJsonBody } from "@/server/request";

export function GET(request: Request) {
  try {
    requireOperator(request, requireEnvironment("RECTIFY_OPERATOR_TOKEN"));
    const repositories = openRepositories();
    try {
      return Response.json(
        getCasesResponseSchema.parse({ cases: repositories.cases.listCases(), nextCursor: null }),
      );
    } finally {
      repositories.close();
    }
  } catch (error: unknown) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    requireOperator(request, requireEnvironment("RECTIFY_OPERATOR_TOKEN"));
    const body = await parseJsonBody(request, postCaseRequestSchema);
    const repositories = openRepositories();
    try {
      const identity = resolveIntake({
        directory: getIntakeDirectory(),
        clarifications: repositories.clarifications,
        gmailThreadId: body.gmailThreadId,
        tenantId: body.tenantId ?? null,
        operatorId: "operator",
      });
      const record = repositories.cases.createOrResume(identity, getProviderEnvironments());
      return Response.json(postCaseResponseSchema.parse({ case: record }));
    } finally {
      repositories.close();
    }
  } catch (error: unknown) {
    return errorResponse(error);
  }
}
