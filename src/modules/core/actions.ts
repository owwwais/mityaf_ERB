"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, count, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import {
  clients,
  expenseCategories,
  expenses,
  operatingCosts,
  partners,
  payments,
  projects,
  quotes,
  services,
  settings,
  timeLogs,
  transfers,
  users,
} from "@/db/schema";
import {
  clearLoginFailures,
  createSession,
  destroySession,
  hasAnyUser,
  loginThrottled,
  recordLoginFailure,
  requireAdmin,
  requireUser,
} from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import {
  fail,
  formObject,
  invalid,
  zCheckbox,
  zChoice,
  zNumber,
  zOptionalId,
  zPct,
  zRequiredText,
  zText,
  type ActionResult,
} from "@/lib/validation";
import { ensureDefaults } from "./defaults";
import { seedDemo } from "./demo";

const zEmail = z.preprocess((v) => (typeof v === "string" ? v.trim().toLowerCase() : v), z.email("البريد الإلكتروني غير صحيح"));
const zPassword = z.string().min(8, "كلمة المرور: 8 أحرف على الأقل").max(200);

// ───────────────────────── الدخول والإعداد ─────────────────────────

const setupSchema = z.object({
  name: zRequiredText("اسمك", 80),
  email: zEmail,
  password: zPassword,
  role: zChoice(["technical", "commercial"], "دورك"),
  partnerName: zRequiredText("اسم شريكك", 80),
  demo: zCheckbox,
});

export async function setupAction(formData: FormData): Promise<ActionResult> {
  if (await hasAnyUser()) return fail("النظام مُهيّأ مسبقاً. سجّل الدخول.");
  const parsed = setupSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  const { name, email, password, role, partnerName, demo } = parsed.data;

  const db = await getDb();
  await ensureDefaults(db);
  const passwordHash = await hashPassword(password);

  const userId = await db.transaction(async (tx) => {
    const technical = { title: "الشريك التقني", sort: 0 };
    const commercial = { title: "الشريك التجاري", sort: 1 };
    const mine = role === "technical" ? technical : commercial;
    const theirs = role === "technical" ? commercial : technical;
    const [me] = await tx.insert(partners).values({ name, ...mine }).returning({ id: partners.id });
    await tx.insert(partners).values({ name: partnerName, ...theirs });
    const [user] = await tx
      .insert(users)
      .values({ name, email, passwordHash, role: "admin", partnerId: me.id })
      .returning({ id: users.id });
    return user.id;
  });

  if (demo) await seedDemo(db);
  await createSession(userId);
  redirect("/");
}

const loginSchema = z.object({ email: zEmail, password: z.string().min(1, "أدخل كلمة المرور") });

export async function loginAction(formData: FormData): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  const { email, password } = parsed.data;
  if (loginThrottled(email)) return fail("محاولات كثيرة. انتظر عشر دقائق ثم حاول مجدداً.");

  const db = await getDb();
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const valid = user ? await verifyPassword(password, user.passwordHash) : false;
  if (!user || !valid) {
    recordLoginFailure(email);
    return fail("البريد أو كلمة المرور غير صحيحة.");
  }
  clearLoginFailures(email);
  await createSession(user.id);
  redirect("/");
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/login");
}

// ───────────────────────── الإعدادات ─────────────────────────

