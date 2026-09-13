import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { AmbiguousIntakeError, openStore, resolveIntake, StatusError } from "../src/index.ts";
import { identity, now } from "./fixtures.ts";

const directory = [
  identity,
  { ...identity, tenantId: "northstar-labs", contactEmail: "maya@northstar-labs.example" },
];

void test("an ambiguous thread requires an operator choice that is recorded and reused", () => {
  const folder = mkdtempSync(join(tmpdir(), "rectify-intake-"));
  const store = openStore({ path: join(folder, "state.sqlite"), now: () => now });
  try {
    const base = {
      directory,
      clarifications: store.clarifications,
      gmailThreadId: identity.gmailThreadId,
      operatorId: "operator-1",
    };
    assert.throws(
      () => resolveIntake({ ...base, tenantId: null }),
      (error: unknown) =>
        error instanceof AmbiguousIntakeError &&
        error.tenantIds.join(",") === "northstar,northstar-labs",
    );
    assert.throws(() => resolveIntake({ ...base, tenantId: "attacker" }), StatusError);
    assert.equal(
      resolveIntake({ ...base, tenantId: "northstar" }).contactEmail,
      identity.contactEmail,
    );
    assert.equal(resolveIntake({ ...base, tenantId: null }).tenantId, "northstar");
    assert.equal(resolveIntake({ ...base, tenantId: "northstar-labs" }).tenantId, "northstar");
    assert.equal(store.clarifications.find(identity.gmailThreadId)?.operatorId, "operator-1");
    assert.throws(
      () => resolveIntake({ ...base, gmailThreadId: "unknown-thread", tenantId: null }),
      (error: unknown) => error instanceof StatusError && error.status === 403,
    );
  } finally {
    store.close();
    rmSync(folder, { recursive: true });
  }
});
