import assert from "node:assert/strict";
import { test } from "node:test";
import { operatorTokenMatches, requireOperator } from "./auth.ts";
import { HttpError } from "./errors.ts";

void test("operator authentication accepts bearer and encoded same-origin cookie tokens", () => {
  requireOperator(
    new Request("https://rectify.example/api/cases", {
      headers: { authorization: "Bearer token with spaces" },
    }),
    "token with spaces",
  );
  requireOperator(
    new Request("https://rectify.example/api/cases", {
      headers: { cookie: "rectify_operator_token=token%20with%20spaces" },
    }),
    "token with spaces",
  );
  assert.throws(() => {
    requireOperator(
      new Request("https://rectify.example/api/cases", {
        headers: { cookie: "rectify_operator_token=wrong" },
      }),
      "token with spaces",
    );
  }, HttpError);
});

void test("a separate revocable operator token is accepted alongside the primary token", () => {
  const configured = "primary-token, judge-token";
  for (const token of ["primary-token", "judge-token"]) {
    requireOperator(
      new Request("https://rectify.example/api/cases", {
        headers: { authorization: `Bearer ${token}` },
      }),
      configured,
    );
  }
  assert.equal(operatorTokenMatches("", configured), false);
  assert.throws(() => {
    requireOperator(
      new Request("https://rectify.example/api/cases", {
        headers: { authorization: "Bearer revoked-token" },
      }),
      configured,
    );
  }, HttpError);
});
