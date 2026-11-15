import { boolean, date, index, integer, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { createdAt, id, money } from "../../db/columns";
import { partners, users } from "../core/schema";
import { clients } from "../crm/schema";
import { projects } from "../projects/schema";

export const expenseCategories = pgTable("expense_categories", {
  id: id(),
  name: text().notNull().unique(),
  sort: integer().notNull().default(0),
  createdAt: createdAt(),
});

/** التكاليف التشغيلية المتكررة: أساس «التكاليف السنوية» في محرك التسعير. */
export const operatingCosts = pgTable("operating_costs", {
  id: id(),
  name: text().notNull(),
  categoryId: uuid().references(() => expenseCategories.id, { onDelete: "set null" }),
  amount: money().notNull(),
  cycle: text().$type<"monthly" | "quarterly" | "yearly">().notNull().default("monthly"),
  active: boolean().notNull().default(true),
  notes: text().notNull().default(""),
  createdAt: createdAt(),
});

export const expenses = pgTable(
  "expenses",
  {
    id: id(),
    date: date({ mode: "string" }).notNull(),
    amount: money().notNull(),
    categoryId: uuid().references(() => expenseCategories.id, { onDelete: "set null" }),
    description: text().notNull(),
    vendor: text().notNull().default(""),
    /** فارغ = مصروف تشغيلي عام. غير فارغ = تكلفة مباشرة على المشروع. */
    projectId: uuid().references(() => projects.id, { onDelete: "set null" }),
    /** فارغ = دُفع من خزينة الشركة. غير فارغ = دفعه الشريك من جيبه. */
    paidBy: uuid().references(() => partners.id, { onDelete: "set null" }),
    method: text().notNull().default("transfer"),
    operatingCostId: uuid().references(() => operatingCosts.id, { onDelete: "set null" }),
    notes: text().notNull().default(""),
    createdBy: uuid().references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("expenses_date_idx").on(t.date), index("expenses_project_idx").on(t.projectId)],
);

/** المقبوضات (أساس نقدي): كل مبلغ دخل فعلاً. */
export const payments = pgTable(
  "payments",
  {
    id: id(),
    date: date({ mode: "string" }).notNull(),
    amount: money().notNull(),
    projectId: uuid().references(() => projects.id, { onDelete: "set null" }),
    clientId: uuid().references(() => clients.id, { onDelete: "set null" }),
    kind: text().notNull().default("down_payment"),
    /** فارغ = دخل حساب الشركة. غير فارغ = استلمه الشريك في حسابه الشخصي. */
    receivedBy: uuid().references(() => partners.id, { onDelete: "set null" }),
    method: text().notNull().default("transfer"),
    notes: text().notNull().default(""),
    createdBy: uuid().references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("payments_date_idx").on(t.date), index("payments_project_idx").on(t.projectId)],
);

/** تحويلات التسوية بين الشركاء والخزينة. فارغ = الخزينة. */
export const transfers = pgTable("transfers", {
  id: id(),
  date: date({ mode: "string" }).notNull(),
  amount: money().notNull(),
  fromPartnerId: uuid().references(() => partners.id, { onDelete: "set null" }),
  toPartnerId: uuid().references(() => partners.id, { onDelete: "set null" }),
  notes: text().notNull().default(""),
  createdAt: createdAt(),
});

export type ExpenseCategory = typeof expenseCategories.$inferSelect;
export type OperatingCost = typeof operatingCosts.$inferSelect;
export type Expense = typeof expenses.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type Transfer = typeof transfers.$inferSelect;
