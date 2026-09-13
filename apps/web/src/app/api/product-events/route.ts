import { requireEnvironment } from "@/server/config";
import { errorResponse, HttpError } from "@/server/errors";
import { acceptCustomerOutcome } from "@/server/outcome-events";
import { openRepositories } from "@/server/repositories";

export async function POST(request: Request) {
  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new HttpError(400, "Request body must be valid JSON");
    }
    const repositories = openRepositories();
    try {
      const event = acceptCustomerOutcome(
        body,
        requireEnvironment("REPORTDESK_OUTCOME_SECRET"),
        repositories.cases,
        new Date(),
      );
      return Response.json({ eventId: event.eventId, accepted: true });
    } finally {
      repositories.close();
    }
  } catch (error: unknown) {
    return errorResponse(error);
  }
}
