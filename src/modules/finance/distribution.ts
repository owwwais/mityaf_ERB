// توزيع صافي المشروع: الخزينة أولاً ثم الشركاء.
// منطق خالص بلا قاعدة بيانات — يستخدمه محرك التسعير (معاينة) والتسوية (فعلي).

export type DistributionRules = {
  treasuryPct: number;
  finderPct: number;
  executorPct: number;
};

export type PartnerShare = { id: string; name: string; sharePct: number };

export type ProjectSplit = {
  type: "joint" | "individual";
  finderId: string | null;
  executorId: string | null;
};

export type Distribution = {
  net: number;
  treasury: number;
  shares: { partnerId: string; name: string; role: "partner" | "finder" | "executor" | "finder_executor"; amount: number }[];
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * - مشترك: الخزينة تأخذ نسبتها، والباقي يُقسم على الشركاء بحصصهم.
 * - فردي: نسبة للجالب ونسبة للمنفّذ، وما بقي للخزينة.
 *   إن لم يُحدَّد جالب أو منفّذ تعود حصته للخزينة.
 * الصافي السالب (خسارة) يُوزَّع بالنسب نفسها.
 */
export function distribute(
  net: number,
  split: ProjectSplit,
  rules: DistributionRules,
  partners: PartnerShare[],
): Distribution {
  const byId = new Map(partners.map((p) => [p.id, p]));
  const executor = split.executorId ? byId.get(split.executorId) : undefined;

  if (split.type === "individual" && executor) {
    const finder = split.finderId ? byId.get(split.finderId) : undefined;
    const finderAmount = finder ? round2((net * rules.finderPct) / 100) : 0;
    const executorAmount = round2((net * rules.executorPct) / 100);
    const shares: Distribution["shares"] = [];
    if (finder && finder.id === executor.id) {
      shares.push({
        partnerId: executor.id,
        name: executor.name,
        role: "finder_executor",
        amount: round2(finderAmount + executorAmount),
      });
    } else {
      if (finder) shares.push({ partnerId: finder.id, name: finder.name, role: "finder", amount: finderAmount });
      shares.push({ partnerId: executor.id, name: executor.name, role: "executor", amount: executorAmount });
    }
    return { net: round2(net), treasury: round2(net - finderAmount - executorAmount), shares };
  }

  const totalShare = partners.reduce((s, p) => s + p.sharePct, 0);
  if (totalShare <= 0) return { net: round2(net), treasury: round2(net), shares: [] };

  const pool = net * (1 - rules.treasuryPct / 100);
  const shares = partners.map((p) => ({
    partnerId: p.id,
    name: p.name,
    role: "partner" as const,
    amount: round2((pool * p.sharePct) / totalShare),
  }));
  const distributed = shares.reduce((s, x) => s + x.amount, 0);
  return { net: round2(net), treasury: round2(net - distributed), shares };
}
