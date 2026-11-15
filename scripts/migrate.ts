// Applies pending migrations and seeds the built-in defaults (categories, service catalog, settings row).
// The app does this by itself on first use; run this script when you want it done ahead of time
// (for example before the first request, or with MITYAF_AUTO_MIGRATE=0).
import path from "node:path";

try {
  process.loadEnvFile(path.join(process.cwd(), ".env"));
} catch {
  // no .env file — rely on the process environment
}

async function main() {
  const { getDb, migrationsFolder } = await import("../src/db");
  const { ensureDefaults } = await import("../src/modules/core/defaults");

  const url = process.env.DATABASE_URL?.trim();
  if (url) {
    const { default: postgres } = await import("postgres");
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    const client = postgres(url, { prepare: false, max: 1, onnotice: () => {} });
    await migrate(drizzle(client), { migrationsFolder: migrationsFolder() });
    await client.end();
    console.log("✓ migrations applied to", new URL(url).host);
  } else {
    console.log("✓ local database (PGlite) migrated under .data/");
  }

  // getDb() migrates PGlite itself; for Postgres it just connects.
  await ensureDefaults(await getDb());
  console.log("✓ defaults ensured");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
