import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildCustomerMime,
  parseMimeBody,
  parseMimeHeaders,
  ProviderConfigurationError,
} from "../src/index.ts";
import { customerMessage } from "./fixture-data.ts";

void test("buildCustomerMime writes exact CRLF headers and round-trips through the parsers", () => {
  const message = customerMessage();
  const rawMime = buildCustomerMime(message);

  assert.equal(
    rawMime,
    [
      "From: support@reportdesk.example",
      "To: maya@northstar.example",
      "Subject: Re: Empty CSV export",
      "Message-ID: <case-1.v1@rectify.test>",
      "In-Reply-To: <original@northstar.example>",
      "References: <original@northstar.example>",
      "X-Rectify-Action: case-1:send-customer-reply:v1",
      "MIME-Version: 1.0",
      'Content-Type: text/plain; charset="UTF-8"',
      "Content-Transfer-Encoding: 8bit",
      "",
      message.body,
    ].join("\r\n"),
  );
  assert.deepEqual(parseMimeHeaders(rawMime), {
    from: message.from,
    to: message.to,
    subject: message.subject,
    "message-id": "<case-1.v1@rectify.test>",
    "in-reply-to": "<original@northstar.example>",
    references: "<original@northstar.example>",
    "x-rectify-action": message.logicalKey,
    "mime-version": "1.0",
    "content-type": 'text/plain; charset="UTF-8"',
    "content-transfer-encoding": "8bit",
  });
  assert.equal(parseMimeBody(rawMime), message.body);
});

void test("buildCustomerMime omits threading headers for a new conversation", () => {
  const headers = parseMimeHeaders(buildCustomerMime(customerMessage({ inReplyTo: null })));
  assert.equal(headers["in-reply-to"], undefined);
  assert.equal(headers.references, undefined);
});

void test("buildCustomerMime rejects header injection through any header field", () => {
  const injections = [
    { to: "maya@northstar.example\r\nBcc: attacker@example.test" },
    { subject: "Hello\nBcc: attacker@example.test" },
    { from: "support@reportdesk.example\r" },
    { inReplyTo: "<a@b>\nX-Evil: 1" },
    { logicalKey: "key\r\nX-Rectify-Action: other" },
    { rfc822MessageId: "id@rectify.test>\r\nBcc: attacker@example.test" },
  ];
  for (const injection of injections) {
    assert.throws(() => buildCustomerMime(customerMessage(injection)), ProviderConfigurationError);
  }
});

void test("parseMimeHeaders unfolds continuation lines and stops at the first blank line", () => {
  const rawMime =
    "Subject: A long\r\n\tfolded subject\r\nX-Rectify-Action: k1\n\nBody-Header: not a header\r\n";
  assert.deepEqual(parseMimeHeaders(rawMime), {
    subject: "A long\tfolded subject",
    "x-rectify-action": "k1",
  });
  assert.equal(parseMimeBody(rawMime), "Body-Header: not a header\r\n");
  assert.equal(parseMimeBody("Subject: no body"), "");
});
