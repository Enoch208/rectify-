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

export class ReportDeskStore {
  readonly #configs = new Map<string, TenantConfig>();
  readonly #auditEvents: ConfigAuditEvent[] = [];
  readonly #outcomeEvents = new Map<string, OutcomeEventRecord>();

  constructor(configs: readonly TenantConfig[]) {
    for (const config of configs) {
      this.#configs.set(config.tenantId, { ...config });
    }
  }

  getConfig(tenantId: string): TenantConfig {
    const config = this.#configs.get(tenantId);
    if (config === undefined) {
      throw new Error(`Unknown tenant: ${tenantId}`);
    }
    return { ...config };
  }

  applyDemoFix(
    tenantId: string,
    actorId: string,
    occurredAt: string,
    eventId: string,
  ): TenantConfig {
    const current = this.getConfig(tenantId);
    const updated = {
      ...current,
      fixedPathEnabled: true,
      revision: current.revision + 1,
    };
    this.#configs.set(tenantId, updated);
    this.#auditEvents.push({
      id: eventId,
      tenantId,
      kind: "HUMAN_APPLIED_DEMO_CONFIGURATION_FIX",
      actorId,
      fromRevision: current.revision,
      toRevision: updated.revision,
      occurredAt,
    });
    return { ...updated };
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

  getOutcomeEvents(): OutcomeEventRecord[] {
    return [...this.#outcomeEvents.values()];
  }
}

export const initialTenantConfigs: readonly TenantConfig[] = [
  { tenantId: "northstar", fixedPathEnabled: false, revision: 1 },
  { tenantId: "harbor", fixedPathEnabled: true, revision: 1 },
  { tenantId: "quiet-labs", fixedPathEnabled: true, revision: 1 },
];
