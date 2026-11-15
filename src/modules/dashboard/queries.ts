import { gte } from "drizzle-orm";
import { getDb } from "@/db";
import { sumOf } from "@/db/helpers";
import { timeLogs } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { addDays, currentMonth, lastMonths, monthRange, todayISO, weekStart } from "@/lib/format";
import { getSettings, listPartners } from "../core/queries";
import { stageMeta } from "../crm/constants";
import { listClients } from "../crm/queries";
import {
  expensesByCategory,
  getSettlement,
  listExpenses,
  listOperatingCosts,
  listPayments,
  monthlySeries,
  recordedOperatingCostIds,
  revenueByClient,
} from "../finance/queries";
import { assessWorkload } from "../pricing/engine";
import { costModelFrom } from "../pricing/model";
import { listQuotes } from "../pricing/queries";
import { listProjects } from "../projects/queries";

/** أهداف لوحة المؤشرات الأسبوعية كما في خطة الـ90 يوماً. */
export const WEEKLY_TARGETS = { newLeads: 5, quotesSent: 2, payingClients90d: 2, conversionPct: 30 };

export type DashboardAlert = { level: "danger" | "warning" | "info"; title: string; detail?: string; href: string };

export async function getDashboard() {
  await requireUser();
  const db = await getDb();
  const today = todayISO();
  const month = currentMonth();
  const months = lastMonths(6);
  const { from: monthFrom, to: monthTo } = monthRange(month);
  const week = weekStart(today);
  const ninetyDaysAgo = addDays(today, -90);

  const [settings, partners, series, categories, projects, clients, quotes, { settlement }, costs, recorded, concentration, recentExpenses, recentPayments, [weekHours]] =
    await Promise.all([
      getSettings(),
      listPartners(),
      monthlySeries(months),
      expensesByCategory(monthFrom, monthTo),
      listProjects(),
      listClients(),
      listQuotes(),
      getSettlement(),
      listOperatingCosts(),
      recordedOperatingCostIds(month),
      revenueByClient(ninetyDaysAgo, addDays(today, 1)),
      listExpenses({}, 6),
      listPayments({}, 6),
      db.select({ total: sumOf(timeLogs.hours) }).from(timeLogs).where(gte(timeLogs.date, week)),
    ]);

  const current = series[series.length - 1];
  const previous = series[series.length - 2];
  const annualOperatingCost = costs.filter((c) => c.active).reduce((s, c) => s + c.annual, 0);
  const model = costModelFrom(settings, partners, annualOperatingCost);
  const openProjects = projects.filter((p) => p.open);
  const workload = assessWorkload(
    openProjects.reduce((s, p) => s + p.remainingHours, 0),
    model.weeklyBillableHours,
  );
  const outstanding = projects.reduce((s, p) => s + p.outstanding, 0);
  const weeklyCapacity = partners.reduce((s, p) => s + p.weeklyHours, 0);

  // ── المؤشرات الأسبوعية ──
  const weekStartDate = new Date(`${week}T00:00:00+03:00`);
  const nonDraft = quotes.filter((q) => q.status !== "draft");
  const accepted = quotes.filter((q) => q.status === "accepted").length;
  const kpis = {
    newLeads: clients.filter((c) => c.createdAt >= weekStartDate).length,
    quotesSent: nonDraft.filter((q) => q.createdAt >= weekStartDate).length,
    payingClients90d: concentration.filter((c) => c.key !== "none" && c.value > 0).length,
    conversionPct: nonDraft.length ? (accepted / nonDraft.length) * 100 : null,
    hoursThisWeek: weekHours?.total ?? 0,
    weeklyCapacity,
  };

  // ── التنبيهات ──
  const alerts: DashboardAlert[] = [];
  const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
  const cap = settings.monthlyExpenseCap;
  if (cap > 0 && current.overhead >= cap) {
    alerts.push({ level: "danger", title: `المصروف التشغيلي تجاوز السقف الشهري بـ ${fmt(current.overhead - cap)} ${settings.currency}`, href: "/expenses" });
  } else if (cap > 0 && current.overhead >= cap * 0.8) {
    alerts.push({ level: "warning", title: `المصروف التشغيلي بلغ ${Math.round((current.overhead / cap) * 100)}٪ من السقف الشهري`, href: "/expenses" });
  }

  for (const p of projects) {
    if (p.billing === "one_time" && p.status !== "cancelled" && p.estimatedHours > 0 && p.overrunPct > settings.hoursOverrunAlertPct) {
      alerts.push({
        level: "danger",
        title: `«${p.name}» تجاوز ساعاته المقدّرة بـ ${Math.round(p.overrunPct)}٪`,
        detail: "الخلل في التقدير لا في التنفيذ: ارفعوا هامش المخاطرة في العروض المشابهة.",
        href: `/projects/${p.id}`,
      });
    }
  }

  const revenue90 = concentration.reduce((s, c) => s + c.value, 0);
  const top = concentration[0];
  if (top && top.key !== "none" && revenue90 > 0 && concentration.length > 0) {
    const share = (top.value / revenue90) * 100;
    if (share > settings.clientConcentrationAlertPct) {
      alerts.push({
        level: "warning",
        title: `${Math.round(share)}٪ من إيراد آخر 90 يوماً من عميل واحد (${top.label})`,
        detail: `الحد المتفق عليه ${settings.clientConcentrationAlertPct}٪. كثّفوا قنوات العملاء.`,
        href: "/reports",
      });
    }
  }

  if (workload.level === "full") {
    alerts.push({
      level: "warning",
      title: `الجدول ممتلئ: ${Math.round(workload.backlogWeeks)} أسبوع عمل ملتزم به`,
      detail: "قبول مشروع جديد يتجاوز الطاقة يتطلب موافقة الطرفين.",
      href: "/projects",
    });
  }

  const unsettled = [settlement.treasury, ...settlement.partners].filter((p) => Math.abs(p.balance) >= 1);
  if (unsettled.length) {
    const total = settlement.suggestions.reduce((s, x) => s + x.amount, 0);
    alerts.push({ level: "info", title: `تسوية معلّقة بين الشركاء والخزينة: ${fmt(total)} ${settings.currency}`, href: "/partners" });
  }

  const followUps = clients.filter((c) => stageMeta(c.stage).open && c.followUpDate && c.followUpDate <= today);
  if (followUps.length) {
    alerts.push({ level: "info", title: `${followUps.length} متابعة عميل حان موعدها`, detail: followUps.map((c) => c.name).slice(0, 3).join("، "), href: "/clients" });
  }

  const expired = quotes.filter((q) => q.status === "sent" && q.validUntil && q.validUntil < today);
  if (expired.length) {
    alerts.push({ level: "info", title: `${expired.length} عرض مُرسل انتهت صلاحيته دون رد`, href: "/pricing" });
  }

  const pendingCosts = costs.filter((c) => c.active && c.cycle === "monthly" && !recorded.has(c.id));
  if (pendingCosts.length) {
    alerts.push({ level: "info", title: `${pendingCosts.length} بند متكرر لم يُسجَّل هذا الشهر`, href: "/expenses" });
  }

  if (annualOperatingCost === 0) {
    alerts.push({ level: "info", title: "أضف التكاليف المتكررة ليصبح التسعير مبنياً على تكلفتكم الفعلية", href: "/expenses/recurring" });
  }

  // ── آخر الحركات ──
  const activity = [
    ...recentExpenses.map((e) => ({ id: `e-${e.id}`, date: e.date, label: e.description, sub: e.categoryName ?? "مصروف", amount: -e.amount })),
    ...recentPayments.map((p) => ({ id: `p-${p.id}`, date: p.date, label: p.projectName ?? "إيراد عام", sub: p.clientName ?? "دفعة مستلمة", amount: p.amount })),
  ]
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .slice(0, 7);

  return {
    settings,
    month,
    series,
    current,
    previous,
    categories,
    openProjects,
    outstanding,
    treasury: settlement.treasury,
    model,
    workload,
    kpis,
    alerts,
    activity,
    isEmpty: !projects.length && !clients.length && !recentExpenses.length && !recentPayments.length,
  };
}
