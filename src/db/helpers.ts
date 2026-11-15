import { sql, type AnyColumn, type SQL } from "drizzle-orm";

/** مجموع عمود رقمي كعدد (Postgres يعيد numeric كنص). */
export const sumOf = (column: AnyColumn | SQL) => sql<number>`coalesce(sum(${column}), 0)`.mapWith(Number);

/** "YYYY-MM" من عمود تاريخ. */
export const monthOf = (column: AnyColumn) => sql<string>`to_char(${column}, 'YYYY-MM')`;
