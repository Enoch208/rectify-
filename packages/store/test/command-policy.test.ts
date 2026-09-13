import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import type { CaseState } from "@rectify/core";
import { openStore, StatusError as HttpError } from "../src/index.ts";
import { environments, identity, now } from "./fixtures.ts";

const withDatabase = (operation: (path: string) => void): void => {
  const directory = mkdtempSync(join(tmpdir(), "rectify-command-"));
  try {
    operation(join(directory, "state.sqlite"));
  } finally {
    rmSync(directory, { recursive: true });
  }
};

void test("investigate is accepted only from NEW and intake resumes by thread", () => {
  withDatabase((path) => {
    const store = openStore({ path, now: () => now, createId: () => "id-1" });
    const cases = store.cases;
    try {
      const record = cases.createOrResume(identity, environments);
      assert.equal(cases.createOrResume(identity, environments).id, record.id);
      cases.queue(record.id, "INVESTIGATE");
      assert.equal(cases.getCase(record.id).state, "INVESTIGATING");
      assert.throws(() => cases.queue(record.id, "INVESTIGATE"), HttpError);
    } finally {
      store.close();
    }
  });
});

for (const state of [
  "WAITING_ENGINEERING",
  "NEEDS_HUMAN",
] as const satisfies readonly CaseState[]) {
  void test(`recheck is accepted from ${state}`, () => {
    withDatabase((path) => {
      const store = openStore({ path, now: () => now, createId: () => "id-1" });
      const { cases, records } = store;
      try {
        const record = cases.createOrResume(identity, environments);
        records.saveCase({
          ...record,
          state,
          needsHumanReason: state === "NEEDS_HUMAN" ? "Operator decision required" : null,
          resumeState: state === "NEEDS_HUMAN" ? "WAITING_ENGINEERING" : null,
        });
        cases.queue(record.id, "RECHECK");
        assert.equal(cases.getCase(record.id).state, "INVESTIGATING");
      } finally {
        store.close();
      }
    });
  });
}

void test("recheck rejects NEW and unknown cases", () => {
  withDatabase((path) => {
    const store = openStore({ path, now: () => now, createId: () => "id-1" });
    const cases = store.cases;
    try {
      const record = cases.createOrResume(identity, environments);
      assert.throws(() => cases.queue(record.id, "RECHECK"), HttpError);
      assert.throws(() => cases.queue("unknown", "RECHECK"), HttpError);
    } finally {
      store.close();
    }
  });
});
