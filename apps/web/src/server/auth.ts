import { timingSafeEqual } from "node:crypto";
import { HttpError } from "./errors.ts";

const equal = (received: string, expected: string): boolean => {
  const receivedBytes = Buffer.from(received);
  const expectedBytes = Buffer.from(expected);
  return (
    receivedBytes.length === expectedBytes.length && timingSafeEqual(receivedBytes, expectedBytes)
  );
};

export const operatorTokenMatches = (received: string, configured: string): boolean =>
  configured
    .split(",")
    .map((token) => token.trim())
    .filter((token) => token.length > 0)
    .map((token) => equal(received, token))
    .includes(true);

export const requireOperator = (request: Request, expectedToken: string): void => {
  const authorization = request.headers.get("authorization");
  const prefix = "Bearer ";
  const bearer =
    authorization?.startsWith(prefix) === true ? authorization.slice(prefix.length) : null;
  const encodedCookie = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim().split("="))
    .find(([name]) => name === "rectify_operator_token")?.[1];
  let cookie: string | undefined;
  try {
    cookie = encodedCookie === undefined ? undefined : decodeURIComponent(encodedCookie);
  } catch {
    cookie = undefined;
  }
  const received = bearer ?? cookie;
  if (received === undefined) {
    throw new HttpError(401, "Operator authentication is required");
  }
  if (!operatorTokenMatches(received, expectedToken)) {
    throw new HttpError(401, "Operator credentials were rejected");
  }
};
