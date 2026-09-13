import { AmbiguousIntakeError, StatusError } from "@rectify/store";

export { StatusError as HttpError };

export const errorResponse = (error: unknown): Response => {
  if (error instanceof AmbiguousIntakeError) {
    return Response.json({ error: error.message, tenantIds: error.tenantIds }, { status: 409 });
  }
  if (error instanceof StatusError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  return Response.json({ error: "Internal server error" }, { status: 500 });
};
