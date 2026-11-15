import fs from "node:fs";
import path from "node:path";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import * as schema from "./schema";

// Both drivers expose the same query API; the PGlite type stands in for either.
export type DB = PgliteDatabase<typeof schema>;
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];

const globalStore = globalThis as unknown as { __mityafDb?: Promise<DB> };

export const dataDir = () => process.env.MITYAF_DATA_DIR ?? path.join(process.cwd(), ".data");
export const migrationsFolder = () => path.join(process.cwd(), "drizzle");

/**
 * DATABASE_URL set  → any hosted Postgres (Neon, Supabase, RDS…).
 * DATABASE_URL empty → embedded Postgres (PGlite) persisted under .data/.
 * Either way pending migrations are applied on first use, so a deploy needs no extra step.
 * Set MITYAF_AUTO_MIGRATE=0 to manage the hosted schema yourself with `npm run db:migrate`.
 */
async function connect(): Promise<DB> {
  const url = process.env.DATABASE_URL?.trim();
  if (url) {
    const { default: postgres } = await import("postgres");
    const { drizzle } = await import("drizzle-orm/postgres-js");
    // prepare:false keeps us compatible with transaction-mode poolers (Supabase, PgBouncer).
    const client = postgres(url, { prepare: false, max: 5, idle_timeout: 20, onnotice: () => {} });
    const db = drizzle(client, { schema, casing: "snake_case" });
    if (process.env.MITYAF_AUTO_MIGRATE !== "0") {
      const { migrate } = await import("drizzle-orm/postgres-js/migrator");
      try {
        await migrate(db, { migrationsFolder: migrationsFolder() });
      } catch {
        // Two cold starts can race on the very first deploy; the loser retries once the winner has committed.
        await new Promise((resolve) => setTimeout(resolve, 1500));
        await migrate(db, { migrationsFolder: migrationsFolder() });
      }
    }
    return db as unknown as DB;
  }

  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const dir = path.join(dataDir(), "pglite");
  fs.mkdirSync(dir, { recursive: true });
  const db = drizzle(new PGlite(dir), { schema, casing: "snake_case" });
  await migrate(db, { migrationsFolder: migrationsFolder() });
  return db;
}

export function getDb(): Promise<DB> {
  if (!globalStore.__mityafDb) {
    globalStore.__mityafDb = connect().catch((error) => {
      globalStore.__mityafDb = undefined;
      throw error;
    });
  }
  return globalStore.__mityafDb;
}

export { schema };
