import assert from "node:assert/strict";
import { test } from "node:test";
import { pageSecurityPolicy } from "../src/http.ts";
import { startCapture, startDesk, stop } from "./harness.ts";

const assertPageHeaders = (response: Response): void => {
  assert.equal(response.headers.get("content-security-policy"), pageSecurityPolicy);
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.match(response.headers.get("content-type") ?? "", /text\/html/u);
};

const assertNoComments = (html: string): void => {
  assert.doesNotMatch(html, /\/\/|\/\*|<!--/u);
};

void test("customer page renders the export form with escaped case reference", async () => {
  const capture = await startCapture();
  const { server, baseUrl } = await startDesk(capture.url);
  try {
    const hostile = '"><script>alert(1)</script>';
    const response = await fetch(`${baseUrl}/customer?case=${encodeURIComponent(hostile)}`);
    const html = await response.text();

    assert.equal(response.status, 200);
    assertPageHeaders(response);
    assert.match(html, /<title>ReportDesk<\/title>/u);
    assert.match(html, /Monthly report export/u);
    assert.match(html, /Customer session token/u);
    assert.match(html, /<option value="2026-08">2026-08<\/option>/u);
    assert.match(html, /Export CSV/u);
    assert.match(html, /data-case-id="&quot;&gt;&lt;script&gt;alert\(1\)&lt;\/script&gt;"/u);
    assert.doesNotMatch(html, /<script>alert/u);
    assert.doesNotMatch(html, /<p[^>]*>Signed in as/u);
    assertNoComments(html);
  } finally {
    stop(server);
    stop(capture.server);
  }
});

void test("customer page without a case shows an error instead of the form", async () => {
  const capture = await startCapture();
  const { server, baseUrl } = await startDesk(capture.url);
  try {
    const response = await fetch(`${baseUrl}/customer`);
    const html = await response.text();

    assert.equal(response.status, 400);
    assertPageHeaders(response);
    assert.match(html, /missing its case reference/u);
    assert.doesNotMatch(html, /Export CSV/u);
    assert.doesNotMatch(html, /<script>/u);
  } finally {
    stop(server);
    stop(capture.server);
  }
});

void test("operator page lists tenants and labels the change as human-applied", async () => {
  const capture = await startCapture();
  const { server, baseUrl } = await startDesk(capture.url);
  try {
    const response = await fetch(`${baseUrl}/operator`);
    const html = await response.text();

    assert.equal(response.status, 200);
    assertPageHeaders(response);
    assert.match(html, /<title>ReportDesk operator<\/title>/u);
    assert.match(html, /Human-applied configuration fix/u);
    assert.match(
      html,
      /This is a human-applied demo configuration change, not an agent-authored patch or deployment\./u,
    );
    for (const tenantId of ["northstar", "harbor", "quiet-labs"]) {
      assert.match(html, new RegExp(`<option value="${tenantId}">${tenantId}</option>`, "u"));
    }
    assert.match(html, /Enable corrected export path/u);
    assert.match(html, /type="password"/u);
    assertNoComments(html);
  } finally {
    stop(server);
    stop(capture.server);
  }
});
