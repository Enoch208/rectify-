import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getCaseResponseSchema,
  getCasesResponseSchema,
  getRunResponseSchema,
} from "../src/index.ts";
import {
  actionRecord,
  approvalRecord,
  caseRecord,
  evidenceRecord,
  outcomeEventRecord,
  runRecord,
  verificationRecord,
} from "./fixtures.ts";

void test("GET /api/cases response accepts a case summary", () => {
  const result = getCasesResponseSchema.safeParse({
    cases: [
      {
        id: caseRecord.id,
        organizationId: caseRecord.organizationId,
        tenantId: caseRecord.tenantId,
        contactId: caseRecord.contactId,
        contactEmail: caseRecord.contactEmail,
        workflow: caseRecord.workflow,
        state: caseRecord.state,
        engineeringState: caseRecord.engineeringState,
        notificationState: caseRecord.notificationState,
        recoveryState: caseRecord.recoveryState,
        syncState: caseRecord.syncState,
        updatedAt: caseRecord.updatedAt,
        environment: "LOCAL FIXTURE",
      },
    ],
    nextCursor: null,
  });

  assert.equal(result.success, true);
});

void test("GET /api/cases/:id response accepts complete case data", () => {
  const result = getCaseResponseSchema.safeParse({
    case: caseRecord,
    evidence: [evidenceRecord],
    verifications: [verificationRecord],
    actions: [actionRecord],
    approvals: [approvalRecord],
    outcomeEvents: [outcomeEventRecord],
  });

  assert.equal(result.success, true);
});

void test("GET /api/runs/:id response accepts observed run data", () => {
  const result = getRunResponseSchema.safeParse({
    run: runRecord,
    actions: [actionRecord],
    evidence: [evidenceRecord],
    verifications: [verificationRecord],
  });

  assert.equal(result.success, true);
});
