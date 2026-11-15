"use server";

import { revalidatePath } from "next/cache";
import { eq, like } from "drizzle-orm";
import { z } from "zod";
import { getDb, type DB, type Tx } from "@/db";
import { clients, projects, quotes } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { addDays, todayISO } from "@/lib/format";
import { fail, invalid, type ActionResult } from "@/lib/validation";
import { computeQuote } from "./engine";
import { getPricingContext } from "./queries";

const refresh = () => revalidatePath("/", "layout");

const id = z.uuid().nullable();
const amount = z.number().min(0).max(100_000_000);

const quotePayloadSchema = z.object({
  title: z.string().trim().min(1, "عنوان العرض مطلوب").max(200),
  clientId: id,
  serviceId: id,
  validUntil: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  scopeIncluded: z.string().trim().max(4000),
  scopeExcluded: z.string().trim().max(4000),
  notes: z.string().trim().max(4000),
  inputs: z.object({
    billing: z.enum(["one_time", "monthly"]),
    projectType: z.enum(["joint", "individual"]),
    finderId: id,
    executorId: id,
    items: z
      .array(z.object({ title: z.string().trim().max(200), hours: z.number().min(0).max(10_000), partnerId: id }))
      .max(100),
    directCosts: z.array(z.object({ title: z.string().trim().max(200), amount })).max(100),
    riskPct: z.number().min(0).max(200),
    marginPct: z.number().min(0).max(90),
    urgencyPct: z.number().min(0).max(200),
    loadPct: z.number().min(0).max(200),
    discountPct: z.number().min(0).max(100),
    productValue: amount,
    downPaymentPct: z.number().min(0).max(100),
    manualPrice: amount.nullable(),
  }),
});

export type QuotePayload = z.infer<typeof quotePayloadSchema>;

async function nextQuoteNumber(db: DB | Tx): Promise<string> {
  const prefix = `Q-${todayISO().slice(0, 4)}-`;
  const rows = await db.select({ number: quotes.number }).from(quotes).where(like(quotes.number, `${prefix}%`));
  const last = rows.reduce((max, r) => Math.max(max, Number(r.number.slice(prefix.length)) || 0), 0);
  return `${prefix}${String(last + 1).padStart(3, "0")}`;
}

/** يحفظ العرض. السعر يُعاد حسابه على الخادم بالمحرك نفسه ولا يُؤخذ من المتصفح. */
export async function saveQuote(quoteId: string | null, payload: QuotePayload): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = quotePayloadSchema.safeParse(payload);
  if (!parsed.success) return invalid(parsed.error);
  const data = parsed.data;

  const inputs = {
    ...data.inputs,
    items: data.inputs.items.filter((i) => i.title || i.hours > 0),
    directCosts: data.inputs.directCosts.filter((c) => c.title || c.amount > 0),
  };
  if (inputs.projectType === "individual" && !inputs.executorId) return fail("المشروع الفردي يحتاج منفّذاً.");

  const { model, rules, workload } = await getPricingContext();
  const result = computeQuote(inputs, model, rules, workload);
  const values = {
    title: data.title,
    clientId: data.clientId,
    serviceId: data.serviceId,
    validUntil: data.validUntil,
    scopeIncluded: data.scopeIncluded,
    scopeExcluded: data.scopeExcluded,
    notes: data.notes,
    inputs,
    result,
    price: result.finalPrice,
    totalHours: result.baseHours,
    totalCost: result.totalCost,
    marginPct: result.marginPct,
  };

  const db = await getDb();
  let savedId = quoteId;
  if (quoteId) {
    const [existing] = await db.select({ status: quotes.status }).from(quotes).where(eq(quotes.id, quoteId)).limit(1);
    if (!existing) return fail("العرض غير موجود.");
    if (existing.status === "accepted") return fail("العرض مقبول ومُحوَّل إلى مشروع؛ أنشئ عرضاً جديداً للتعديل.");
    await db
      .update(quotes)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(quotes.id, quoteId));
  } else {
    savedId = await db.transaction(async (tx) => {
      const number = await nextQuoteNumber(tx);
      const [row] = await tx
        .insert(quotes)
        .values({ ...values, number, createdBy: user.id })
        .returning({ id: quotes.id });
      return row.id;
    });
  }
  refresh();
  return { ok: true, id: savedId ?? undefined };
}

export async function setQuoteStatus(quoteId: string, status: "draft" | "sent" | "rejected"): Promise<ActionResult> {
  await requireUser();
  const db = await getDb();
  const [quote] = await db.select().from(quotes).where(eq(quotes.id, quoteId)).limit(1);
  if (!quote) return fail("العرض غير موجود.");
  if (quote.status === "accepted") return fail("العرض مقبول ومُحوَّل إلى مشروع.");
  await db.transaction(async (tx) => {
    await tx.update(quotes).set({ status, updatedAt: new Date() }).where(eq(quotes.id, quoteId));
    // مرحلة العميل تتبع العرض.
    if (quote.clientId && status !== "draft") {
      await tx
        .update(clients)
        .set({ stage: status === "sent" ? "proposal" : "lost" })
        .where(eq(clients.id, quote.clientId));
    }
  });
  refresh();
  return { ok: true };
}

/** قبول العرض: ينشئ مشروعاً بسعره وساعاته وتوزيعه، وينقل العميل إلى «فاز». */
export async function acceptQuote(quoteId: string): Promise<ActionResult> {
  await requireUser();
  const db = await getDb();
  const [quote] = await db.select().from(quotes).where(eq(quotes.id, quoteId)).limit(1);
  if (!quote) return fail("العرض غير موجود.");
  const [linked] = await db.select({ id: projects.id }).from(projects).where(eq(projects.quoteId, quoteId)).limit(1);
  if (linked) return { ok: true, id: linked.id };

  const today = todayISO();
  const weeks = quote.result.deliveryWeeks;
  const projectId = await db.transaction(async (tx) => {
    const [project] = await tx
      .insert(projects)
      .values({
        name: quote.title,
        clientId: quote.clientId,
        quoteId: quote.id,
        type: quote.inputs.projectType,
        billing: quote.inputs.billing,
        finderId: quote.inputs.finderId,
        executorId: quote.inputs.executorId,
        status: "active",
        price: quote.price,
        estimatedHours: quote.totalHours,
        startDate: today,
        dueDate: weeks ? addDays(today, Math.ceil(weeks) * 7) : null,
      })
      .returning({ id: projects.id });
    await tx.update(quotes).set({ status: "accepted", updatedAt: new Date() }).where(eq(quotes.id, quoteId));
    if (quote.clientId) await tx.update(clients).set({ stage: "won" }).where(eq(clients.id, quote.clientId));
    return project.id;
  });
  refresh();
  return { ok: true, id: projectId };
}

export async function deleteQuote(quoteId: string): Promise<ActionResult> {
  await requireUser();
  const db = await getDb();
  await db.delete(quotes).where(eq(quotes.id, quoteId));
  refresh();
  return { ok: true };
}
