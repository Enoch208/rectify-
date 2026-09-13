import type { ZodType } from "zod";
import { ProviderRequestError } from "./error.ts";

export const providerUrl = (baseUrl: string, path: string): URL => {
  const normalized = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(path.replace(/^\//u, ""), normalized);
};

export const requestJson = async <Output>(
  url: URL,
  init: RequestInit,
  schema: ZodType<Output>,
): Promise<Output> => {
  const response = await fetch(url, init);
  const text = await response.text();
  if (!response.ok) {
    throw new ProviderRequestError(
      `Provider request failed with HTTP ${String(response.status)}: ${text.slice(0, 300)}`,
      response.status,
    );
  }
  let payload: unknown;
  try {
    payload = JSON.parse(text) as unknown;
  } catch (error: unknown) {
    const reason = error instanceof Error ? error.message : "invalid JSON";
    throw new ProviderRequestError(`Provider returned invalid JSON: ${reason}`, response.status);
  }
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new ProviderRequestError(
      `Provider response failed validation: ${parsed.error.message}`,
      response.status,
    );
  }
  return parsed.data;
};
