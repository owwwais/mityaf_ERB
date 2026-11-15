import { boolean, date, integer, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createdAt, hours, id, money, pct } from "../../db/columns";
import { users } from "../core/schema";
import { clients } from "../crm/schema";
import type { QuoteInput, QuoteResult } from "./engine";

/** كتالوج الخدمات والمنتجات. baseValue = «القيمة الأدنى للمنتج» في قاعدة التسعير. */
export const services = pgTable("services", {
  id: id(),
  name: text().notNull(),
  kind: text().$type<"service" | "product" | "consulting">().notNull().default("service"),
  description: text().notNull().default(""),
  baseValue: money().notNull().default(0),
  typicalHours: hours().notNull().default(0),
  active: boolean().notNull().default(true),
  sort: integer().notNull().default(0),
  createdAt: createdAt(),
});

export const quotes = pgTable("quotes", {
  id: id(),
  number: text().notNull().unique(),
  title: text().notNull(),
  clientId: uuid().references(() => clients.id, { onDelete: "set null" }),
  serviceId: uuid().references(() => services.id, { onDelete: "set null" }),
  status: text().$type<"draft" | "sent" | "accepted" | "rejected">().notNull().default("draft"),
  /** مدخلات الحاسبة كما أُدخلت. */
  inputs: jsonb().$type<QuoteInput>().notNull(),
  /** لقطة النتيجة ونموذج التكلفة وقت الحفظ، حتى لا يتغيّر عرض مُرسل بتغيّر الإعدادات. */
  result: jsonb().$type<QuoteResult>().notNull(),
  price: money().notNull().default(0),
  totalHours: hours().notNull().default(0),
  totalCost: money().notNull().default(0),
  marginPct: pct().notNull().default(0),
  validUntil: date({ mode: "string" }),
  scopeIncluded: text().notNull().default(""),
  scopeExcluded: text().notNull().default(""),
  notes: text().notNull().default(""),
  createdBy: uuid().references(() => users.id, { onDelete: "set null" }),
  createdAt: createdAt(),
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export type Service = typeof services.$inferSelect;
export type Quote = typeof quotes.$inferSelect;
