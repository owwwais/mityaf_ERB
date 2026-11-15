import type { Partner, Settings } from "@/db/schema";
import { buildCostModel, type CostModel, type PricingRules } from "./engine";

/** يبني نموذج التكلفة من إعدادات الشركة وشركائها النشطين. */
export function costModelFrom(settings: Settings, partners: Partner[], annualOperatingCost: number): CostModel {
  return buildCostModel({
    annualOperatingCost,
    workingWeeks: settings.workingWeeks,
    utilizationPct: settings.utilizationPct,
    partners: partners
      .filter((p) => p.active)
      .map((p) => ({ id: p.id, name: p.name, weeklyHours: p.weeklyHours, hourlyCost: p.hourlyCost })),
  });
}

export function rulesFrom(settings: Settings, partners: Partner[]): PricingRules {
  return {
    treasuryPct: settings.treasuryPct,
    finderPct: settings.finderPct,
    executorPct: settings.executorPct,
    minMarginPct: settings.minMarginPct,
    meterOpeningFee: settings.meterOpeningFee,
    meterHourlyRate: settings.meterHourlyRate,
    vatEnabled: settings.vatEnabled,
    vatPct: settings.vatPct,
    partnerShares: partners.filter((p) => p.active).map((p) => ({ id: p.id, name: p.name, sharePct: p.profitSharePct })),
  };
}

export const QUOTE_STATUSES = {
  draft: { label: "مسودة", tone: "neutral" },
  sent: { label: "مُرسل", tone: "info" },
  accepted: { label: "مقبول", tone: "success" },
  rejected: { label: "مرفوض", tone: "danger" },
} as const;
export type QuoteStatus = keyof typeof QUOTE_STATUSES;

export const SERVICE_KINDS = { service: "خدمة", product: "منتج", consulting: "استشارة" } as const;

export const URGENCY_OPTIONS = [
  { value: 0, label: "عادي" },
  { value: 15, label: "سريع +15٪" },
  { value: 30, label: "عاجل +30٪" },
];

export const RISK_OPTIONS = [
  { value: 10, label: "واضح 10٪" },
  { value: 20, label: "متوسط 20٪" },
  { value: 35, label: "غامض 35٪" },
];
