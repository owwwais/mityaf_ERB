import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { clients, projects, quotes, services } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { getSettings, listPartners } from "../core/queries";
import { getAnnualOperatingCost } from "../finance/queries";
import { listProjects } from "../projects/queries";
import { assessWorkload } from "./engine";
import { costModelFrom, rulesFrom } from "./model";

export async function listServices(opts: { includeInactive?: boolean } = {}) {
  await requireUser();
  const db = await getDb();
  const rows = await db.select().from(services).orderBy(asc(services.sort), asc(services.name));
  return opts.includeInactive ? rows : rows.filter((s) => s.active);
}

/** كل ما تحتاجه الحاسبة: نموذج التكلفة، قواعد التوزيع، وضغط العمل الحالي. */
export async function getPricingContext() {
  await requireUser();
  const [settings, partners, annualOperatingCost, projectRows] = await Promise.all([
    getSettings(),
    listPartners(),
    getAnnualOperatingCost(),
    listProjects(),
  ]);
  const model = costModelFrom(settings, partners, annualOperatingCost);
  const rules = rulesFrom(settings, partners);
  const committedHours = projectRows.reduce((s, p) => s + p.remainingHours, 0);
  const workload = assessWorkload(committedHours, model.weeklyBillableHours);
  return { settings, partners, model, rules, workload };
}

export async function listQuotes() {
  await requireUser();
  const db = await getDb();
  return db
    .select({
      id: quotes.id,
      number: quotes.number,
      title: quotes.title,
      status: quotes.status,
      price: quotes.price,
      totalHours: quotes.totalHours,
      totalCost: quotes.totalCost,
      marginPct: quotes.marginPct,
      validUntil: quotes.validUntil,
      createdAt: quotes.createdAt,
      clientName: clients.name,
      projectId: projects.id,
    })
    .from(quotes)
    .leftJoin(clients, eq(quotes.clientId, clients.id))
    .leftJoin(projects, eq(projects.quoteId, quotes.id))
    .orderBy(desc(quotes.createdAt));
}

export async function getQuote(id: string) {
  await requireUser();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const db = await getDb();
  const [row] = await db
    .select({ quote: quotes, clientName: clients.name, clientContact: clients.contactName, serviceName: services.name, projectId: projects.id })
    .from(quotes)
    .leftJoin(clients, eq(quotes.clientId, clients.id))
    .leftJoin(services, eq(quotes.serviceId, services.id))
    .leftJoin(projects, eq(projects.quoteId, quotes.id))
    .where(eq(quotes.id, id))
    .limit(1);
  return row ?? null;
}
