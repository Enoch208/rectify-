import type { OutcomeEventRecord } from "@rectify/core";
import type { ReportDeskContext } from "./context.ts";
import type { OutcomeDelivery } from "./store.ts";

const deliveryTimeoutMs = 5_000;

const attemptDelivery = async (
  url: string,
  event: OutcomeEventRecord,
  attemptedAt: string,
): Promise<OutcomeDelivery> => {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(event),
      signal: AbortSignal.timeout(deliveryTimeoutMs),
    });
    await response.arrayBuffer();
    return response.ok
      ? {
          eventId: event.eventId,
          status: "DELIVERED",
          httpStatus: response.status,
          error: null,
          attemptedAt,
        }
      : {
          eventId: event.eventId,
          status: "FAILED",
          httpStatus: response.status,
          error: `Product events endpoint responded with HTTP ${String(response.status)}`,
          attemptedAt,
        };
  } catch (error: unknown) {
    return {
      eventId: event.eventId,
      status: "FAILED",
      httpStatus: null,
      error: error instanceof Error ? error.message : "Delivery request failed",
      attemptedAt,
    };
  }
};

export const deliverOutcomeEvent = async (
  desk: ReportDeskContext,
  event: OutcomeEventRecord,
): Promise<OutcomeDelivery> => {
  const delivery = await attemptDelivery(desk.productEventsUrl, event, desk.now().toISOString());
  desk.store.recordDelivery(delivery);
  return delivery;
};

export const deliveryHeaderValue = (delivery: OutcomeDelivery): string => {
  if (delivery.status === "DELIVERED") {
    return "delivered";
  }
  return delivery.httpStatus === null ? "failed-network" : `failed-${String(delivery.httpStatus)}`;
};
