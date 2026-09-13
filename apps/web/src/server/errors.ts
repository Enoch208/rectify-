import { StatusError } from "@rectify/store";

export { StatusError as HttpError };

export const errorResponse = (error: unknown): Response => {
  if (error instanceof StatusError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  return Response.json({ error: "Internal server error" }, { status: 500 });
};
