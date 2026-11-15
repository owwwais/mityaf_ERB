import { date, pgTable, text } from "drizzle-orm/pg-core";
import { createdAt, id, money } from "../../db/columns";

export const clients = pgTable("clients", {
  id: id(),
  name: text().notNull(),
  contactName: text().notNull().default(""),
  phone: text().notNull().default(""),
  email: text().notNull().default(""),
  sector: text().notNull().default(""),
  source: text().notNull().default("direct"),
  stage: text().notNull().default("new"),
  expectedValue: money().notNull().default(0),
  interest: text().notNull().default(""),
  need: text().notNull().default(""),
  nextStep: text().notNull().default(""),
  followUpDate: date({ mode: "string" }),
  notes: text().notNull().default(""),
  createdAt: createdAt(),
});

export type Client = typeof clients.$inferSelect;
