import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite ships a WASM Postgres; keep it out of the bundler.
  serverExternalPackages: ["@electric-sql/pglite"],
  // Local (PGlite) mode applies migrations at runtime from this folder.
  outputFileTracingIncludes: { "/**": ["./drizzle/**/*"] },
};

export default nextConfig;
