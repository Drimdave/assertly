import { mkdirSync } from "node:fs"
import path from "node:path"

import { neon } from "@neondatabase/serverless"
import { PGlite } from "@electric-sql/pglite"
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http"
import { drizzle as drizzlePglite } from "drizzle-orm/pglite"
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator"
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core"

import * as schema from "./schema"

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>

/**
 * Database access. With DATABASE_URL set (Neon in production) it talks to Postgres over HTTP. Without it, it
 * runs PGlite, a real Postgres compiled to WebAssembly, stored in .data/pglite (or in memory with
 * PGLITE_DIR=memory://). That keeps local development and tests free of any external service.
 *
 * Nothing connects at import time (Next imports route modules during the build), only on first use.
 */
const MIGRATIONS = path.join(process.cwd(), "drizzle")

interface Handle {
  db: Db
  ready: Promise<void>
}

const globalForDb = globalThis as unknown as { __assertlyDb?: Handle }

/** Opens PGlite on a folder, creating it (and its parents) first: PGlite will not make `.data/` itself. */
export function openPglite(dir: string): PGlite {
  if (dir === "memory://") return new PGlite()
  mkdirSync(dir, { recursive: true })
  return new PGlite(dir)
}

function create(): Handle {
  const url = process.env.DATABASE_URL
  if (url) {
    const db = drizzleNeon(neon(url), { schema })
    // Production schema changes are applied deliberately with `npm run db:migrate`, not on a cold start
    return { db: db as unknown as Db, ready: Promise.resolve() }
  }
  const dir = process.env.PGLITE_DIR ?? ".data/pglite"
  const client = openPglite(dir)
  const db = drizzlePglite(client, { schema })
  return { db: db as unknown as Db, ready: migratePglite(db, { migrationsFolder: MIGRATIONS }) }
}

function handle(): Handle {
  return (globalForDb.__assertlyDb ??= create())
}

/** The database, once migrations have run. Await this in every request handler that touches data. */
export async function getDb(): Promise<Db> {
  const h = handle()
  await h.ready
  return h.db
}

/** For libraries that need a database object up front (Better Auth). Callers must await getDb() first. */
export function dbUnsafe(): Db {
  return handle().db
}

export { schema }
