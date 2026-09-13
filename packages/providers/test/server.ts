import { once } from "node:events";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

export interface RecordedRequest {
  method: string;
  url: string;
  authorization: string | undefined;
  body: unknown;
}

export interface ProviderReply {
  status: number;
  payload: unknown;
}

export type Route = (request: RecordedRequest) => ProviderReply | undefined;

export interface ProviderServer {
  baseUrl: string;
  requests: RecordedRequest[];
  close: () => void;
}

export const send = (response: ServerResponse, status: number, payload: unknown): void => {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(payload));
};

const readBody = async (request: IncomingMessage): Promise<unknown> => {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  const text = Buffer.concat(chunks).toString("utf8");
  return text.length === 0 ? null : (JSON.parse(text) as unknown);
};

export const listen = async (route: Route): Promise<ProviderServer> => {
  const requests: RecordedRequest[] = [];
  const server = createServer((request, response) => {
    void readBody(request).then((body) => {
      const recorded: RecordedRequest = {
        method: request.method ?? "",
        url: request.url ?? "",
        authorization: request.headers.authorization,
        body,
      };
      requests.push(recorded);
      const reply = route(recorded) ?? { status: 404, payload: { error: "unexpected request" } };
      send(response, reply.status, reply.payload);
    });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${String(address.port)}`,
    requests,
    close: () => {
      server.closeAllConnections();
      server.close();
    },
  };
};

export const ok = (payload: unknown): ProviderReply => ({ status: 200, payload });

export const encode = (value: string): string => Buffer.from(value, "utf8").toString("base64url");