const settingsSchemas = {
  company: z.object({
    companyName: zRequiredText("اسم الشركة", 80),
    currency: zRequiredText("العملة", 12),
    monthlyRevenueTarget: zNumber("هدف الإيراد الشهري"),
    monthlyExpenseCap: zNumber("سقف المصروف الشهري"),
    hoursOverrunAlertPct: zPct("حد تجاوز الساعات"),
    clientConcentrationAlertPct: zPct("حد تركّز الإيراد"),
  }),
  pricing: z.object({
    targetMarginPct: zNumber("هامش الربح المستهدف", { min: 0, max: 90 }),
    minMarginPct: zNumber("الحد الأدنى للهامش", { min: 0, max: 90 }),
    defaultRiskPct: zPct("هامش المخاطرة"),
    downPaymentPct: zPct("الدفعة المقدمة"),
    workingWeeks: zNumber("أسابيع العمل", { min: 1, max: 52 }),
    utilizationPct: zNumber("نسبة الساعات القابلة للفوترة", { min: 5, max: 100 }),
    meterOpeningFee: zNumber("فتح العداد"),
    meterHourlyRate: zNumber("سعر ساعة العداد"),
    vatEnabled: zCheckbox,
    vatPct: zPct("نسبة الضريبة"),
    quoteValidityDays: zNumber("صلاحية العرض", { min: 1, max: 365 }),
    quoteTerms: zText(1000),
  }),
  distribution: z
    .object({
      treasuryPct: zPct("نسبة الخزينة"),
      finderPct: zPct("نسبة الجالب"),
      executorPct: zPct("نسبة المنفّذ"),
    })
    .refine((v) => v.finderPct + v.executorPct <= 100, { message: "مجموع نسبتي الجالب والمنفّذ يتجاوز 100٪", path: ["executorPct"] }),
};

export async function saveSettings(section: keyof typeof settingsSchemas, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = settingsSchemas[section].safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  const db = await getDb();
  const values = { ...parsed.data } as Record<string, unknown>;
  if ("workingWeeks" in values) values.workingWeeks = Math.round(values.workingWeeks as number);
  if ("quoteValidityDays" in values) values.quoteValidityDays = Math.round(values.quoteValidityDays as number);
  await db
    .update(settings)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(settings.id, 1));
  revalidatePath("/", "layout");
  return { ok: true, message: "حُفظت الإعدادات." };
}

// ───────────────────────── الشركاء ─────────────────────────

const partnerSchema = z.object({
  name: zRequiredText("الاسم", 80),
  title: zText(80),
  weeklyHours: zNumber("الساعات الأسبوعية", { min: 0, max: 100 }),
  hourlyCost: zNumber("سعر الساعة الحقيقي"),
  profitSharePct: zPct("حصة الأرباح"),
  active: zCheckbox,
});

export async function savePartner(id: string | null, formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const parsed = partnerSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  const db = await getDb();
  if (id) await db.update(partners).set(parsed.data).where(eq(partners.id, id));
  else await db.insert(partners).values(parsed.data);
  revalidatePath("/", "layout");
  return { ok: true };
}

// ───────────────────────── المستخدمون ─────────────────────────

const userSchema = z.object({
  name: zRequiredText("الاسم", 80),
  email: zEmail,
  password: z.preprocess((v) => (v === "" ? undefined : v), zPassword.optional()),
  role: zChoice(["admin", "member"], "الصلاحية"),
  partnerId: zOptionalId,
});

export async function saveUser(id: string | null, formData: FormData): Promise<ActionResult> {
  const admin = await requireAdmin();
  const parsed = userSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  const { password, ...data } = parsed.data;
  const db = await getDb();

  const [taken] = await db
    .select({ id: users.id })
    .from(users)
    .where(id ? and(eq(users.email, data.email), ne(users.id, id)) : eq(users.email, data.email))
    .limit(1);
  if (taken) return { ok: false, message: "هذا البريد مستخدم مسبقاً.", fieldErrors: { email: "البريد مستخدم مسبقاً" } };

  if (id) {
    if (id === admin.id && data.role !== "admin") return fail("لا يمكنك إزالة صلاحية المدير عن حسابك.");
    await db
      .update(users)
      .set({ ...data, ...(password ? { passwordHash: await hashPassword(password) } : {}) })
      .where(eq(users.id, id));
  } else {
    if (!password) return { ok: false, message: "كلمة المرور مطلوبة للمستخدم الجديد.", fieldErrors: { password: "حقل مطلوب" } };
    await db.insert(users).values({ ...data, passwordHash: await hashPassword(password) });
  }
  revalidatePath("/settings");
  return { ok: true };
}

export async function deleteUser(id: string): Promise<ActionResult> {
  const admin = await requireAdmin();
  if (id === admin.id) return fail("لا يمكنك حذف حسابك.");
  const db = await getDb();
  await db.delete(users).where(eq(users.id, id));
  revalidatePath("/settings");
  return { ok: true };
}

