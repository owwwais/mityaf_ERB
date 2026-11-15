// محرك التسعير — منطق خالص يعمل في المتصفح (معاينة حيّة) وعلى الخادم (الحفظ).
//
// الفكرة في ثلاث خطوات:
//   1) نموذج التكلفة: كم تكلّفنا الساعة القابلة للفوترة فعلاً؟
//        = سعر وقت الشريك الحقيقي ÷ نسبة الساعات القابلة للفوترة
//        + (التكاليف التشغيلية السنوية ÷ الساعات القابلة للفوترة سنوياً)
//   2) تكلفة المشروع: ساعاته (مع هامش مخاطرة) × تكلفة الساعة + تكاليفه المباشرة.
//   3) السعر: التكلفة ÷ (1 − هامش الربح) مع تعديلات الاستعجال وضغط العمل والخصم،
//      ثم تُضاف قيمة المنتج الجاهز إن بُني المشروع على أحد منتجاتنا.

import { distribute, type Distribution, type DistributionRules, type PartnerShare } from "../finance/distribution";

// ───────────────────────── نموذج التكلفة ─────────────────────────

export type PartnerCapacity = { id: string; name: string; weeklyHours: number; hourlyCost: number };

export type CostModelInput = {
  annualOperatingCost: number;
  partners: PartnerCapacity[];
  workingWeeks: number;
  utilizationPct: number;
};

export type PartnerCost = PartnerCapacity & {
  annualHours: number;
  billableHours: number;
  /** تكلفة وقته محمّلةً بالساعات غير القابلة للفوترة (بيع، إدارة، تطوير منتجات). */
  laborPerHour: number;
  /** تكلفة ساعته كاملة: وقته + نصيبها من التكاليف التشغيلية. */
  loadedPerHour: number;
};

export type CostModel = {
  annualOperatingCost: number;
  workingWeeks: number;
  utilizationPct: number;
  annualHours: number;
  billableHours: number;
  weeklyBillableHours: number;
  overheadPerHour: number;
  annualLaborCost: number;
  annualTotalCost: number;
  blendedLaborPerHour: number;
  /** سعر التعادل للساعة: تحته نخسر. */
  breakEvenRate: number;
  partners: PartnerCost[];
};

const safeDiv = (a: number, b: number) => (b > 0 ? a / b : 0);
export const round2 = (n: number) => Math.round(n * 100) / 100;

export function buildCostModel(input: CostModelInput): CostModel {
  const utilization = Math.min(Math.max(input.utilizationPct, 1), 100) / 100;
  const base = input.partners.map((p) => {
    const annualHours = p.weeklyHours * input.workingWeeks;
    return { ...p, annualHours, billableHours: annualHours * utilization };
  });
  const annualHours = base.reduce((s, p) => s + p.annualHours, 0);
  const billableHours = base.reduce((s, p) => s + p.billableHours, 0);
  const overheadPerHour = safeDiv(input.annualOperatingCost, billableHours);
  const annualLaborCost = base.reduce((s, p) => s + p.annualHours * p.hourlyCost, 0);
  const blendedLaborPerHour = safeDiv(annualLaborCost, billableHours);

  return {
    annualOperatingCost: input.annualOperatingCost,
    workingWeeks: input.workingWeeks,
    utilizationPct: utilization * 100,
    annualHours,
    billableHours,
    weeklyBillableHours: safeDiv(billableHours, input.workingWeeks),
    overheadPerHour,
    annualLaborCost,
    annualTotalCost: annualLaborCost + input.annualOperatingCost,
    blendedLaborPerHour,
    breakEvenRate: blendedLaborPerHour + overheadPerHour,
    partners: base.map((p) => {
      const laborPerHour = p.hourlyCost / utilization;
      return { ...p, laborPerHour, loadedPerHour: laborPerHour + overheadPerHour };
    }),
  };
}

/** السعر المطلوب للساعة لتحقيق هامش معيّن فوق سعر التعادل. */
export function rateForMargin(model: CostModel, marginPct: number): number {
  return priceForMargin(model.breakEvenRate, marginPct);
}

