// Deletes the LOCAL embedded database (.data/pglite). Never touches a hosted Postgres.
import fs from "node:fs";
import path from "node:path";

try {
  process.loadEnvFile(path.join(process.cwd(), ".env"));
} catch {
  // no .env file
}

if (process.env.DATABASE_URL?.trim()) {
  console.error("DATABASE_URL is set: refusing to reset. This script only clears the local PGlite database.");
  process.exit(1);
}

const dir = path.join(process.env.MITYAF_DATA_DIR ?? path.join(process.cwd(), ".data"), "pglite");
fs.rmSync(dir, { recursive: true, force: true });
console.log("✓ removed", dir, "— stop and restart the server; it will be recreated empty on the next request.");
