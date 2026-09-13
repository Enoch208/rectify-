import { z } from "zod";
import { operatorTokenMatches } from "@/server/auth";
import { requireEnvironment } from "@/server/config";
import { errorResponse, HttpError } from "@/server/errors";
import { parseJsonBody } from "@/server/request";

const sessionRequestSchema = z.object({ token: z.string().min(1) });

const cookie = (value: string, maxAge: number): string => {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `rectify_operator_token=${encodeURIComponent(value)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${String(maxAge)}${secure}`;
};

export async function POST(request: Request) {
  try {
    const { token } = await parseJsonBody(request, sessionRequestSchema);
    if (!operatorTokenMatches(token, requireEnvironment("RECTIFY_OPERATOR_TOKEN"))) {
      throw new HttpError(403, "Operator credentials were rejected");
    }
    return Response.json(
      {},
      {
        headers: {
          "cache-control": "no-store",
          "set-cookie": cookie(token, 28_800),
        },
      },
    );
  } catch (error: unknown) {
    return errorResponse(error);
  }
}

export function DELETE() {
  return Response.json(
    {},
    {
      headers: {
        "cache-control": "no-store",
        "set-cookie": cookie("", 0),
      },
    },
  );
}
