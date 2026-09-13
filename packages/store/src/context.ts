import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { migrateCaseDatabase } from "./database.ts";

export interface StoreContext {
  readonly path: string;
  readonly database: DatabaseSync;
  readonly now: () => Date;
  readonly createId: () => string;
}

export interface StoreOptions {
  path: string;
  now?: () => Date;
  createId?: () => string;
}

export const openStoreContext = (options: StoreOptions): StoreContext => {
  const database = new DatabaseSync(options.path, { allowExtension: false });
  migrateCaseDatabase(database);
  database.enableDefensive(true);
  return {
    path: options.path,
    database,
    now: options.now ?? (() => new Date()),
    createId: options.createId ?? randomUUID,
  };
};
