import { addDays, todayISO } from "@/lib/format";
import { partnerOptions } from "../core/queries";
import { clientOptions } from "../crm/queries";
import type { QuoteDraft } from "./components/quote-builder";
import { emptyQuoteInput } from "./engine";
import { getPricingContext, listServices } from "./queries";

/** يجهّز ما تحتاجه الحاسبة من الخادم. */
export async function getBuilderProps() {
  const [{ settings, partners, model, rules, workload }, clients, services] = await Promise.all([
    getPricingContext(),
    clientOptions(),
    listServices(),
  ]);
  const blank: QuoteDraft = {
    title: "",
    clientId: null,
    serviceId: null,
    validUntil: addDays(todayISO(), settings.quoteValidityDays),
    scopeIncluded: "",
    scopeExcluded: "",
    notes: "",
    inputs: {
      ...emptyQuoteInput({ marginPct: settings.targetMarginPct, riskPct: settings.defaultRiskPct, downPaymentPct: settings.downPaymentPct }),
      loadPct: workload.suggestedLoadPct,
    },
  };
  return {
    blank,
    model,
    rules,
    workload,
    partners: partnerOptions(partners),
    clients,
    services: services.map((s) => ({ id: s.id, name: s.name, kind: s.kind, baseValue: s.baseValue, typicalHours: s.typicalHours })),
  };
}
