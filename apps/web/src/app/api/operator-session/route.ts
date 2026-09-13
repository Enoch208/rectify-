import { z } from "zod";
import { operatorTokenMatches } from "@/server/auth";
import { requireEnvironment } from "@/server/config";
import { errorResponse, HttpError } from "@/server/errors";
import { parseJsonBody } from "@/server/request";

const sessionRequestSchema = z.object({ token: z.string().min(1) });

export async function POST(request: Request) {
  try {
    const { token } = await parseJsonBody(request, sessionRequestSchema);
    if (!operatorTokenMatches(token, requireEnvironment("RECTIFY_OPERATOR_TOKEN"))) {
      throw new HttpError(403, "Operator credentials were rejected");
    }
    const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
    return Response.json(
      {},
      {
        headers: {
          "cache-control": "no-store",
          "set-cookie": `rectify_operator_token=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${secure}`,
        },
      },
    );
  } catch (error: unknown) {
    return errorResponse(error);
  }
}
