// Every module owns its tables; this file is the single place they are assembled.
// To add a module: create src/modules/<name>/schema.ts and re-export it here.
export * from "../modules/core/schema";
export * from "../modules/crm/schema";
export * from "../modules/pricing/schema";
export * from "../modules/projects/schema";
export * from "../modules/finance/schema";