export function priceForMargin(cost: number, marginPct: number): number {
  const m = Math.min(Math.max(marginPct, 0), 90) / 100;
  return cost / (1 - m);
}

// ───────────────────────── ضغط العمل ─────────────────────────

export type Workload = {
  /** الساعات المتبقية الملتزم بها في المشاريع الجارية. */
  committedHours: number;
  weeklyBillableHours: number;
  backlogWeeks: number;
  suggestedLoadPct: number;
  level: "free" | "normal" | "busy" | "full";
};

/** كلما امتلأ الجدول ارتفعت قيمة الساعة المتبقية: علاوة ندرة مقترحة. */
export function assessWorkload(committedHours: number, weeklyBillableHours: number): Workload {
  const backlogWeeks = safeDiv(committedHours, weeklyBillableHours);
  let suggestedLoadPct = 0;
  let level: Workload["level"] = "free";
  if (backlogWeeks >= 8) {
    suggestedLoadPct = 20;
    level = "full";
  } else if (backlogWeeks >= 4) {
    suggestedLoadPct = 10;
    level = "busy";
  } else if (backlogWeeks >= 2) {
    suggestedLoadPct = 5;
    level = "normal";
  }
  return { committedHours, weeklyBillableHours, backlogWeeks, suggestedLoadPct, level };
}

// ───────────────────────── تسعير المشروع ─────────────────────────

export type QuoteItem = { title: string; hours: number; partnerId: string | null };
export type DirectCost = { title: string; amount: number };

export type QuoteInput = {
  /** مقطوع لمرة واحدة، أو باقة شهرية (الساعات والتكاليف تُدخل للشهر الواحد). */
  billing: "one_time" | "monthly";
  projectType: "joint" | "individual";
  finderId: string | null;
  executorId: string | null;
  items: QuoteItem[];
  directCosts: DirectCost[];
  /** هامش مخاطرة يُضاف على الساعات المقدّرة. */
  riskPct: number;
  /** هامش الربح المستهدف من السعر. */
  marginPct: number;
  urgencyPct: number;
  loadPct: number;
  discountPct: number;
  /** قيمة المنتج الجاهز الذي يُبنى عليه المشروع (تضاف فوق سعر الساعات). */
  productValue: number;
  downPaymentPct: number;
  /** سعر نهائي يدوي يتجاوز المقترح. */
  manualPrice: number | null;
};

export type PricingRules = DistributionRules & {
  minMarginPct: number;
  meterOpeningFee: number;
  meterHourlyRate: number;
  vatEnabled: boolean;
  vatPct: number;
  partnerShares: PartnerShare[];
};

export type QuoteWarning = { code: string; level: "danger" | "warning" | "info"; message: string };

export type QuoteResult = {
  baseHours: number;
  bufferedHours: number;
  laborCost: number;
  overheadCost: number;
  directCost: number;
  /** أرضية السعر: تحتها خسارة. */
  totalCost: number;
  /** السعر قبل أي تعديل: التكلفة ÷ (1 − الهامش). */
  basePrice: number;
  urgencyAmount: number;
  loadAmount: number;
  discountAmount: number;
  productValue: number;
  /** المقترح بعد كل التعديلات، مقرَّباً. */
  suggestedPrice: number;
  finalPrice: number;
  profit: number;
  marginPct: number;
  effectiveHourlyRate: number;
  /** ما تعطيه قاعدة «فتح العداد + سعر الساعة + قيمة المنتج» الحالية. */
  meterPrice: number;
  ladder: { floor: number; economy: number; recommended: number; premium: number };
  downPayment: number;
  vatAmount: number;
  totalWithVat: number;
  distribution: Distribution;
  /** عائد ساعة المنفّذ الفعلي بعد التوزيع — اختبار «هل اشترينا وظيفة ثانية؟». */
  takeHomePerHour: number;
  deliveryWeeks: number | null;
  capacitySharePct: number | null;
  warnings: QuoteWarning[];
};

