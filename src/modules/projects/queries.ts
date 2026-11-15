import { desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { sumOf } from "@/db/helpers";
import { clients, expenses, partners, payments, projects, timeLogs } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { PROJECT_STATUSES, type ProjectStatus } from "./constants";

export type ProjectSummary = Awaited<ReturnType<typeof listProjects>>[number];

/** المشاريع مع ما حُصّل وما صُرف وما سُجّل من ساعات. */
export async function listProjects() {
  await requireUser();
  const db = await getDb();
  const [rows, paid, spent, logged] = await Promise.all([
    db
      .select({
        id: projects.id,
        name: projects.name,
        clientId: projects.clientId,
        clientName: clients.name,
        quoteId: projects.quoteId,
        type: projects.type,
        billing: projects.billing,
        finderId: projects.finderId,
        executorId: projects.executorId,
        status: projects.status,
        price: projects.price,
        estimatedHours: projects.estimatedHours,
        startDate: projects.startDate,
        dueDate: projects.dueDate,
        notes: projects.notes,
        createdAt: projects.createdAt,
      })
      .from(projects)
      .leftJoin(clients, eq(projects.clientId, clients.id))
      .orderBy(desc(projects.createdAt)),
    db.select({ id: payments.projectId, total: sumOf(payments.amount) }).from(payments).groupBy(payments.projectId),
    db.select({ id: expenses.projectId, total: sumOf(expenses.amount) }).from(expenses).groupBy(expenses.projectId),
    db.select({ id: timeLogs.projectId, total: sumOf(timeLogs.hours) }).from(timeLogs).groupBy(timeLogs.projectId),
  ]);
  const paidBy = new Map(paid.map((r) => [r.id, r.total]));
  const spentBy = new Map(spent.map((r) => [r.id, r.total]));
  const loggedBy = new Map(logged.map((r) => [r.id, r.total]));
  return rows.map((p) => {
    const collected = paidBy.get(p.id) ?? 0;
    const hoursLogged = loggedBy.get(p.id) ?? 0;
    const open = PROJECT_STATUSES[p.status as ProjectStatus]?.open ?? true;
    return {
      ...p,
      open,
      collected,
      directCost: spentBy.get(p.id) ?? 0,
      hoursLogged,
      // الباقات الشهرية لا «متبقٍ» لها: تُحصَّل شهراً بشهر.
      outstanding: p.billing === "monthly" || p.status === "cancelled" ? 0 : Math.max(p.price - collected, 0),
      overrunPct: p.estimatedHours > 0 ? ((hoursLogged - p.estimatedHours) / p.estimatedHours) * 100 : 0,
      remainingHours: open && p.billing === "one_time" ? Math.max(p.estimatedHours - hoursLogged, 0) : 0,
    };
  });
}

export async function projectOptions(opts: { openOnly?: boolean } = {}) {
  const rows = await listProjects();
  return rows.filter((p) => !opts.openOnly || p.open).map((p) => ({ value: p.id, label: p.name }));
}

export async function getProject(id: string) {
  const all = await listProjects();
  return all.find((p) => p.id === id) ?? null;
}

export async function listTimeLogs(projectId: string) {
  await requireUser();
  const db = await getDb();
  return db
    .select({
      id: timeLogs.id,
      date: timeLogs.date,
      hours: timeLogs.hours,
      note: timeLogs.note,
      partnerId: timeLogs.partnerId,
      partnerName: partners.name,
    })
    .from(timeLogs)
    .leftJoin(partners, eq(timeLogs.partnerId, partners.id))
    .where(eq(timeLogs.projectId, projectId))
    .orderBy(desc(timeLogs.date), desc(timeLogs.createdAt));
}

/** ساعات كل شريك على مجموعة مشاريع: لحساب تكلفة الوقت الفعلية. */
export async function hoursByPartner(projectIds: string[]) {
  if (!projectIds.length) return [];
  const db = await getDb();
  return db
    .select({ projectId: timeLogs.projectId, partnerId: timeLogs.partnerId, hours: sumOf(timeLogs.hours) })
    .from(timeLogs)
    .where(inArray(timeLogs.projectId, projectIds))
    .groupBy(timeLogs.projectId, timeLogs.partnerId);
}
