import type { OutcomeEventRecord } from "@rectify/core";

export interface TenantConfig {
  tenantId: string;
  fixedPathEnabled: boolean;
  revision: number;
}

export interface ConfigAuditEvent {
  id: string;
  tenantId: string;
  kind: "HUMAN_APPLIED_DEMO_CONFIGURATION_FIX";
  actorId: string;
  fromRevision: number;
  toRevision: number;
  occurredAt: string;
}

export interface OutcomeDelivery {
  eventId: string;
  status: "DELIVERED" | "FAILED";
  httpStatus: number | null;
  error: string | null;
  attemptedAt: string;
}

export class UnknownTenantError extends Error {
  constructor(tenantId: string) {
    super(`Unknown tenant: ${tenantId}`);
    this.name = "UnknownTenantError";
  }
}

export class ReportDeskStore {
  readonly #configs = new Map<string, TenantConfig>();
  readonly #auditEvents: ConfigAuditEvent[] = [];
  readonly #outcomeEvents = new Map<string, OutcomeEventRecord>();
  readonly #deliveries: OutcomeDelivery[] = [];

  constructor(configs: readonly TenantConfig[]) {
    this.#loadConfigs(configs);
  }

  #loadConfigs(configs: readonly TenantConfig[]): void {
    this.#configs.clear();
    for (const config of configs) {
      this.#configs.set(config.tenantId, { ...config });
    }
  }

  getConfig(tenantId: string): TenantConfig {
    const config = this.#configs.get(tenantId);
    if (config === undefined) {
      throw new UnknownTenantError(tenantId);
    }
    return { ...config };
  }

  getTenantIds(): string[] {
    return [...this.#configs.keys()];
  }

  applyDemoFix(
    tenantId: string,
    actorId: string,
    occurredAt: string,
    eventId: string,
  ): { config: TenantConfig; auditEvent: ConfigAuditEvent } {
    const current = this.getConfig(tenantId);
    const updated = {
      ...current,
      fixedPathEnabled: true,
      revision: current.revision + 1,
    };
    const auditEvent: ConfigAuditEvent = {
      id: eventId,
      tenantId,
      kind: "HUMAN_APPLIED_DEMO_CONFIGURATION_FIX",
      actorId,
      fromRevision: current.revision,
      toRevision: updated.revision,
      occurredAt,
    };
    this.#configs.set(tenantId, updated);
    this.#auditEvents.push(auditEvent);
    return { config: { ...updated }, auditEvent: { ...auditEvent } };
  }

  getAuditEvents(): ConfigAuditEvent[] {
    return this.#auditEvents.map((event) => ({ ...event }));
  }

  recordOutcomeEvent(event: OutcomeEventRecord): void {
    if (this.#outcomeEvents.has(event.eventId)) {
      throw new Error(`Duplicate outcome event: ${event.eventId}`);
    }
    this.#outcomeEvents.set(event.eventId, event);
  }

  getOutcomeEvent(eventId: string): OutcomeEventRecord | undefined {
    return this.#outcomeEvents.get(eventId);
  }

  getOutcomeEvents(): OutcomeEventRecord[] {
    return [...this.#outcomeEvents.values()];
  }

  recordDelivery(delivery: OutcomeDelivery): void {
    this.#deliveries.push({ ...delivery });
  }

  getDeliveries(): OutcomeDelivery[] {
    return this.#deliveries.map((delivery) => ({ ...delivery }));
  }

  reset(configs: readonly TenantConfig[]): void {
    this.#loadConfigs(configs);
    this.#auditEvents.splice(0);
    this.#outcomeEvents.clear();
    this.#deliveries.splice(0);
  }
}

export const initialTenantConfigs: readonly TenantConfig[] = [
  { tenantId: "northstar", fixedPathEnabled: false, revision: 1 },
  { tenantId: "harbor", fixedPathEnabled: true, revision: 1 },
  { tenantId: "quiet-labs", fixedPathEnabled: true, revision: 1 },
];
