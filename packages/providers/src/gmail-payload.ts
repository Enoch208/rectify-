import { z } from "zod";
import type { GmailMessage } from "./contracts.ts";

export interface GmailPayloadPart {
  mimeType?: string | undefined;
  filename?: string | undefined;
  headers?: { name: string; value: string }[] | undefined;
  body?: { data?: string | undefined } | undefined;
  parts?: GmailPayloadPart[] | undefined;
}

export const gmailPayloadPartSchema: z.ZodType<GmailPayloadPart> = z.lazy(() =>
  z.object({
    mimeType: z.string().optional(),
    filename: z.string().optional(),
    headers: z.array(z.object({ name: z.string(), value: z.string() })).optional(),
    body: z.object({ data: z.string().optional() }).optional(),
    parts: z.array(gmailPayloadPartSchema).optional(),
  }),
);

export const gmailFullMessageSchema = z.object({
  id: z.string().min(1),
  threadId: z.string().min(1),
  labelIds: z.array(z.string()).optional(),
  snippet: z.string().optional(),
  payload: gmailPayloadPartSchema,
});

export const gmailFullThreadSchema = z.object({
  id: z.string().min(1),
  historyId: z.string().min(1).optional(),
  messages: z.array(gmailFullMessageSchema),
});

export const encodeBase64Url = (value: string): string =>
  Buffer.from(value, "utf8").toString("base64url");

export const decodeBase64Url = (value: string): string =>
  Buffer.from(value, "base64url").toString("utf8");

const headerValue = (part: GmailPayloadPart, name: string): string | null =>
  part.headers?.find((header) => header.name.toLowerCase() === name)?.value ?? null;

export const findPlainText = (part: GmailPayloadPart): string | null => {
  const isAttachment = part.filename !== undefined && part.filename.length > 0;
  if (part.mimeType === "text/plain" && !isAttachment && part.body?.data !== undefined) {
    return decodeBase64Url(part.body.data);
  }
  for (const child of part.parts ?? []) {
    const text = findPlainText(child);
    if (text !== null) {
      return text;
    }
  }
  return null;
};

export const toGmailMessage = (message: z.infer<typeof gmailFullMessageSchema>): GmailMessage => ({
  id: message.id,
  threadId: message.threadId,
  ...(message.labelIds === undefined ? {} : { labelIds: message.labelIds }),
  ...(message.snippet === undefined ? {} : { snippet: message.snippet }),
  from: headerValue(message.payload, "from"),
  to: headerValue(message.payload, "to"),
  subject: headerValue(message.payload, "subject"),
  date: headerValue(message.payload, "date"),
  bodyText: findPlainText(message.payload),
});
