import { ProviderConfigurationError } from "./error.ts";

export interface CustomerMessage {
  from: string;
  to: string;
  subject: string;
  body: string;
  threadId: string;
  inReplyTo: string | null;
  logicalKey: string;
  rfc822MessageId: string;
}

const headerLine = (name: string, value: string): string => {
  if (/[\r\n]/u.test(value)) {
    throw new ProviderConfigurationError(`MIME header ${name} cannot contain line breaks`);
  }
  if (value.length === 0) {
    throw new ProviderConfigurationError(`MIME header ${name} cannot be empty`);
  }
  return `${name}: ${value}`;
};

export const buildCustomerMime = (message: CustomerMessage): string => {
  const threading =
    message.inReplyTo === null
      ? []
      : [headerLine("In-Reply-To", message.inReplyTo), headerLine("References", message.inReplyTo)];
  return [
    headerLine("From", message.from),
    headerLine("To", message.to),
    headerLine("Subject", message.subject),
    headerLine("Message-ID", `<${message.rfc822MessageId}>`),
    ...threading,
    headerLine("X-Rectify-Action", message.logicalKey),
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    message.body,
  ].join("\r\n");
};

const splitMime = (rawMime: string): { head: string; body: string } => {
  const separator = /\r?\n\r?\n/u.exec(rawMime);
  if (separator === null) {
    return { head: rawMime, body: "" };
  }
  return {
    head: rawMime.slice(0, separator.index),
    body: rawMime.slice(separator.index + separator[0].length),
  };
};

export const parseMimeHeaders = (rawMime: string): Record<string, string> => {
  const unfolded: string[] = [];
  for (const line of splitMime(rawMime).head.split(/\r?\n/u)) {
    const previous = unfolded.at(-1);
    if (/^[ \t]/u.test(line) && previous !== undefined) {
      unfolded[unfolded.length - 1] = `${previous}${line}`;
    } else {
      unfolded.push(line);
    }
  }
  const headers: Record<string, string> = {};
  for (const line of unfolded) {
    const colon = line.indexOf(":");
    if (colon < 1) {
      continue;
    }
    const name = line.slice(0, colon).trim().toLowerCase();
    if (!Object.hasOwn(headers, name)) {
      headers[name] = line.slice(colon + 1).trim();
    }
  }
  return headers;
};

export const parseMimeBody = (rawMime: string): string => splitMime(rawMime).body;

export const normalizeRfc822MessageId = (value: string): string =>
  value.trim().replace(/^<(.*)>$/u, "$1");
