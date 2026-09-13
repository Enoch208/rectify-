import type { DatabaseSync } from "node:sqlite";

export const migrateActionLedger = (database: DatabaseSync): void => {
  database.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS actions (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL,
      version INTEGER NOT NULL CHECK (version > 0),
      logical_key TEXT NOT NULL UNIQUE,
      provider TEXT NOT NULL,
      kind TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      payload_hash TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN (
        'PLANNED', 'AUTHORIZED', 'DISPATCHING', 'CONFIRMED',
        'OUTCOME_UNKNOWN', 'REJECTED', 'CONFIRMED_FAILED'
      )),
      provider_ids_json TEXT NOT NULL,
      uncertainty_reason TEXT,
      error TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    ) STRICT;
    CREATE TABLE IF NOT EXISTS action_attempts (
      action_id TEXT NOT NULL REFERENCES actions(id),
      number INTEGER NOT NULL CHECK (number > 0),
      started_at TEXT NOT NULL,
      finished_at TEXT,
      outcome TEXT CHECK (outcome IN ('CONFIRMED', 'OUTCOME_UNKNOWN', 'CONFIRMED_FAILED')),
      error TEXT,
      PRIMARY KEY (action_id, number)
    ) STRICT;
    CREATE TRIGGER IF NOT EXISTS actions_immutable_intent
    BEFORE UPDATE OF id, case_id, logical_key, provider, kind, payload_json, payload_hash
    ON actions
    BEGIN
      SELECT RAISE(ABORT, 'action intent is immutable');
    END;
    CREATE TRIGGER IF NOT EXISTS actions_valid_transition
    BEFORE UPDATE OF status ON actions
    WHEN NOT (
      (OLD.status = 'PLANNED' AND NEW.status IN ('AUTHORIZED', 'REJECTED')) OR
      (OLD.status = 'AUTHORIZED' AND NEW.status IN ('DISPATCHING', 'REJECTED')) OR
      (OLD.status = 'DISPATCHING' AND NEW.status IN ('CONFIRMED', 'OUTCOME_UNKNOWN', 'CONFIRMED_FAILED')) OR
      (OLD.status = 'OUTCOME_UNKNOWN' AND NEW.status IN ('CONFIRMED', 'CONFIRMED_FAILED'))
    )
    BEGIN
      SELECT RAISE(ABORT, 'invalid action state transition');
    END;
  `);
};
