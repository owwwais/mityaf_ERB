export const METHODS = {
  transfer: "تحويل بنكي",
  card: "بطاقة",
  cash: "نقداً",
  other: "أخرى",
} as const;
export type Method = keyof typeof METHODS;
export const METHOD_KEYS = Object.keys(METHODS) as [Method, ...Method[]];

export const PAYMENT_KINDS = {
  down_payment: "دفعة مقدمة",
  milestone: "دفعة مرحلية",
  final: "دفعة نهائية",
  subscription: "اشتراك شهري",
  other: "أخرى",
} as const;
export type PaymentKind = keyof typeof PAYMENT_KINDS;
export const PAYMENT_KIND_KEYS = Object.keys(PAYMENT_KINDS) as [PaymentKind, ...PaymentKind[]];

export const CYCLES = {
  monthly: { label: "شهري", perYear: 12 },
  quarterly: { label: "ربع سنوي", perYear: 4 },
  yearly: { label: "سنوي", perYear: 1 },
} as const;
export type Cycle = keyof typeof CYCLES;
export const CYCLE_KEYS = Object.keys(CYCLES) as [Cycle, ...Cycle[]];

export const annualize = (amount: number, cycle: Cycle) => amount * CYCLES[cycle].perYear;

export const toOptions = (map: Record<string, string>) => Object.entries(map).map(([value, label]) => ({ value, label }));

export const TREASURY_LABEL = "خزينة الشركة";

export const EXPENSE_TABS = [
  { href: "/expenses", label: "سجل المصروفات" },
  { href: "/expenses/recurring", label: "التكاليف المتكررة" },
];
