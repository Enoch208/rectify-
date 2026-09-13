import type { z } from "zod";
import { HttpError } from "./errors.ts";

export const parseJsonBody = async <Output>(
  request: Request,
  schema: z.ZodType<Output>,
): Promise<Output> => {
  let decoded: unknown;
  try {
    decoded = await request.json();
  } catch {
    throw new HttpError(400, "Request body must be valid JSON");
  }
  const parsed = schema.safeParse(decoded);
  if (!parsed.success) {
    throw new HttpError(400, "Request body did not match the API contract");
  }
  return parsed.data;
};
