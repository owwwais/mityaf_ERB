import { and, asc, desc, eq, gte, ilike, isNotNull, isNull, lt, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb } from "@/db";
import { monthOf, sumOf } from "@/db/helpers";
import { clients, expenseCategories, expenses, operatingCosts, partners, payments, projects, transfers } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { monthRange } from "@/lib/format";
import { getSettings, listPartners } from "../core/queries";
import { annualize } from "./constants";
import { computeSettlement } from "./settlement";

export async function listCategories() {
  await requireUser();
  const db = await getDb();
  return db.select().from(expenseCategories).orderBy(asc(expenseCategories.sort), asc(expenseCategories.name));
}

// ───────────────────────── التكاليف المتكررة ─────────────────────────

export async function listOperatingCosts() {
  await requireUser();
  const db = await getDb();
  const rows = await db
    .select({
      id: operatingCosts.id,
      name: operatingCosts.name,
      categoryId: operatingCosts.categoryId,
      categoryName: expenseCategories.name,
      amount: operatingCosts.amount,
      cycle: operatingCosts.cycle,
      active: operatingCosts.active,
      notes: operatingCosts.notes,
    })
    .from(operatingCosts)
    .leftJoin(expenseCategories, eq(operatingCosts.categoryId, expenseCategories.id))
    .orderBy(desc(operatingCosts.active), asc(operatingCosts.createdAt));
  return rows.map((r) => ({ ...r, annual: annualize(r.amount, r.cycle) }));
}

/** مجموع التكاليف التشغيلية السنوية الفعّالة: مدخل محرك التسعير. */
export async function getAnnualOperatingCost(): Promise<number> {
  const rows = await listOperatingCosts();
  return rows.filter((r) => r.active).reduce((s, r) => s + r.annual, 0);
}

// ───────────────────────── المصروفات ─────────────────────────

export type ExpenseFilter = {
  month?: string;
  categoryId?: string;
  projectId?: string;
  /** "treasury" أو معرّف شريك */
  paidBy?: string;
  /** "overhead" = بلا مشروع، "direct" = على مشروع */
  scope?: string;
  q?: string;
};

function expenseWhere(f: ExpenseFilter): SQL | undefined {
  const conds: (SQL | undefined)[] = [];
  if (f.month) {
    const { from, to } = monthRange(f.month);
    conds.push(gte(expenses.date, from), lt(expenses.date, to));
  }
  if (f.categoryId) conds.push(eq(expenses.categoryId, f.categoryId));
  if (f.projectId) conds.push(eq(expenses.projectId, f.projectId));
  if (f.paidBy === "treasury") conds.push(isNull(expenses.paidBy));
  else if (f.paidBy) conds.push(eq(expenses.paidBy, f.paidBy));
  if (f.scope === "overhead") conds.push(isNull(expenses.projectId));
  if (f.scope === "direct") conds.push(isNotNull(expenses.projectId));
  if (f.q) conds.push(or(ilike(expenses.description, `%${f.q}%`), ilike(expenses.vendor, `%${f.q}%`)));
  return and(...conds);
}

export async function listExpenses(filter: ExpenseFilter = {}, limit = 500) {
  await requireUser();
  const db = await getDb();
  return db
    .select({
      id: expenses.id,
      date: expenses.date,
      amount: expenses.amount,
      description: expenses.description,
      vendor: expenses.vendor,
      method: expenses.method,
      notes: expenses.notes,
      categoryId: expenses.categoryId,
      categoryName: expenseCategories.name,
      projectId: expenses.projectId,
      projectName: projects.name,
      paidBy: expenses.paidBy,
      paidByName: partners.name,
      operatingCostId: expenses.operatingCostId,
    })
    .from(expenses)
    .leftJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
    .leftJoin(projects, eq(expenses.projectId, projects.id))
    .leftJoin(partners, eq(expenses.paidBy, partners.id))
    .where(expenseWhere(filter))
    .orderBy(desc(expenses.date), desc(expenses.createdAt))
    .limit(limit);
}

export type ExpenseRow = Awaited<ReturnType<typeof listExpenses>>[number];

export async function expensesByCategory(from: string, to: string) {
  await requireUser();
  const db = await getDb();
  const rows = await db
    .select({ id: expenseCategories.id, name: expenseCategories.name, total: sumOf(expenses.amount) })
    .from(expenses)
    .leftJoin(expenseCategories, eq(expenses.categoryId, expenseCategories.id))
    .where(and(gte(expenses.date, from), lt(expenses.date, to)))
    .groupBy(expenseCategories.id, expenseCategories.name);
  return rows
    .map((r) => ({ key: r.id ?? "none", label: r.name ?? "بلا فئة", value: r.total }))
    .sort((a, b) => b.value - a.value);
}

/** معرّفات التكاليف المتكررة التي سُجّلت في الشهر المعطى. */
export async function recordedOperatingCostIds(month: string): Promise<Set<string>> {
  const db = await getDb();
  const { from, to } = monthRange(month);
  const rows = await db
    .selectDistinct({ id: expenses.operatingCostId })
    .from(expenses)
    .where(and(isNotNull(expenses.operatingCostId), gte(expenses.date, from), lt(expenses.date, to)));
  return new Set(rows.map((r) => r.id).filter((id): id is string => !!id));
}

// ───────────────────────── الإيرادات ─────────────────────────

