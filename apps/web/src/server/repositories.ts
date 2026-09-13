import { openStore, type Store } from "@rectify/store";
import { requireEnvironment } from "./config.ts";

export type Repositories = Store;

export const openRepositories = (): Repositories =>
  openStore({ path: requireEnvironment("RECTIFY_DB_PATH") });
