import { describe, expect, it } from "vitest";
import { distribute } from "./distribution";
import { computeSettlement, TREASURY } from "./settlement";

const rules = { treasuryPct: 20, finderPct: 20, executorPct: 60 };
const partners = [
  { id: "a", name: "أ", sharePct: 50 },
  { id: "b", name: "ب", sharePct: 50 },
];

describe("distribute", () => {
  it("splits a joint project: treasury first, rest by share", () => {
    const d = distribute(1000, { type: "joint", finderId: null, executorId: null }, rules, partners);
    expect(d.treasury).toBe(200);
    expect(d.shares.map((s) => s.amount)).toEqual([400, 400]);
  });

  it("splits an individual project: finder, executor, company", () => {
    const d = distribute(1000, { type: "individual", finderId: "a", executorId: "b" }, rules, partners);
    expect(d.treasury).toBe(200);
    expect(d.shares).toEqual([
      { partnerId: "a", name: "أ", role: "finder", amount: 200 },
      { partnerId: "b", name: "ب", role: "executor", amount: 600 },
    ]);
  });

  it("merges finder and executor when they are the same partner", () => {
    const d = distribute(1000, { type: "individual", finderId: "b", executorId: "b" }, rules, partners);
    expect(d.shares).toEqual([{ partnerId: "b", name: "ب", role: "finder_executor", amount: 800 }]);
  });

  it("returns an unclaimed finder share to the treasury", () => {
    const d = distribute(1000, { type: "individual", finderId: null, executorId: "b" }, rules, partners);
    expect(d.treasury).toBe(400);
  });

  it("never loses a halala to rounding", () => {
    const d = distribute(333.33, { type: "joint", finderId: null, executorId: null }, rules, [
      { id: "a", name: "أ", sharePct: 1 },
      { id: "b", name: "ب", sharePct: 1 },
      { id: "c", name: "ج", sharePct: 1 },
    ]);
    const total = d.treasury + d.shares.reduce((s, x) => s + x.amount, 0);
    expect(total).toBeCloseTo(333.33, 2);
  });
});

describe("computeSettlement", () => {
  const projects = [{ id: "p1", type: "joint" as const, finderId: null, executorId: null }];

  it("balances to zero and suggests the settling transfers", () => {
    const s = computeSettlement({
      rules,
      partners,
      projects,
      // «أ» استلم 2000 في حسابه الشخصي، و«ب» دفع 200 استضافة عامة و100 تكلفة مباشرة
      payments: [{ amount: 2000, projectId: "p1", receivedBy: "a" }],
      expenses: [
        { amount: 100, projectId: "p1", paidBy: "b" },
        { amount: 200, projectId: null, paidBy: "b" },
      ],
      transfers: [],
    });

    // صافي المشروع 1900: خزينة 380، ولكل شريك 760
    const a = s.partners.find((p) => p.id === "a")!;
    const b = s.partners.find((p) => p.id === "b")!;
    expect(a.entitlement).toBe(760);
    expect(b.entitlement).toBe(760);
    expect(s.treasury.entitlement).toBe(180); // 380 − 200 مصروف عام
    expect(a.cashHeld).toBe(2000);
    expect(b.cashHeld).toBe(-300);
    expect(a.balance).toBe(1240);
    expect(b.balance).toBe(-1060);
    expect(s.treasury.balance).toBe(-180);
    expect(a.balance + b.balance + s.treasury.balance).toBeCloseTo(0, 2);

    expect(s.suggestions).toEqual([
      { from: "a", fromName: "أ", to: "b", toName: "ب", amount: 1060 },
      { from: "a", fromName: "أ", to: TREASURY, toName: "خزينة الشركة", amount: 180 },
    ]);
  });

  it("clears the balances once the transfers are recorded", () => {
    const s = computeSettlement({
      rules,
      partners,
      projects,
      payments: [{ amount: 2000, projectId: "p1", receivedBy: "a" }],
      expenses: [
        { amount: 100, projectId: "p1", paidBy: "b" },
        { amount: 200, projectId: null, paidBy: "b" },
      ],
      transfers: [
        { amount: 1060, from: "a", to: "b" },
        { amount: 180, from: "a", to: null },
      ],
    });
    expect(s.partners.every((p) => p.balance === 0)).toBe(true);
    expect(s.treasury.balance).toBe(0);
    expect(s.suggestions).toEqual([]);
  });

  it("sends revenue without a project to the treasury", () => {
    const s = computeSettlement({
      rules,
      partners,
      projects,
      payments: [{ amount: 500, projectId: null, receivedBy: null }],
      expenses: [],
      transfers: [],
    });
    expect(s.treasury.entitlement).toBe(500);
    expect(s.treasury.balance).toBe(0);
  });
});
