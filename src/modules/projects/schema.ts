import { date, index, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { createdAt, hours, id, money } from "../../db/columns";
import { partners } from "../core/schema";
import { clients } from "../crm/schema";
import { quotes } from "../pricing/schema";

export const projects = pgTable("projects", {
  id: id(),
  name: text().notNull(),
  clientId: uuid().references(() => clients.id, { onDelete: "set null" }),
  quoteId: uuid().references(() => quotes.id, { onDelete: "set null" }),
  /** مشترك: يُقسم الصافي بحصص الشركاء. فردي: جالب + منفّذ + الشركة. */
  type: text().$type<"joint" | "individual">().notNull().default("joint"),
  billing: text().$type<"one_time" | "monthly">().notNull().default("one_time"),
  finderId: uuid().references(() => partners.id, { onDelete: "set null" }),
  executorId: uuid().references(() => partners.id, { onDelete: "set null" }),
  status: text().notNull().default("active"),
  price: money().notNull().default(0),
  estimatedHours: hours().notNull().default(0),
  startDate: date({ mode: "string" }),
  dueDate: date({ mode: "string" }),
  notes: text().notNull().default(""),
  createdAt: createdAt(),
});

export const timeLogs = pgTable(
  "time_logs",
  {
    id: id(),
    projectId: uuid()
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    partnerId: uuid()
      .notNull()
      .references(() => partners.id, { onDelete: "restrict" }),
    date: date({ mode: "string" }).notNull(),
    hours: hours().notNull(),
    note: text().notNull().default(""),
    createdAt: createdAt(),
  },
  (t) => [index("time_logs_project_idx").on(t.projectId), index("time_logs_date_idx").on(t.date)],
);

export type Project = typeof projects.$inferSelect;
export type TimeLog = typeof timeLogs.$inferSelect;
