"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { clients } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { formObject, invalid, zChoice, zNumberOr, zOptionalDate, zRequiredText, zText, type ActionResult } from "@/lib/validation";
import { SOURCE_KEYS, STAGE_KEYS } from "./constants";

const clientSchema = z.object({
  name: zRequiredText("العميل / الجهة", 160),
  contactName: zText(120),
  phone: zText(40),
  email: zText(160),
  sector: zText(120),
  source: zChoice(SOURCE_KEYS, "المصدر"),
  stage: zChoice(STAGE_KEYS, "مرحلة البيع"),
  expectedValue: zNumberOr("القيمة المتوقعة", 0),
  interest: zText(200),
  need: zText(1000),
  nextStep: zText(300),
  followUpDate: zOptionalDate,
  notes: zText(2000),
});

export async function saveClient(id: string | null, formData: FormData): Promise<ActionResult> {
  await requireUser();
  const parsed = clientSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  const db = await getDb();
  let savedId = id;
  if (id) await db.update(clients).set(parsed.data).where(eq(clients.id, id));
  else [{ id: savedId }] = await db.insert(clients).values(parsed.data).returning({ id: clients.id });
  revalidatePath("/", "layout");
  return { ok: true, id: savedId ?? undefined };
}

export async function deleteClient(id: string): Promise<ActionResult> {
  await requireUser();
  const db = await getDb();
  await db.delete(clients).where(eq(clients.id, id));
  revalidatePath("/", "layout");
  return { ok: true };
}
