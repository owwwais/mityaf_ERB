import { boolean, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createdAt, hours, id, money, pct } from "../../db/columns";

/** الشركاء: أصحاب الطاقة التشغيلية وحصص الأرباح. */
export const partners = pgTable("partners", {
  id: id(),
  name: text().notNull(),
  title: text().notNull().default(""),
  weeklyHours: hours().notNull().default(15),
  /** السعر الحقيقي لساعة الشريك (تكلفة الفرصة)، لا سعر البيع. */
  hourlyCost: money().notNull().default(100),
  /** حصته من أرباح المشاريع المشتركة. */
  profitSharePct: pct().notNull().default(50),
  active: boolean().notNull().default(true),
  sort: integer().notNull().default(0),
  createdAt: createdAt(),
});

export const users = pgTable("users", {
  id: id(),
  name: text().notNull(),
  email: text().notNull().unique(),
  passwordHash: text().notNull(),
  role: text().$type<"admin" | "member">().notNull().default("member"),
  partnerId: uuid().references(() => partners.id, { onDelete: "set null" }),
  createdAt: createdAt(),
});

/** صف واحد (id = 1) يحمل قواعد الشركة المالية والتسعيرية. */
export const settings = pgTable("settings", {
  id: integer().primaryKey().default(1),
  companyName: text().notNull().default("مطياف"),
  currency: text().notNull().default("ر.س"),

  monthlyRevenueTarget: money().notNull().default(5000),
  monthlyExpenseCap: money().notNull().default(1000),

  // توزيع العوائد
  treasuryPct: pct().notNull().default(20),
  finderPct: pct().notNull().default(20),
  executorPct: pct().notNull().default(60),

  // التسعير
  targetMarginPct: pct().notNull().default(30),
  minMarginPct: pct().notNull().default(30),
  defaultRiskPct: pct().notNull().default(15),
  downPaymentPct: pct().notNull().default(50),
  meterOpeningFee: money().notNull().default(100),
  meterHourlyRate: money().notNull().default(150),
  vatEnabled: boolean().notNull().default(false),
  vatPct: pct().notNull().default(15),
  quoteValidityDays: integer().notNull().default(14),
  quoteTerms: text()
    .notNull()
    .default("دفعة مقدمة عند التعاقد والباقي عند التسليم. أي طلب خارج النطاق المذكور يُسعَّر بشكل مستقل."),

  // السعة التشغيلية
  workingWeeks: integer().notNull().default(48),
  utilizationPct: pct().notNull().default(60),

  // حدود التنبيه
  hoursOverrunAlertPct: pct().notNull().default(20),
  clientConcentrationAlertPct: pct().notNull().default(50),

  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export type Partner = typeof partners.$inferSelect;
export type User = typeof users.$inferSelect;
export type Settings = typeof settings.$inferSelect;
