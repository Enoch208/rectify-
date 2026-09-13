import type { z } from "zod";

export type ContractResult<T> =
  | { readonly kind: "loading" }
  | { readonly kind: "ok"; readonly data: T }
  | { readonly kind: "not-connected"; readonly path: string }
  | { readonly kind: "unauthorized"; readonly message: string }
  | { readonly kind: "error"; readonly message: string };

export type CommandResult<T> =
  | { readonly kind: "accepted"; readonly data: T }
  | { readonly kind: "not-connected"; readonly path: string }
  | { readonly kind: "unauthorized"; readonly message: string }
  | { readonly kind: "rejected"; readonly status: number; readonly message: string };

function isJson(response: Response): boolean {
  return response.headers.get("content-type")?.includes("application/json") ?? false;
}

function isUnauthorized(response: Response): boolean {
  return response.status === 401 || response.status === 403;
}

async function errorMessage(response: Response): Promise<string> {
  if (!isJson(response)) {
    return `The API answered ${String(response.status)}.`;
  }
  const body: unknown = await response.json();
  if (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof body.error === "string"
  ) {
    return body.error;
  }
  return `The API answered ${String(response.status)}.`;
}

export async function fetchContract<T>(
  path: string,
  schema: z.ZodType<T>,
  signal: AbortSignal,
): Promise<ContractResult<T>> {
  const response = await fetch(path, {
    signal,
    cache: "no-store",
    credentials: "same-origin",
    headers: { accept: "application/json" },
  });
  if (response.status === 404 && !isJson(response)) {
    return { kind: "not-connected", path };
  }
  if (isUnauthorized(response)) {
    return { kind: "unauthorized", message: await errorMessage(response) };
  }
  if (!response.ok) {
    return { kind: "error", message: await errorMessage(response) };
  }
  const parsed = schema.safeParse(await response.json());
  if (!parsed.success) {
    return { kind: "error", message: `The response from ${path} did not match the contract.` };
  }
  return { kind: "ok", data: parsed.data };
}

export async function postContract<T>(
  path: string,
  body: unknown,
  schema: z.ZodType<T>,
): Promise<CommandResult<T>> {
  const response = await fetch(path, {
    method: "POST",
    credentials: "same-origin",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (response.status === 404 && !isJson(response)) {
    return { kind: "not-connected", path };
  }
  if (isUnauthorized(response)) {
    return { kind: "unauthorized", message: await errorMessage(response) };
  }
  if (!response.ok) {
    return { kind: "rejected", status: response.status, message: await errorMessage(response) };
  }
  const parsed = schema.safeParse(await response.json());
  if (!parsed.success) {
    return {
      kind: "rejected",
      status: response.status,
      message: `The response from ${path} did not match the contract.`,
    };
  }
  return { kind: "accepted", data: parsed.data };
}

export function describeFailure(error: unknown): string {
  return error instanceof Error ? error.message : "The API could not be reached.";
}
