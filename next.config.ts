import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite ships a WASM Postgres; keep it out of the bundler.
  serverExternalPackages: ["@electric-sql/pglite"],
  // Migrations are applied at runtime from this folder, so it must ship with every server route.
  outputFileTracingIncludes: { "/*": ["./drizzle/**/*"], "/**": ["./drizzle/**/*"] },
};

export default nextConfig;