/** يقرّب السعر للأعلى إلى رقم «نظيف» يُكتب في عرض سعر. */
export function roundPrice(x: number): number {
  if (!(x > 0)) return 0;
  const step = x < 1000 ? 10 : x < 10000 ? 50 : 100;
  return Math.ceil((x - 1e-9) / step) * step;
}

export function emptyQuoteInput(defaults: { marginPct: number; riskPct: number; downPaymentPct: number }): QuoteInput {
  return {
    billing: "one_time",
    projectType: "joint",
    finderId: null,
    executorId: null,
    items: [{ title: "", hours: 0, partnerId: null }],
    directCosts: [],
    riskPct: defaults.riskPct,
    marginPct: defaults.marginPct,
    urgencyPct: 0,
    loadPct: 0,
    discountPct: 0,
    productValue: 0,
    downPaymentPct: defaults.downPaymentPct,
    manualPrice: null,
  };
}

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

export function computeQuote(
  input: QuoteInput,
  model: CostModel,
  rules: PricingRules,
  workload?: Pick<Workload, "committedHours" | "weeklyBillableHours">,
): QuoteResult {
  const risk = 1 + Math.max(input.riskPct, 0) / 100;
  const partnerCost = new Map(model.partners.map((p) => [p.id, p]));

  let baseHours = 0;
  let laborCost = 0;
  for (const item of input.items) {
    const h = Math.max(item.hours || 0, 0);
    baseHours += h;
    const labor = (item.partnerId && partnerCost.get(item.partnerId)?.laborPerHour) || model.blendedLaborPerHour;
    laborCost += h * risk * labor;
  }
  const bufferedHours = baseHours * risk;
  const overheadCost = bufferedHours * model.overheadPerHour;
  const directCost = input.directCosts.reduce((s, c) => s + Math.max(c.amount || 0, 0), 0);
  const totalCost = laborCost + overheadCost + directCost;
  const productValue = Math.max(input.productValue || 0, 0);

  const adjust = (1 + Math.max(input.urgencyPct, 0) / 100) * (1 + Math.max(input.loadPct, 0) / 100);
  const tier = (marginPct: number) => roundPrice(priceForMargin(totalCost, marginPct) * adjust + productValue);

  const basePrice = priceForMargin(totalCost, input.marginPct);
  const urgencyAmount = (basePrice * Math.max(input.urgencyPct, 0)) / 100;
  const loadAmount = ((basePrice + urgencyAmount) * Math.max(input.loadPct, 0)) / 100;
  const beforeDiscount = basePrice + urgencyAmount + loadAmount + productValue;
  const discountAmount = (beforeDiscount * Math.min(Math.max(input.discountPct, 0), 100)) / 100;
  const hasWork = baseHours > 0 || directCost > 0 || productValue > 0;
  const suggestedPrice = hasWork ? roundPrice(beforeDiscount - discountAmount) : 0;

  const finalPrice = input.manualPrice != null && input.manualPrice >= 0 ? input.manualPrice : suggestedPrice;
  const profit = finalPrice - totalCost;
  const marginPct = finalPrice > 0 ? (profit / finalPrice) * 100 : 0;
  const meterPrice = baseHours > 0 ? rules.meterOpeningFee + rules.meterHourlyRate * baseHours + productValue : 0;

  const distribution = distribute(
    finalPrice - directCost,
    { type: input.projectType, finderId: input.finderId, executorId: input.executorId },
    rules,
    rules.partnerShares,
  );
  const partnersTake = distribution.shares.reduce((s, x) => s + x.amount, 0);
  const takeHomePerHour = safeDiv(partnersTake, bufferedHours);

  const vatAmount = rules.vatEnabled ? (finalPrice * rules.vatPct) / 100 : 0;

  let deliveryWeeks: number | null = null;
  let capacitySharePct: number | null = null;
  if (workload && workload.weeklyBillableHours > 0 && baseHours > 0) {
    if (input.billing === "monthly") {
      capacitySharePct = (bufferedHours / (workload.weeklyBillableHours * 4.33)) * 100;
    } else {
      deliveryWeeks = (workload.committedHours + bufferedHours) / workload.weeklyBillableHours;
    }
  }

  const warnings: QuoteWarning[] = [];
  if (hasWork && finalPrice < totalCost - 0.5) {
    warnings.push({
      code: "BELOW_COST",
      level: "danger",
      message: `السعر أقل من التكلفة الحقيقية بـ ${fmt(totalCost - finalPrice)} — كل ساعة في هذا المشروع خسارة.`,
    });
  } else if (hasWork && finalPrice > 0 && marginPct < rules.minMarginPct - 0.05) {
    warnings.push({
      code: "LOW_MARGIN",
      level: "warning",
      message: `الهامش ${marginPct.toFixed(0)}٪ أقل من الحد الأدنى المتفق عليه (${rules.minMarginPct}٪). التسعير تحت الحد يتطلب موافقة الطرفين.`,
    });
  }
  if (baseHours > 0 && meterPrice < totalCost) {
    warnings.push({
      code: "METER_BELOW_COST",
      level: "info",
      message: `قاعدة العداد الحالية تعطي ${fmt(meterPrice)} وهو أقل من التكلفة الحقيقية ${fmt(totalCost)}: وقتكما يُباع بأقل من قيمته.`,
    });
  }
  if (input.discountPct > 0 && hasWork && marginPct >= rules.minMarginPct && input.discountPct >= 25) {
    warnings.push({
      code: "DEEP_DISCOUNT",
      level: "info",
      message: "خصم كبير: اطلبوا مقابله شهادة عميل أو دراسة حالة مكتوبة في العرض.",
    });
  }
  if (capacitySharePct != null && capacitySharePct > 60) {
    warnings.push({
      code: "CAPACITY",
      level: "warning",
      message: `هذه الباقة تستهلك ${capacitySharePct.toFixed(0)}٪ من الطاقة الشهرية القابلة للفوترة. قبول ما يتجاوز الطاقة يتطلب موافقة الطرفين.`,
    });
  }
  if (deliveryWeeks != null && deliveryWeeks > 12) {
    warnings.push({
      code: "CAPACITY",
      level: "warning",
      message: `بالطاقة الحالية والمشاريع الجارية يحتاج التسليم نحو ${Math.ceil(deliveryWeeks)} أسبوعاً. فكّروا في تقليص النطاق أو الاستعانة بمستقل.`,
    });
  }

  return {
    baseHours: round2(baseHours),
    bufferedHours: round2(bufferedHours),
    laborCost: round2(laborCost),
    overheadCost: round2(overheadCost),
    directCost: round2(directCost),
    totalCost: round2(totalCost),
    basePrice: round2(basePrice),
    urgencyAmount: round2(urgencyAmount),
    loadAmount: round2(loadAmount),
    discountAmount: round2(discountAmount),
    productValue: round2(productValue),
    suggestedPrice,
    finalPrice: round2(finalPrice),
    profit: round2(profit),
    marginPct: round2(marginPct),
    effectiveHourlyRate: round2(safeDiv(finalPrice - directCost - productValue, baseHours)),
    meterPrice: round2(meterPrice),
    ladder: {
      floor: Math.ceil(totalCost),
      economy: tier(input.marginPct / 2),
      recommended: tier(input.marginPct),
      premium: tier(Math.min(input.marginPct + 15, 80)),
    },
    downPayment: round2((finalPrice * input.downPaymentPct) / 100),
    vatAmount: round2(vatAmount),
    totalWithVat: round2(finalPrice + vatAmount),
    distribution,
    takeHomePerHour: round2(takeHomePerHour),
    deliveryWeeks: deliveryWeeks == null ? null : round2(deliveryWeeks),
    capacitySharePct: capacitySharePct == null ? null : round2(capacitySharePct),
    warnings,
  };
}
