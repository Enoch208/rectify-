import { getApproverIds, requireEnvironment } from "@/server/config";
import { errorResponse } from "@/server/errors";
import { openRepositories } from "@/server/repositories";
import { bindSlackDecision, parseSlackDecision, verifySlackRequest } from "@rectify/store";

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    verifySlackRequest(
      rawBody,
      request.headers.get("x-slack-signature"),
      request.headers.get("x-slack-request-timestamp"),
      requireEnvironment("SLACK_SIGNING_SECRET"),
      new Date(),
    );
    const { payload, decision } = parseSlackDecision(rawBody);
    const repositories = openRepositories();
    try {
      const approval = repositories.approvals.get(decision.approvalId);
      const updated = bindSlackDecision(payload, decision, approval, getApproverIds(), new Date());
      repositories.approvals.save(updated);
      return Response.json({ approvalId: updated.id, decision: updated.decision });
    } finally {
      repositories.close();
    }
  } catch (error: unknown) {
    return errorResponse(error);
  }
}
