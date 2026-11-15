// التسوية بين الشركاء والخزينة.
// السؤال الذي تجيب عنه: «من يحمل المال الآن؟ ولمن يعود؟»
// لأن التحصيل والصرف يمرّان بحسابات شخصية، نفصل بين:
//   النقد المحمول  = ما استلمه الطرف − ما صرفه ± التحويلات
//   الاستحقاق      = حصته من صافي المشاريع (والخزينة تتحمل المصروف التشغيلي العام)
// الفرق بينهما هو ما يجب تسويته، ومجموع الفروق دائماً صفر.

import { distribute, type DistributionRules, type PartnerShare } from "./distribution";

export const TREASURY = "treasury";

export type SettlementInput = {
  rules: DistributionRules;
  partners: PartnerShare[];
  projects: { id: string; type: "joint" | "individual"; finderId: string | null; executorId: string | null }[];
  payments: { amount: number; projectId: string | null; receivedBy: string | null }[];
  expenses: { amount: number; projectId: string | null; paidBy: string | null }[];
  transfers: { amount: number; from: string | null; to: string | null }[];
};

export type PartyPosition = {
  id: string;
  name: string;
  /** ما يستحقه من الأرباح (أو رصيد الخزينة الدفتري). */
  entitlement: number;
  /** النقد الذي بحوزته فعلاً. */
  cashHeld: number;
  /** موجب = بحوزته أكثر من حقه (عليه أن يحوّل). سالب = له مبلغ لم يستلمه. */
  balance: number;
  received: number;
  spent: number;
};

export type Settlement = {
  treasury: PartyPosition & { projectShare: number; generalRevenue: number; overhead: number };
  partners: PartyPosition[];
  projectNets: Map<string, { revenue: number; directCost: number; net: number; treasury: number; shares: Map<string, number> }>;
  suggestions: { from: string; fromName: string; to: string; toName: string; amount: number }[];
  totals: { revenue: number; expenses: number; cash: number };
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function computeSettlement(input: SettlementInput): Settlement {
  const { rules, partners, projects } = input;
  const projectIds = new Set(projects.map((p) => p.id));

  // 1) النقد المحمول لدى كل طرف
  const received = new Map<string, number>();
  const spent = new Map<string, number>();
  const transferNet = new Map<string, number>();
  const add = (m: Map<string, number>, k: string, v: number) => m.set(k, (m.get(k) ?? 0) + v);
  const partnerIds = new Set(partners.map((p) => p.id));
  // طرف محذوف أو غير معروف يُعامل كخزينة حتى لا يضيع المبلغ من الحساب.
  const party = (id: string | null) => (id && partnerIds.has(id) ? id : TREASURY);

  for (const p of input.payments) add(received, party(p.receivedBy), p.amount);
  for (const e of input.expenses) add(spent, party(e.paidBy), e.amount);
  for (const t of input.transfers) {
    add(transferNet, party(t.from), -t.amount);
    add(transferNet, party(t.to), t.amount);
  }

  // 2) صافي كل مشروع وتوزيعه
  const revenueByProject = new Map<string, number>();
  const costByProject = new Map<string, number>();
  let generalRevenue = 0;
  let overhead = 0;
  for (const p of input.payments) {
    if (p.projectId && projectIds.has(p.projectId)) add(revenueByProject, p.projectId, p.amount);
    else generalRevenue += p.amount;
  }
  for (const e of input.expenses) {
    if (e.projectId && projectIds.has(e.projectId)) add(costByProject, e.projectId, e.amount);
    else overhead += e.amount;
  }

  const entitlement = new Map<string, number>();
  const projectNets: Settlement["projectNets"] = new Map();
  let treasuryProjectShare = 0;
  for (const project of projects) {
    const revenue = revenueByProject.get(project.id) ?? 0;
    const directCost = costByProject.get(project.id) ?? 0;
    if (revenue === 0 && directCost === 0) continue;
    const d = distribute(revenue - directCost, project, rules, partners);
    treasuryProjectShare += d.treasury;
    const shares = new Map<string, number>();
    for (const s of d.shares) {
      add(entitlement, s.partnerId, s.amount);
      add(shares, s.partnerId, s.amount);
    }
    projectNets.set(project.id, { revenue, directCost, net: d.net, treasury: d.treasury, shares });
  }

  // 3) المراكز
  const position = (id: string, name: string, ent: number): PartyPosition => {
    const r = received.get(id) ?? 0;
    const s = spent.get(id) ?? 0;
    const cashHeld = round2(r - s + (transferNet.get(id) ?? 0));
    return { id, name, entitlement: round2(ent), cashHeld, balance: round2(cashHeld - ent), received: round2(r), spent: round2(s) };
  };

  const treasuryEntitlement = treasuryProjectShare + generalRevenue - overhead;
  const treasury = {
    ...position(TREASURY, "خزينة الشركة", treasuryEntitlement),
    projectShare: round2(treasuryProjectShare),
    generalRevenue: round2(generalRevenue),
    overhead: round2(overhead),
  };
  const partnerPositions = partners.map((p) => position(p.id, p.name, entitlement.get(p.id) ?? 0));

  // 4) اقتراح أقل عدد من التحويلات لتصفير الفروق
  const debtors = [treasury, ...partnerPositions]
    .filter((p) => p.balance > 0.005)
    .map((p) => ({ id: p.id, name: p.name, left: p.balance }))
    .sort((a, b) => b.left - a.left);
  const creditors = [treasury, ...partnerPositions]
    .filter((p) => p.balance < -0.005)
    .map((p) => ({ id: p.id, name: p.name, left: -p.balance }))
    .sort((a, b) => b.left - a.left);
  const suggestions: Settlement["suggestions"] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amount = round2(Math.min(debtors[i].left, creditors[j].left));
    if (amount > 0) {
      suggestions.push({
        from: debtors[i].id,
        fromName: debtors[i].name,
        to: creditors[j].id,
        toName: creditors[j].name,
        amount,
      });
    }
    debtors[i].left = round2(debtors[i].left - amount);
    creditors[j].left = round2(creditors[j].left - amount);
    if (debtors[i].left <= 0.005) i++;
    if (creditors[j].left <= 0.005) j++;
  }

  const revenue = input.payments.reduce((s, p) => s + p.amount, 0);
  const expensesTotal = input.expenses.reduce((s, e) => s + e.amount, 0);
  return {
    treasury,
    partners: partnerPositions,
    projectNets,
    suggestions,
    totals: { revenue: round2(revenue), expenses: round2(expensesTotal), cash: round2(revenue - expensesTotal) },
  };
}
