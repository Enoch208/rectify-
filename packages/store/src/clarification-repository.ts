import { z } from "zod";
import type { StoreContext } from "./context.ts";

export const tenantClarificationSchema = z.object({
  gmailThreadId: z.string().min(1),
  tenantId: z.string().min(1),
  operatorId: z.string().min(1),
  resolvedAt: z.string().min(1),
});

export type TenantClarification = z.infer<typeof tenantClarificationSchema>;

const rowSchema = z.object({
  gmail_thread_id: z.string(),
  tenant_id: z.string(),
  operator_id: z.string(),
  resolved_at: z.string(),
});

export class ClarificationRepository {
  readonly #context: StoreContext;

  constructor(context: StoreContext) {
    this.#context = context;
  }

  record(gmailThreadId: string, tenantId: string, operatorId: string): TenantClarification {
    const existing = this.find(gmailThreadId);
    if (existing !== null) {
      return existing;
    }
    const resolvedAt = this.#context.now().toISOString();
    this.#context.database
      .prepare("INSERT INTO tenant_clarifications VALUES (?, ?, ?, ?)")
      .run(gmailThreadId, tenantId, operatorId, resolvedAt);
    return { gmailThreadId, tenantId, operatorId, resolvedAt };
  }

  find(gmailThreadId: string): TenantClarification | null {
    const row = this.#context.database
      .prepare("SELECT * FROM tenant_clarifications WHERE gmail_thread_id = ?")
      .get(gmailThreadId);
    if (row === undefined) {
      return null;
    }
    const parsed = rowSchema.parse(row);
    return {
      gmailThreadId: parsed.gmail_thread_id,
      tenantId: parsed.tenant_id,
      operatorId: parsed.operator_id,
      resolvedAt: parsed.resolved_at,
    };
  }
}
