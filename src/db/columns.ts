import { numeric, timestamp, uuid } from "drizzle-orm/pg-core";

// Shared column builders so every module declares money, hours and ids the same way.
export const id = () => uuid().primaryKey().defaultRandom();
export const money = () => numeric({ precision: 14, scale: 2, mode: "number" });
export const pct = () => numeric({ precision: 6, scale: 2, mode: "number" });
export const hours = () => numeric({ precision: 8, scale: 2, mode: "number" });
export const createdAt = () => timestamp({ withTimezone: true }).notNull().defaultNow();
