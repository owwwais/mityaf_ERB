<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Mityaf ERP conventions

- Modular monolith: each domain lives in `src/modules/<name>/` (`schema.ts`, `queries.ts`, `actions.ts`, `components/`). Navigation comes only from `src/modules/registry.ts`.
- Every query and Server Action starts with `requireUser()` (or `requireAdmin()`); pages are never the only auth check.
- Money logic is pure and unit-tested: `src/modules/pricing/engine.ts`, `src/modules/finance/distribution.ts`, `src/modules/finance/settlement.ts`. Change the tests with the logic and run `npm test`.
- Schema changes: edit the module's `schema.ts`, then `npm run db:generate`. Never hand-edit files in `drizzle/`.
- The database is Postgres everywhere: PGlite locally (no `DATABASE_URL`), any hosted Postgres otherwise. Do not add driver-specific SQL.
- UI is Arabic RTL. Use logical Tailwind utilities (`ps-`, `me-`, `start-`), format numbers and dates through `src/lib/format.ts`, and parse user-typed numbers through `src/lib/validation.ts` (Arabic digits are accepted).
- Visual identity mirrors mityaf.com; tokens are in `src/app/globals.css`. Use the tokens (`bg-surface`, `text-ink-2`, `border-line`, `rounded-sm|md|lg`) rather than raw colors.

