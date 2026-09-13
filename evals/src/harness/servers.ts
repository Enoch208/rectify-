import { once } from "node:events";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { outcomeEventRecordSchema } from "@rectify/core";
import { verifyOutcomeEvent } from "@rectify/core/outcomes";
import { StatusError, type Store } from "@rectify/store";

export interface OutcomeDeliveryRecord {
  eventId: string | null;
  httpStatus: number;
  reason: string | null;
}

export const listen = async (server: Server): Promise<string> => {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Harness server did not bind a TCP port");
  }
  return `http://127.0.0.1:${String(address.port)}`;
};

export const closeServer = (server: Server): Promise<void> =>
  new Promise((resolve, reject) => {
    server.closeAllConnections();
    server.close((error) => {
      if (error === undefined) {
        resolve();
      } else {
        reject(error);
      }
    });
  });

const readBody = (request: IncomingMessage): Promise<string> =>
  new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf8"));
    });
    request.on("error", reject);
  });

const acceptEvent = (store: Store, secret: string, raw: string): OutcomeDeliveryRecord => {
  const parsed = outcomeEventRecordSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    return { eventId: null, httpStatus: 400, reason: "Outcome event did not match the contract" };
  }
  const event = parsed.data;
  if (!verifyOutcomeEvent(event, secret)) {
    return { eventId: event.eventId, httpStatus: 401, reason: "Outcome signature is invalid" };
  }
  if (event.actorType !== "CUSTOMER") {
    return { eventId: event.eventId, httpStatus: 403, reason: "Only customer outcomes count" };
  }
  if (store.cases.getCase(event.caseId).tenantId !== event.tenantId) {
    return {
      eventId: event.eventId,
      httpStatus: 403,
      reason: "Outcome tenant is not the case tenant",
    };
  }
  store.outcomes.saveCustomerOutcome(event);
  return { eventId: event.eventId, httpStatus: 200, reason: null };
};

const failureFor = (error: unknown): OutcomeDeliveryRecord => {
  if (error instanceof StatusError) {
    return { eventId: null, httpStatus: error.status, reason: error.message };
  }
  if (error instanceof SyntaxError) {
    return { eventId: null, httpStatus: 400, reason: "Outcome event body is not JSON" };
  }
  return {
    eventId: null,
    httpStatus: 500,
    reason: error instanceof Error ? error.message : "Outcome event handling failed",
  };
};

const respond = (
  response: ServerResponse,
  deliveries: OutcomeDeliveryRecord[],
  delivery: OutcomeDeliveryRecord,
): void => {
  deliveries.push(delivery);
  response
    .writeHead(delivery.httpStatus, { "content-type": "application/json" })
    .end(JSON.stringify({ accepted: delivery.httpStatus === 200, reason: delivery.reason }));
};

export const createOutcomeEventsServer = (
  store: Store,
  secret: string,
  deliveries: OutcomeDeliveryRecord[],
): Server =>
  createServer((request, response) => {
    readBody(request)
      .then((raw) => {
        respond(response, deliveries, acceptEvent(store, secret, raw));
      })
      .catch((error: unknown) => {
        respond(response, deliveries, failureFor(error));
      });
  });
