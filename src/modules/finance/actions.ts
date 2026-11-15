"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { expenses, operatingCosts, payments, projects, transfers } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { todayISO } from "@/lib/format";
import {
  fail,
  formObject,
  invalid,
  zCheckbox,
  zChoice,
  zDate,
  zNumber,
  zOptionalId,
  zRequiredText,
  zText,
  type ActionResult,
} from "@/lib/validation";
import { CYCLE_KEYS, METHOD_KEYS, PAYMENT_KIND_KEYS } from "./constants";

/** كل الصفحات تعرض أرقاماً مشتقة من الحركات، فنُبطل الكاش كاملاً بعد أي تعديل. */
const refresh = () => revalidatePath("/", "layout");

// ───────────────────────── المصروفات ─────────────────────────

const expenseSchema = z.object({
  date: zDate(),
  amount: zNumber("المبلغ", { positive: true }),
  description: zRequiredText("الوصف", 200),
  categoryId: zOptionalId,
  vendor: zText(120),
  projectId: zOptionalId,
  paidBy: zOptionalId,
  method: zChoice(METHOD_KEYS, "طريقة الدفع"),
  notes: zText(1000),
});

export async function saveExpense(id: string | null, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = expenseSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  const db = await getDb();
  if (id) await db.update(expenses).set(parsed.data).where(eq(expenses.id, id));
  else await db.insert(expenses).values({ ...parsed.data, createdBy: user.id });
  refresh();
  return { ok: true };
}

export async function deleteExpense(id: string): Promise<ActionResult> {
  await requireUser();
  const db = await getDb();
  await db.delete(expenses).where(eq(expenses.id, id));
  refresh();
  return { ok: true };
}

// ───────────────────────── التكاليف المتكررة ─────────────────────────

const operatingCostSchema = z.object({
  name: zRequiredText("البند", 120),
  categoryId: zOptionalId,
  amount: zNumber("المبلغ", { positive: true }),
  cycle: zChoice(CYCLE_KEYS, "الدورة"),
  active: zCheckbox,
  notes: zText(500),
});

export async function saveOperatingCost(id: string | null, formData: FormData): Promise<ActionResult> {
  await requireUser();
  const parsed = operatingCostSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  const db = await getDb();
  if (id) await db.update(operatingCosts).set(parsed.data).where(eq(operatingCosts.id, id));
  else await db.insert(operatingCosts).values(parsed.data);
  refresh();
  return { ok: true };
}

export async function deleteOperatingCost(id: string): Promise<ActionResult> {
  await requireUser();
  const db = await getDb();
  await db.delete(operatingCosts).where(eq(operatingCosts.id, id));
  refresh();
  return { ok: true };
}

/** يسجّل دفعة هذه الدورة من بند متكرر كمصروف بتاريخ اليوم، بضغطة واحدة. */
export async function recordOperatingCost(id: string): Promise<ActionResult> {
  const user = await requireUser();
  const db = await getDb();
  const [cost] = await db.select().from(operatingCosts).where(eq(operatingCosts.id, id)).limit(1);
  if (!cost) return fail("البند غير موجود.");
  await db.insert(expenses).values({
    date: todayISO(),
    amount: cost.amount,
    description: cost.name,
    categoryId: cost.categoryId,
    paidBy: user.partnerId,
    operatingCostId: cost.id,
    createdBy: user.id,
  });
  refresh();
  return { ok: true };
}

// ───────────────────────── الإيرادات ─────────────────────────

const paymentSchema = z.object({
  date: zDate(),
  amount: zNumber("المبلغ", { positive: true }),
  projectId: zOptionalId,
  clientId: zOptionalId,
  kind: zChoice(PAYMENT_KIND_KEYS, "نوع الدفعة"),
  receivedBy: zOptionalId,
  method: zChoice(METHOD_KEYS, "طريقة الدفع"),
  notes: zText(1000),
});

export async function savePayment(id: string | null, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = paymentSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  const db = await getDb();
  const data = { ...parsed.data };
  if (data.projectId) {
    // عميل الدفعة يتبع عميل المشروع دائماً.
    const [project] = await db.select({ clientId: projects.clientId }).from(projects).where(eq(projects.id, data.projectId)).limit(1);
    if (!project) return fail("المشروع غير موجود.");
    data.clientId = project.clientId;
  }
  if (id) await db.update(payments).set(data).where(eq(payments.id, id));
  else await db.insert(payments).values({ ...data, createdBy: user.id });
  refresh();
  return { ok: true };
}

export async function deletePayment(id: string): Promise<ActionResult> {
  await requireUser();
  const db = await getDb();
  await db.delete(payments).where(eq(payments.id, id));
  refresh();
  return { ok: true };
}

// ───────────────────────── تحويلات التسوية ─────────────────────────

const transferSchema = z
  .object({
    date: zDate(),
    amount: zNumber("المبلغ", { positive: true }),
    fromPartnerId: zOptionalId,
    toPartnerId: zOptionalId,
    notes: zText(500),
  })
  .refine((v) => v.fromPartnerId !== v.toPartnerId, { message: "اختر طرفين مختلفين.", path: ["toPartnerId"] });

export async function saveTransfer(formData: FormData): Promise<ActionResult> {
  await requireUser();
  const parsed = transferSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  const db = await getDb();
  await db.insert(transfers).values(parsed.data);
  refresh();
  return { ok: true };
}

export async function deleteTransfer(id: string): Promise<ActionResult> {
  await requireUser();
  const db = await getDb();
  await db.delete(transfers).where(eq(transfers.id, id));
  refresh();
  return { ok: true };
}
