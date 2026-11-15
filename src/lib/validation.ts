import { z } from "zod";

/** يحوّل الأرقام العربية والفارسية والفواصل العربية إلى صيغة لاتينية قابلة للتحليل. */
export function toLatinDigits(input: string): string {
  return input
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/٫/g, ".")
    .replace(/[٬,\s]/g, "");
}

export function parseNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return NaN;
  const cleaned = toLatinDigits(value.trim());
  if (cleaned === "") return NaN;
  return Number(cleaned);
}

const numberInput = (v: unknown) => {
  if (typeof v === "string") {
    if (v.trim() === "") return undefined;
    return parseNumber(v);
  }
  return v;
};

/** رقم مطلوب ≥ الحد الأدنى. */
export const zNumber = (label: string, opts: { min?: number; max?: number; positive?: boolean } = {}) => {
  let schema = z.number({ error: `${label}: أدخل رقماً صحيحاً` });
  if (opts.positive) schema = schema.gt(0, `${label}: يجب أن يكون أكبر من صفر`);
  else schema = schema.min(opts.min ?? 0, `${label}: لا يقل عن ${opts.min ?? 0}`);
  if (opts.max != null) schema = schema.max(opts.max, `${label}: لا يزيد عن ${opts.max}`);
  return z.preprocess(numberInput, schema);
};

/** رقم اختياري: الفارغ يصبح القيمة الافتراضية. */
export const zNumberOr = (label: string, fallback: number, opts: { min?: number; max?: number } = {}) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? fallback : numberInput(v)),
    z
      .number({ error: `${label}: أدخل رقماً صحيحاً` })
      .min(opts.min ?? 0, `${label}: لا يقل عن ${opts.min ?? 0}`)
      .max(opts.max ?? Number.MAX_SAFE_INTEGER, `${label}: لا يزيد عن ${opts.max}`),
  );

export const zPct = (label: string) => zNumber(label, { min: 0, max: 100 });

export const zText = (max = 500) =>
  z.preprocess((v) => (typeof v === "string" ? v.trim() : ""), z.string().max(max, `النص أطول من ${max} حرفاً`));

export const zRequiredText = (label: string, max = 200) =>
  z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : ""),
    z.string().min(1, `${label}: حقل مطلوب`).max(max, `${label}: النص طويل جداً`),
  );

/** معرّف اختياري: الفارغ يصبح null. */
export const zOptionalId = z.preprocess((v) => (v === "" || v == null ? null : v), z.uuid("اختيار غير صالح").nullable());
export const zId = (label: string) => z.uuid(`${label}: حقل مطلوب`);

export const zDate = (label = "التاريخ") => z.string().regex(/^\d{4}-\d{2}-\d{2}$/, `${label}: تاريخ غير صحيح`);
export const zOptionalDate = z.preprocess(
  (v) => (v === "" || v == null ? null : v),
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "تاريخ غير صحيح")
    .nullable(),
);

export const zChoice = <const T extends readonly [string, ...string[]]>(values: T, label: string) =>
  z.enum(values, `${label}: اختيار غير صالح`);

export const zCheckbox = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());

// ── نتيجة الإجراءات ──

export type ActionResult =
  | { ok: true; message?: string; id?: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

export function invalid(error: z.ZodError): ActionResult {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (key && !(key in fieldErrors)) fieldErrors[key] = issue.message;
  }
  return { ok: false, message: error.issues[0]?.message ?? "تحقّق من الحقول", fieldErrors };
}

export const fail = (message: string): ActionResult => ({ ok: false, message });

export function formObject(formData: FormData): Record<string, FormDataEntryValue> {
  return Object.fromEntries(formData.entries());
}
