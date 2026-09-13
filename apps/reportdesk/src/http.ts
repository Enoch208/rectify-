import { timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { z } from "zod";
import type { RouteContext } from "./context.ts";
import type { ExportResponse } from "./export.ts";

const maxBodyBytes = 64_000;

export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

export const matchesSecret = (received: string | undefined, expected: string): boolean => {
  if (received === undefined) {
    return false;
  }
  const left = Buffer.from(received);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
};

export const bearerToken = (request: IncomingMessage): string | undefined => {
  const authorization = request.headers.authorization;
  return authorization?.startsWith("Bearer ") ? authorization.slice(7) : undefined;
};

export const requireBearer = (context: RouteContext, expected: string, label: string): boolean => {
  if (matchesSecret(bearerToken(context.request), expected)) {
    return true;
  }
  sendJson(context.response, 401, { error: `Unauthorized ${label}` });
  return false;
};

const readBody = async (request: IncomingMessage): Promise<string> => {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
    size += buffer.length;
    if (size > maxBodyBytes) {
      throw new HttpError(413, "Request body too large");
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
};

export const readJsonBody = async <Schema extends z.ZodType>(
  request: IncomingMessage,
  schema: Schema,
): Promise<z.infer<Schema>> => {
  const text = await readBody(request);
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new HttpError(400, "Request body must be valid JSON");
  }
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new HttpError(400, parsed.error.issues.map((issue) => issue.message).join("; "));
  }
  return parsed.data;
};

export const sendJson = (
  response: ServerResponse,
  status: number,
  value: unknown,
  headers: Record<string, string> = {},
): void => {
  response.writeHead(status, { ...headers, "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(value));
};

export const sendExport = (
  response: ServerResponse,
  result: ExportResponse,
  headers: Record<string, string> = {},
): void => {
  response.writeHead(result.httpStatus, {
    ...headers,
    "content-type": result.contentType,
    "x-request-id": result.requestId,
    "x-tenant-id": result.tenantId,
    "x-period": result.period,
    "x-manifest-revision": String(result.manifestRevision),
    "x-app-revision": String(result.appRevision),
    "x-config-revision": String(result.configRevision),
  });
  response.end(result.body);
};

export const pageSecurityPolicy =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'";

export const sendHtml = (response: ServerResponse, status: number, html: string): void => {
  response.writeHead(status, {
    "content-type": "text/html; charset=utf-8",
    "content-security-policy": pageSecurityPolicy,
    "x-frame-options": "DENY",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
  });
  response.end(html);
};
