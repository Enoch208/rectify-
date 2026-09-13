import assert from "node:assert/strict";
import { test } from "node:test";
import {
  actionRecordSchema,
  caseRecordSchema,
  csvExportExpectationSchema,
  environmentLabelSchema,
  outcomeEventRecordSchema,
} from "../src/index.ts";
import { actionRecord, caseRecord, outcomeEventRecord } from "./fixtures.ts";

void test("record schemas accept the frozen domain values", () => {
  assert.equal(caseRecordSchema.safeParse(caseRecord).success, true);
  assert.equal(actionRecordSchema.safeParse(actionRecord).success, true);
  assert.equal(outcomeEventRecordSchema.safeParse(outcomeEventRecord).success, true);
});

void test("environment labels reject unlabelled fixture evidence", () => {
  assert.equal(environmentLabelSchema.safeParse("live").success, false);
});

void test("csv-export-v1 permits a legitimate zero-row expectation", () => {
  const result = csvExportExpectationSchema.safeParse({
    schema: ["record_id", "tenant_id", "period", "amount", "status"],
    rows: [],
  });

  assert.equal(result.success, true);
});

void test("action states reject undeclared success labels", () => {
  assert.equal(
    actionRecordSchema.safeParse({ ...actionRecord, status: "SUCCEEDED" }).success,
    false,
  );
});
