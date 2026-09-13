import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getCaseResponseSchema,
  getCasesResponseSchema,
  getRunResponseSchema,
  getRunsResponseSchema,
  postCaseRequestSchema,
  postCaseResponseSchema,
  queuedJobResponseSchema,
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
    environments: runRecord.environments,
    evidence: [evidenceRecord],
    verifications: [verificationRecord],
    actions: [actionRecord],
    approvals: [approvalRecord],
    outcomeEvents: [outcomeEventRecord],
  });

  assert.equal(result.success, true);
});

void test("POST /api/cases request requires a Gmail thread id", () => {
  assert.equal(postCaseRequestSchema.safeParse({ gmailThreadId: "thread-1" }).success, true);
  assert.equal(postCaseRequestSchema.safeParse({ gmailThreadId: "" }).success, false);
});

void test("command responses expose created cases and queued job IDs", () => {
  assert.equal(postCaseResponseSchema.safeParse({ case: caseRecord }).success, true);
  assert.equal(queuedJobResponseSchema.safeParse({ jobId: "job-1" }).success, true);
  assert.equal(queuedJobResponseSchema.safeParse({ jobId: "" }).success, false);
});

void test("GET /api/runs response accepts observed runs", () => {
  const result = getRunsResponseSchema.safeParse({ runs: [runRecord], nextCursor: null });

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
