"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { projects, timeLogs } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import {
  formObject,
  invalid,
  zChoice,
  zDate,
  zId,
  zNumber,
  zNumberOr,
  zOptionalDate,
  zOptionalId,
  zRequiredText,
  zText,
  type ActionResult,
} from "@/lib/validation";
import { PROJECT_STATUS_KEYS } from "./constants";

const refresh = () => revalidatePath("/", "layout");

const projectSchema = z
  .object({
    name: zRequiredText("اسم المشروع", 160),
    clientId: zOptionalId,
    type: zChoice(["joint", "individual"], "نوع المشروع"),
    billing: zChoice(["one_time", "monthly"], "الفوترة"),
    finderId: zOptionalId,
    executorId: zOptionalId,
    status: zChoice(PROJECT_STATUS_KEYS, "الحالة"),
    price: zNumberOr("السعر", 0),
    estimatedHours: zNumberOr("الساعات المقدّرة", 0),
    startDate: zOptionalDate,
    dueDate: zOptionalDate,
    notes: zText(2000),
  })
  .refine((v) => v.type !== "individual" || v.executorId, { message: "المشروع الفردي يحتاج منفّذاً.", path: ["executorId"] });

export async function saveProject(id: string | null, formData: FormData): Promise<ActionResult> {
  await requireUser();
  const parsed = projectSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  const db = await getDb();
  let savedId = id;
  if (id) await db.update(projects).set(parsed.data).where(eq(projects.id, id));
  else [{ id: savedId }] = await db.insert(projects).values(parsed.data).returning({ id: projects.id });
  refresh();
  return { ok: true, id: savedId ?? undefined };
}

export async function deleteProject(id: string): Promise<ActionResult> {
  await requireUser();
  const db = await getDb();
  // سجل الساعات يُحذف مع المشروع؛ المصروفات والدفعات تبقى وتصبح عامة.
  await db.delete(projects).where(eq(projects.id, id));
  refresh();
  redirect("/projects");
}

const timeLogSchema = z.object({
  projectId: zId("المشروع"),
  partnerId: zId("الشريك"),
  date: zDate(),
  hours: zNumber("الساعات", { positive: true, max: 24 }),
  note: zText(300),
});

export async function saveTimeLog(formData: FormData): Promise<ActionResult> {
  await requireUser();
  const parsed = timeLogSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  const db = await getDb();
  await db.insert(timeLogs).values(parsed.data);
  refresh();
  return { ok: true };
}

export async function deleteTimeLog(id: string): Promise<ActionResult> {
  await requireUser();
  const db = await getDb();
  await db.delete(timeLogs).where(eq(timeLogs.id, id));
  refresh();
  return { ok: true };
}
