// تنسيق الأرقام والتواريخ. أرقام لاتينية داخل نص عربي، معزولة الاتجاه
// حتى لا تنقلب إشارة السالب أو الفاصلة في السياق من اليمين لليسار.

const LRI = "⁦";
const PDI = "⁩";
const isolate = (s: string) => `${LRI}${s}${PDI}`;

const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

export const CURRENCY = "ر.س";

/** 1,250 — بلا كسور إلا إن وُجدت. */
export function num(n: number, digits: 0 | 1 | 2 = 2): string {
  const f = digits === 0 ? nf0 : digits === 1 ? nf1 : nf2;
  return isolate(f.format(Number.isFinite(n) ? n : 0));
}

/** 1,250 ر.س */
export function money(n: number, opts: { digits?: 0 | 2; sign?: boolean } = {}): string {
  const value = Number.isFinite(n) ? n : 0;
  const digits = opts.digits ?? (Number.isInteger(Math.round(value * 100) / 100) ? 0 : 2);
  const body = (digits === 0 ? nf0 : nf2).format(value);
  const signed = opts.sign && value > 0 ? `+${body}` : body;
  return `${isolate(signed)} ${CURRENCY}`;
}

/** رقم مختصر للمحاور: 12.5k */
export function compact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return isolate(`${nf1.format(n / 1_000_000)}M`);
  if (abs >= 1_000) return isolate(`${nf1.format(n / 1_000)}k`);
  return isolate(nf0.format(n));
}

export function pct(n: number, digits: 0 | 1 = 0): string {
  return isolate(`${(digits ? nf1 : nf0).format(Number.isFinite(n) ? n : 0)}%`);
}

export function hours(n: number): string {
  return `${num(n, 1)} س`;
}

/** عدد الأسابيع بصيغته العربية الصحيحة: أسبوع، أسبوعان، 3 أسابيع، 11 أسبوعاً. */
export function weeks(n: number): string {
  const w = Math.max(Math.ceil(n), 1);
  if (w === 1) return "أسبوع واحد";
  if (w === 2) return "أسبوعين";
  return `${num(w, 0)} ${w <= 10 ? "أسابيع" : "أسبوعاً"}`;
}

const dateFmt = new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const dateShortFmt = new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", { day: "numeric", month: "short", timeZone: "UTC" });
const monthFmt = new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", { month: "long", year: "numeric", timeZone: "UTC" });
const monthShortFmt = new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", { month: "short", timeZone: "UTC" });

const toDate = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`);

/** 15 نوفمبر 2026 */
export function date(iso: string | null | undefined): string {
  return iso ? dateFmt.format(toDate(iso)) : "—";
}
export function dateShort(iso: string | null | undefined): string {
  return iso ? dateShortFmt.format(toDate(iso)) : "—";
}
/** "2026-11" → نوفمبر 2026 */
export function monthLabel(month: string): string {
  return monthFmt.format(toDate(`${month}-01`));
}
export function monthShort(month: string): string {
  return monthShortFmt.format(toDate(`${month}-01`));
}

// ── تواريخ بتوقيت الرياض ──

const riyadh = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit" });

/** تاريخ اليوم YYYY-MM-DD بتوقيت الرياض. */
export function todayISO(): string {
  return riyadh.format(new Date());
}
export function currentMonth(): string {
  return todayISO().slice(0, 7);
}
export function isMonth(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
}
/** أول يوم في الشهر وأول يوم في الشهر التالي. */
export function monthRange(month: string): { from: string; to: string } {
  return { from: `${month}-01`, to: `${shiftMonth(month, 1)}-01` };
}
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
/** آخر n شهراً تنتهي بالشهر المعطى، من الأقدم للأحدث. */
export function lastMonths(n: number, end = currentMonth()): string[] {
  return Array.from({ length: n }, (_, i) => shiftMonth(end, i - n + 1));
}
export function addDays(iso: string, days: number): string {
  const d = toDate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function daysBetween(from: string, to: string): number {
  return Math.round((toDate(to).getTime() - toDate(from).getTime()) / 86_400_000);
}
/** بداية الأسبوع (الأحد) للتاريخ المعطى. */
export function weekStart(iso: string): string {
  const d = toDate(iso);
  return addDays(iso, -d.getUTCDay());
}
