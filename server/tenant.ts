import { AsyncLocalStorage } from 'node:async_hooks';
import type Database from 'better-sqlite3';
export const tenantScope = new AsyncLocalStorage<Database.Database>();
