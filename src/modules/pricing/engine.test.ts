import { describe, expect, it } from "vitest";
import { assessWorkload, buildCostModel, computeQuote, emptyQuoteInput, priceForMargin, roundPrice, type PricingRules, type QuoteInput } from "./engine";

const partners = [
  { id: "a", name: "أ", weeklyHours: 15, hourlyCost: 100 },
  { id: "b", name: "ب", weeklyHours: 15, hourlyCost: 100 },
];
const model = buildCostModel({ annualOperatingCost: 8640, partners, workingWeeks: 48, utilizationPct: 60 });
const rules: PricingRules = {
  treasuryPct: 20,
  finderPct: 20,
  executorPct: 60,
  minMarginPct: 30,
  meterOpeningFee: 100,
  meterHourlyRate: 150,
  vatEnabled: false,
  vatPct: 15,
  partnerShares: [
    { id: "a", name: "أ", sharePct: 50 },
    { id: "b", name: "ب", sharePct: 50 },
  ],
};
const quote = (patch: Partial<QuoteInput>): QuoteInput => ({
  ...emptyQuoteInput({ marginPct: 30, riskPct: 0, downPaymentPct: 50 }),
  ...patch,
});

describe("buildCostModel", () => {
  it("derives billable hours and the loaded hourly cost", () => {
    expect(model.annualHours).toBe(1440);
    expect(model.billableHours).toBe(864);
    expect(model.weeklyBillableHours).toBe(18);
    expect(model.overheadPerHour).toBeCloseTo(10, 5);
    // 100 / 0.6 — non-billable time is carried by the billable hours
    expect(model.partners[0].laborPerHour).toBeCloseTo(166.667, 2);
    expect(model.breakEvenRate).toBeCloseTo(176.667, 2);
    expect(model.annualTotalCost).toBe(144000 + 8640);
  });

  it("survives zero capacity without dividing by zero", () => {
    const empty = buildCostModel({ annualOperatingCost: 1000, partners: [], workingWeeks: 48, utilizationPct: 60 });
    expect(empty.overheadPerHour).toBe(0);
    expect(empty.breakEvenRate).toBe(0);
  });
});

describe("price helpers", () => {
  it("applies margin on price, not markup on cost", () => {
    expect(priceForMargin(700, 30)).toBeCloseTo(1000, 5);
  });
  it("rounds up to a clean number", () => {
    expect(roundPrice(0)).toBe(0);
    expect(roundPrice(431)).toBe(440);
    expect(roundPrice(2524)).toBe(2550);
    expect(roundPrice(2550)).toBe(2550);
    expect(roundPrice(12010)).toBe(12100);
  });
});

describe("computeQuote", () => {
  it("prices hours at loaded cost plus margin", () => {
    const r = computeQuote(quote({ items: [{ title: "بناء", hours: 10, partnerId: "a" }] }), model, rules);
    expect(r.totalCost).toBeCloseTo(1766.67, 1);
    expect(r.suggestedPrice).toBe(2550); // 1766.67 / 0.7 = 2523.8 → 2550
    expect(r.finalPrice).toBe(2550);
    expect(r.marginPct).toBeGreaterThanOrEqual(30);
    expect(r.meterPrice).toBe(1600);
    expect(r.warnings.map((w) => w.code)).toContain("METER_BELOW_COST");
  });

  it("buffers hours for risk and passes direct costs through", () => {
    const r = computeQuote(
      quote({ items: [{ title: "بناء", hours: 10, partnerId: null }], riskPct: 20, directCosts: [{ title: "استضافة", amount: 300 }] }),
      model,
      rules,
    );
    expect(r.bufferedHours).toBe(12);
    expect(r.directCost).toBe(300);
    expect(r.totalCost).toBeCloseTo(12 * model.breakEvenRate + 300, 1);
  });

  it("adds the product value on top and counts it as profit", () => {
    const without = computeQuote(quote({ items: [{ title: "تخصيص", hours: 10, partnerId: "a" }] }), model, rules);
    const withValue = computeQuote(quote({ items: [{ title: "تخصيص", hours: 10, partnerId: "a" }], productValue: 1000 }), model, rules);
    expect(withValue.totalCost).toBe(without.totalCost);
    expect(withValue.suggestedPrice).toBeGreaterThan(without.suggestedPrice);
    expect(withValue.marginPct).toBeGreaterThan(without.marginPct);
    expect(withValue.meterPrice).toBe(without.meterPrice + 1000);
  });

  it("flags a manual price under cost and under the agreed margin", () => {
    const base = { items: [{ title: "بناء", hours: 10, partnerId: "a" }] };
    expect(computeQuote(quote({ ...base, manualPrice: 1000 }), model, rules).warnings[0].code).toBe("BELOW_COST");
    expect(computeQuote(quote({ ...base, manualPrice: 2000 }), model, rules).warnings[0].code).toBe("LOW_MARGIN");
    const ok = computeQuote(quote({ ...base, manualPrice: 3000 }), model, rules);
    expect(ok.warnings.find((w) => w.level !== "info")).toBeUndefined();
  });

  it("orders the price ladder floor < economy < recommended < premium", () => {
    const { ladder } = computeQuote(quote({ items: [{ title: "بناء", hours: 20, partnerId: null }] }), model, rules);
    expect(ladder.floor).toBeLessThan(ladder.economy);
    expect(ladder.economy).toBeLessThan(ladder.recommended);
    expect(ladder.recommended).toBeLessThan(ladder.premium);
  });

  it("previews a distribution that sums to the net", () => {
    const r = computeQuote(
      quote({ items: [{ title: "بناء", hours: 10, partnerId: "a" }], directCosts: [{ title: "أدوات", amount: 50 }], manualPrice: 3050 }),
      model,
      rules,
    );
    const d = r.distribution;
    expect(d.net).toBe(3000);
    expect(d.treasury).toBe(600);
    expect(d.shares.map((s) => s.amount)).toEqual([1200, 1200]);
    expect(r.takeHomePerHour).toBe(240);
  });

  it("returns zero for an empty quote", () => {
    const r = computeQuote(quote({}), model, rules);
    expect(r.suggestedPrice).toBe(0);
    expect(r.warnings).toEqual([]);
  });

  it("estimates delivery from backlog and capacity", () => {
    const r = computeQuote(quote({ items: [{ title: "بناء", hours: 36, partnerId: null }] }), model, rules, {
      committedHours: 18,
      weeklyBillableHours: 18,
    });
    expect(r.deliveryWeeks).toBe(3);
  });
});

describe("assessWorkload", () => {
  it("suggests a scarcity premium as the backlog grows", () => {
    expect(assessWorkload(0, 18).suggestedLoadPct).toBe(0);
    expect(assessWorkload(40, 18).suggestedLoadPct).toBe(5);
    expect(assessWorkload(80, 18).suggestedLoadPct).toBe(10);
    expect(assessWorkload(200, 18).suggestedLoadPct).toBe(20);
  });
});