export async function listPayments(filter: { month?: string; projectId?: string; from?: string; to?: string } = {}, limit = 500) {
  await requireUser();
  const db = await getDb();
  const conds: SQL[] = [];
  if (filter.month) {
    const { from, to } = monthRange(filter.month);
    conds.push(gte(payments.date, from), lt(payments.date, to));
  }
  if (filter.from) conds.push(gte(payments.date, filter.from));
  if (filter.to) conds.push(lt(payments.date, filter.to));
  if (filter.projectId) conds.push(eq(payments.projectId, filter.projectId));
  const projectClient = alias(clients, "project_client");
  return db
    .select({
      id: payments.id,
      date: payments.date,
      amount: payments.amount,
      kind: payments.kind,
      method: payments.method,
      notes: payments.notes,
      projectId: payments.projectId,
      projectName: projects.name,
      clientId: sql<string | null>`coalesce(${payments.clientId}, ${projects.clientId})`,
      clientName: sql<string | null>`coalesce(${clients.name}, ${projectClient.name})`,
      receivedBy: payments.receivedBy,
      receivedByName: partners.name,
    })
    .from(payments)
    .leftJoin(projects, eq(payments.projectId, projects.id))
    .leftJoin(clients, eq(payments.clientId, clients.id))
    .leftJoin(projectClient, eq(projects.clientId, projectClient.id))
    .leftJoin(partners, eq(payments.receivedBy, partners.id))
    .where(and(...conds))
    .orderBy(desc(payments.date), desc(payments.createdAt))
    .limit(limit);
}

export type PaymentRow = Awaited<ReturnType<typeof listPayments>>[number];

// ───────────────────────── ملخصات شهرية ─────────────────────────

export type MonthTotals = { month: string; revenue: number; expenses: number; overhead: number; direct: number; net: number };

/** إيراد ومصروف كل شهر في القائمة (أساس نقدي). */
export async function monthlySeries(months: string[]): Promise<MonthTotals[]> {
  await requireUser();
  if (!months.length) return [];
  const db = await getDb();
  const from = `${months[0]}-01`;
  const to = monthRange(months[months.length - 1]).to;

  const [rev, exp] = await Promise.all([
    db
      .select({ month: monthOf(payments.date), total: sumOf(payments.amount) })
      .from(payments)
      .where(and(gte(payments.date, from), lt(payments.date, to)))
      .groupBy(monthOf(payments.date)),
    db
      .select({
        month: monthOf(expenses.date),
        total: sumOf(expenses.amount),
        direct: sumOf(sql`case when ${expenses.projectId} is not null then ${expenses.amount} else 0 end`),
      })
      .from(expenses)
      .where(and(gte(expenses.date, from), lt(expenses.date, to)))
      .groupBy(monthOf(expenses.date)),
  ]);

  const revBy = new Map(rev.map((r) => [r.month, r.total]));
  const expBy = new Map(exp.map((r) => [r.month, r]));
  return months.map((month) => {
    const revenue = revBy.get(month) ?? 0;
    const e = expBy.get(month);
    const total = e?.total ?? 0;
    const direct = e?.direct ?? 0;
    return { month, revenue, expenses: total, direct, overhead: total - direct, net: revenue - total };
  });
}

export async function monthTotals(month: string): Promise<MonthTotals> {
  return (await monthlySeries([month]))[0];
}

/** إيراد كل عميل في فترة (لقياس تركّز الإيراد). */
export async function revenueByClient(from: string, to: string) {
  const rows = await listPayments({ from, to }, 5000);
  const map = new Map<string, { key: string; label: string; value: number }>();
  for (const r of rows) {
    const key = r.clientId ?? "none";
    const entry = map.get(key) ?? { key, label: r.clientName ?? "بلا عميل", value: 0 };
    entry.value += r.amount;
    map.set(key, entry);
  }
  return [...map.values()].sort((a, b) => b.value - a.value);
}

// ───────────────────────── التسوية ─────────────────────────

export async function listTransfers() {
  await requireUser();
  const db = await getDb();
  const from = alias(partners, "from_partner");
  const to = alias(partners, "to_partner");
  return db
    .select({
      id: transfers.id,
      date: transfers.date,
      amount: transfers.amount,
      notes: transfers.notes,
      fromPartnerId: transfers.fromPartnerId,
      toPartnerId: transfers.toPartnerId,
      fromName: from.name,
      toName: to.name,
    })
    .from(transfers)
    .leftJoin(from, eq(transfers.fromPartnerId, from.id))
    .leftJoin(to, eq(transfers.toPartnerId, to.id))
    .orderBy(desc(transfers.date), desc(transfers.createdAt));
}

export async function getSettlement() {
  await requireUser();
  const db = await getDb();
  const [settings, partnerRows, projectRows, paymentRows, expenseRows, transferRows] = await Promise.all([
    getSettings(),
    listPartners({ includeInactive: true }),
    db.select({ id: projects.id, name: projects.name, type: projects.type, finderId: projects.finderId, executorId: projects.executorId }).from(projects),
    db.select({ amount: payments.amount, projectId: payments.projectId, receivedBy: payments.receivedBy }).from(payments),
    db.select({ amount: expenses.amount, projectId: expenses.projectId, paidBy: expenses.paidBy }).from(expenses),
    db.select({ amount: transfers.amount, from: transfers.fromPartnerId, to: transfers.toPartnerId }).from(transfers),
  ]);
  const settlement = computeSettlement({
    rules: settings,
    // الشريك غير النشط لا يدخل في قسمة المشاريع المشتركة الجديدة لكن مركزه يبقى ظاهراً.
    partners: partnerRows.map((p) => ({ id: p.id, name: p.name, sharePct: p.active ? p.profitSharePct : 0 })),
    projects: projectRows,
    payments: paymentRows,
    expenses: expenseRows,
    transfers: transferRows,
  });
  return { settlement, projects: projectRows, partners: partnerRows, settings };
}