const passwordSchema = z.object({ current: z.string().min(1, "أدخل كلمة المرور الحالية"), next: zPassword });

export async function changePassword(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = passwordSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  const db = await getDb();
  const [row] = await db.select({ hash: users.passwordHash }).from(users).where(eq(users.id, user.id)).limit(1);
  if (!row || !(await verifyPassword(parsed.data.current, row.hash))) {
    return { ok: false, message: "كلمة المرور الحالية غير صحيحة.", fieldErrors: { current: "غير صحيحة" } };
  }
  await db
    .update(users)
    .set({ passwordHash: await hashPassword(parsed.data.next) })
    .where(eq(users.id, user.id));
  return { ok: true, message: "تم تغيير كلمة المرور." };
}

// ───────────────────────── الفئات والخدمات ─────────────────────────

export async function saveCategory(id: string | null, formData: FormData): Promise<ActionResult> {
  await requireUser();
  const parsed = z.object({ name: zRequiredText("اسم الفئة", 60) }).safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  const db = await getDb();
  const [dup] = await db
    .select({ id: expenseCategories.id })
    .from(expenseCategories)
    .where(id ? and(eq(expenseCategories.name, parsed.data.name), ne(expenseCategories.id, id)) : eq(expenseCategories.name, parsed.data.name))
    .limit(1);
  if (dup) return { ok: false, message: "توجد فئة بهذا الاسم.", fieldErrors: { name: "اسم مكرر" } };
  if (id) await db.update(expenseCategories).set(parsed.data).where(eq(expenseCategories.id, id));
  else {
    const [{ n }] = await db.select({ n: count() }).from(expenseCategories);
    await db.insert(expenseCategories).values({ ...parsed.data, sort: n });
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  await requireAdmin();
  const db = await getDb();
  await db.delete(expenseCategories).where(eq(expenseCategories.id, id));
  revalidatePath("/", "layout");
  return { ok: true };
}

const serviceSchema = z.object({
  name: zRequiredText("الاسم", 120),
  kind: zChoice(["service", "product", "consulting"], "النوع"),
  description: zText(400),
  baseValue: zNumber("قيمة المنتج"),
  typicalHours: zNumber("الساعات المعتادة"),
  active: zCheckbox,
});

export async function saveService(id: string | null, formData: FormData): Promise<ActionResult> {
  await requireUser();
  const parsed = serviceSchema.safeParse(formObject(formData));
  if (!parsed.success) return invalid(parsed.error);
  const db = await getDb();
  if (id) await db.update(services).set(parsed.data).where(eq(services.id, id));
  else {
    const [{ n }] = await db.select({ n: count() }).from(services);
    await db.insert(services).values({ ...parsed.data, sort: n });
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteService(id: string): Promise<ActionResult> {
  await requireAdmin();
  const db = await getDb();
  await db.delete(services).where(eq(services.id, id));
  revalidatePath("/", "layout");
  return { ok: true };
}

// ───────────────────────── تصفير البيانات ─────────────────────────

/** يحذف كل الحركات (مصروفات، إيرادات، مشاريع، عروض، عملاء) ويبقي الإعدادات والشركاء والمستخدمين. */
export async function resetOperationalData(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  if (String(formData.get("confirm") ?? "").trim() !== "تصفير") {
    return { ok: false, message: "اكتب كلمة «تصفير» للتأكيد.", fieldErrors: { confirm: "اكتب: تصفير" } };
  }
  const db = await getDb();
  await db.transaction(async (tx) => {
    await tx.delete(timeLogs);
    await tx.delete(transfers);
    await tx.delete(expenses);
    await tx.delete(payments);
    await tx.delete(projects);
    await tx.delete(quotes);
    await tx.delete(clients);
    await tx.delete(operatingCosts);
  });
  revalidatePath("/", "layout");
  return { ok: true, message: "حُذفت كل الحركات. الإعدادات والشركاء والمستخدمون كما هم." };
}
