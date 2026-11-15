"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import { Check, ExternalLink, LoaderCircle, Plus, Printer, RotateCcw, Send, X } from "lucide-react";
import type { Option } from "@/components/form";
import { Alert, Badge, Row, cx } from "@/components/ui";
import { hours as fmtHours, money, num, pct, weeks as fmtWeeks } from "@/lib/format";
import { parseNumber } from "@/lib/validation";
import { acceptQuote, saveQuote, setQuoteStatus, type QuotePayload } from "../actions";
import { computeQuote, type CostModel, type PricingRules, type QuoteInput, type QuoteResult, type Workload } from "../engine";
import { QUOTE_STATUSES, RISK_OPTIONS, URGENCY_OPTIONS, type QuoteStatus } from "../model";

type ServiceOption = { id: string; name: string; kind: string; baseValue: number; typicalHours: number };

export type QuoteDraft = Omit<QuotePayload, "inputs"> & { inputs: QuoteInput };

type Props = {
  quoteId: string | null;
  number?: string;
  status?: QuoteStatus;
  projectId?: string | null;
  initial: QuoteDraft;
  model: CostModel;
  rules: PricingRules;
  workload: Workload;
  partners: Option[];
  clients: Option[];
  services: ServiceOption[];
};

// ───────────────────────── حقول صغيرة ─────────────────────────

/** حقل رقمي حرّ الكتابة: يقبل الأرقام العربية ولا يقفز المؤشر أثناء الكتابة. */
function NumInput({
  value,
  onChange,
  className,
  placeholder = "0",
  label,
  suffix,
  nullable,
}: {
  value: number | null;
  onChange: (n: number | null) => void;
  className?: string;
  placeholder?: string;
  label: string;
  suffix?: string;
  nullable?: boolean;
}) {
  const toText = (n: number | null) => (n == null || (n === 0 && !nullable) ? "" : String(n));
  const [text, setText] = useState(toText(value));

  useEffect(() => {
    const parsed = text.trim() === "" ? (nullable ? null : 0) : parseNumber(text);
    if (parsed !== value && !(Number.isNaN(parsed as number) && value === 0)) setText(toText(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className={cx("relative", className)}>
      <input
        type="text"
        inputMode="decimal"
        dir="ltr"
        aria-label={label}
        placeholder={placeholder}
        className={cx("input input-sm text-right", suffix && "pl-9")}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          if (e.target.value.trim() === "") return onChange(nullable ? null : 0);
          const n = parseNumber(e.target.value);
          if (Number.isFinite(n) && n >= 0) onChange(n);
        }}
      />
      {suffix && <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-xs text-ink-3">{suffix}</span>}
    </div>
  );
}

function Section({ step, title, hint, children }: { step: number; title: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <section className="card">
      <div className="flex items-start gap-3 border-b border-line px-5 py-3.5">
        <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary-ink">{num(step, 0)}</span>
        <div>
          <h2 className="text-[15px] font-semibold">{title}</h2>
          {hint && <p className="mt-0.5 text-[13px] leading-relaxed text-ink-3">{hint}</p>}
        </div>
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

/** تسمية مرتبطة بحقلها صراحةً (htmlFor)، أو عنوان لمجموعة حقول تحمل تسمياتها بنفسها. */
function Labeled({ label, hint, children, className, htmlFor }: { label: string; hint?: ReactNode; children: ReactNode; className?: string; htmlFor?: string }) {
  return (
    <div className={className}>
      {htmlFor ? (
        <label htmlFor={htmlFor} className="label">
          {label}
        </label>
      ) : (
        <span className="label">{label}</span>
      )}
      {children}
      {hint && <p className="mt-1 text-xs leading-relaxed text-ink-3">{hint}</p>}
    </div>
  );
}

function Chips({ options, value, onChange, label }: { options: { value: number; label: string }[]; value: number; onChange: (v: number) => void; label: string }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" className="chip" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ───────────────────────── سلّم السعر ─────────────────────────

function PriceLadder({ result, minMarginPct, onPick }: { result: QuoteResult; minMarginPct: number; onPick: (price: number) => void }) {
  const { ladder, finalPrice, meterPrice, totalCost } = result;
  const tiers = [
    { key: "economy", label: "اقتصادي", price: ladder.economy, note: "للمسار المخفّض" },
    { key: "recommended", label: "الموصى به", price: ladder.recommended, note: "الهامش المستهدف" },
    { key: "premium", label: "مميّز", price: ladder.premium, note: "أولوية ودعم ممتد" },
  ];
  const max = Math.max(ladder.premium, finalPrice, meterPrice, 1) * 1.06;
  const at = (v: number) => `${Math.min(Math.max(v / max, 0), 1) * 100}%`;
  const minOk = totalCost / (1 - Math.min(minMarginPct, 90) / 100);
  const margin = (price: number) => (price > 0 ? ((price - totalCost) / price) * 100 : 0);

  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        {tiers.map((t) => {
          const active = Math.abs(finalPrice - t.price) < 0.5;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => onPick(t.price)}
              aria-pressed={active}
              className={cx(
                "rounded-lg border px-2 py-2 text-center transition-colors",
                active ? "border-primary bg-primary-soft" : "border-line hover:border-line-strong hover:bg-surface-2",
              )}
            >
              <span className="block text-[11.5px] font-semibold text-ink-2">{t.label}</span>
              <span className="block text-[15px] font-bold">{num(t.price, 0)}</span>
              <span className="block text-[11px] text-ink-3">هامش {pct(margin(t.price))}</span>
            </button>
          );
        })}
      </div>

      {/* المقياس: منطقة الخسارة ← هامش ضعيف ← سليم */}
      <div className="relative mt-7 mb-9 h-2.5 rounded-full" style={{ background: "color-mix(in srgb, var(--status-good) 30%, var(--surface-2))" }}>
        <div className="absolute inset-y-0 start-0 rounded-s-full" style={{ width: at(minOk), background: "color-mix(in srgb, var(--status-warning) 55%, var(--surface-2))" }} />
        <div className="absolute inset-y-0 start-0 rounded-s-full" style={{ width: at(totalCost), background: "color-mix(in srgb, var(--status-critical) 60%, var(--surface-2))" }} />
        {meterPrice > 0 && (
          <div className="absolute top-full mt-1 -translate-x-[-50%]" style={{ insetInlineStart: at(meterPrice) }}>
            <span className="mx-auto block h-2 w-px bg-ink-3" />
            <span className="block text-[10.5px] whitespace-nowrap text-ink-3">العداد {num(meterPrice, 0)}</span>
          </div>
        )}
        <div className="absolute bottom-full mb-1 -translate-x-[-50%]" style={{ insetInlineStart: at(finalPrice) }}>
          <span className="block text-[10.5px] font-bold whitespace-nowrap text-primary-ink">السعر</span>
          <span className="mx-auto block h-2 w-0.5 bg-primary" />
        </div>
        <span
          className="absolute top-1/2 size-4 -translate-y-1/2 rounded-full border-2 bg-primary"
          style={{ insetInlineStart: `calc(${at(finalPrice)} - 8px)`, borderColor: "var(--surface)" }}
          aria-hidden
        />
      </div>
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-ink-3">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ background: "var(--status-critical)" }} /> خسارة (تحت {num(totalCost, 0)})
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ background: "var(--status-warning)" }} /> هامش تحت {pct(minMarginPct)}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ background: "var(--status-good)" }} /> سليم
        </span>
      </p>
    </div>
  );
}

// ───────────────────────── الحاسبة ─────────────────────────

export function QuoteBuilder({ quoteId, number, status = "draft", projectId, initial, model, rules, workload, partners, clients, services }: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState<QuoteDraft>(initial);
  const [saved, setSaved] = useState(() => JSON.stringify(initial));
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const inputs = draft.inputs;
  const result = useMemo(() => computeQuote(inputs, model, rules, workload), [inputs, model, rules, workload]);
  const dirty = JSON.stringify(draft) !== saved;
  const locked = status === "accepted";
  const monthly = inputs.billing === "monthly";
  const per = monthly ? " / شهر" : "";

  const patch = (p: Partial<QuoteDraft>) => setDraft((d) => ({ ...d, ...p }));
  const patchInputs = (p: Partial<QuoteInput>) => setDraft((d) => ({ ...d, inputs: { ...d.inputs, ...p } }));
  const setItem = (i: number, p: Partial<QuoteInput["items"][number]>) =>
    patchInputs({ items: inputs.items.map((item, idx) => (idx === i ? { ...item, ...p } : item)) });
  const setCost = (i: number, p: Partial<QuoteInput["directCosts"][number]>) =>
    patchInputs({ directCosts: inputs.directCosts.map((c, idx) => (idx === i ? { ...c, ...p } : c)) });

  function pickService(id: string) {
    const service = services.find((s) => s.id === id);
    if (!service) return patch({ serviceId: null });
    const untouched = inputs.items.every((i) => !i.title && !i.hours);
    setDraft((d) => ({
      ...d,
      serviceId: id,
      title: d.title || service.name,
      inputs: {
        ...d.inputs,
        productValue: service.baseValue > 0 ? service.baseValue : d.inputs.productValue,
        items: untouched && service.typicalHours > 0 ? [{ title: service.name, hours: service.typicalHours, partnerId: null }] : d.inputs.items,
      },
    }));
  }

  function save(after?: (id: string) => Promise<void> | void) {
    setMessage(null);
    startTransition(async () => {
      const res = await saveQuote(quoteId, draft);
      if (!res.ok) return setMessage({ ok: false, text: res.message });
      setSaved(JSON.stringify(draft));
      const id = res.id ?? quoteId;
      if (after && id) await after(id);
      else if (!quoteId && id) router.replace(`/pricing/${id}`);
      else {
        setMessage({ ok: true, text: "حُفظ العرض." });
        router.refresh();
      }
    });
  }

  function changeStatus(next: "draft" | "sent" | "rejected") {
    startTransition(async () => {
      const res = await setQuoteStatus(quoteId!, next);
      if (!res.ok) return setMessage({ ok: false, text: res.message });
      router.refresh();
    });
  }

  function accept() {
    if (!window.confirm("قبول العرض ينشئ مشروعاً بسعره وساعاته وينقل العميل إلى «فاز». متابعة؟")) return;
    startTransition(async () => {
      const res = await acceptQuote(quoteId!);
      if (!res.ok) return setMessage({ ok: false, text: res.message });
      router.push(`/projects/${res.id}`);
    });
  }

  const canSave = draft.title.trim().length > 0 && !locked;
  const partnerSelect = (value: string | null, onChange: (v: string | null) => void, label: string, empty: string) => (
    <select aria-label={label} className="input input-sm" value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}>
      <option value="">{empty}</option>
      {partners.map((p) => (
        <option key={p.value} value={p.value}>
          {p.label}
        </option>
      ))}
    </select>
  );

  return (
    <div className="grid items-start gap-5 pb-20 lg:grid-cols-[minmax(0,1fr)_380px] lg:pb-0">
      {/* ── المدخلات ── */}
      <fieldset disabled={locked} className="min-w-0 space-y-5">
        <Section step={1} title="العرض">
          <div className="grid gap-4 sm:grid-cols-2">
            <Labeled label="الخدمة أو المنتج" htmlFor="q-service" hint="اختيار منتج جاهز يضيف قيمته فوق سعر الساعات.">
              <select id="q-service" className="input" value={draft.serviceId ?? ""} onChange={(e) => pickService(e.target.value)}>
                <option value="">— اختر —</option>
                {(["product", "service", "consulting"] as const).map((kind) => (
                  <optgroup key={kind} label={kind === "product" ? "منتجاتنا" : kind === "service" ? "الخدمات" : "الاستشارات"}>
                    {services
                      .filter((s) => s.kind === kind)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
            </Labeled>
            <Labeled label="العميل" htmlFor="q-client">
              <select id="q-client" className="input" value={draft.clientId ?? ""} onChange={(e) => patch({ clientId: e.target.value || null })}>
                <option value="">— بلا عميل محدد —</option>
                {clients.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Labeled>
            <Labeled label="عنوان العرض" htmlFor="q-title" className="sm:col-span-2">
              <input id="q-title" className="input" value={draft.title} onChange={(e) => patch({ title: e.target.value })} placeholder="مثال: تخصيص منصة الحجوزات لعيادة…" />
            </Labeled>
            <Labeled label="طريقة الفوترة" hint={monthly ? "أدخل ساعات وتكاليف الشهر الواحد." : undefined}>
              <div className="flex gap-1.5">
                {(["one_time", "monthly"] as const).map((b) => (
                  <button key={b} type="button" className="chip" aria-pressed={inputs.billing === b} onClick={() => patchInputs({ billing: b })}>
                    {b === "one_time" ? "سعر مقطوع" : "باقة شهرية"}
                  </button>
                ))}
              </div>
            </Labeled>
            <Labeled label="صالح حتى" htmlFor="q-valid">
              <input id="q-valid" type="date" className="input" value={draft.validUntil ?? ""} onChange={(e) => patch({ validUntil: e.target.value || null })} />
            </Labeled>
          </div>
        </Section>

        <Section step={2} title="حجم العمل" hint="فكّك المشروع إلى بنود وقدّر ساعات كل بند. من ينفّذ البند يحدد تكلفة ساعته.">
          <div className="space-y-2">
            {inputs.items.map((item, i) => (
              <div key={i} className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:grid-cols-[minmax(0,1fr)_5.5rem_9.5rem_auto]">
                <input
                  className="input input-sm"
                  aria-label={`البند ${i + 1}`}
                  placeholder="مثال: تخصيص الواجهة"
                  value={item.title}
                  onChange={(e) => setItem(i, { title: e.target.value })}
                />
                <button
                  type="button"
                  className="btn btn-ghost btn-icon text-ink-3 hover:text-danger sm:order-last"
                  aria-label="حذف البند"
                  onClick={() => patchInputs({ items: inputs.items.filter((_, idx) => idx !== i) })}
                >
                  <X size={16} />
                </button>
                <NumInput label={`ساعات البند ${i + 1}`} value={item.hours} onChange={(n) => setItem(i, { hours: n ?? 0 })} suffix="س" />
                {partnerSelect(item.partnerId, (v) => setItem(i, { partnerId: v }), `منفّذ البند ${i + 1}`, "أي شريك")}
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => patchInputs({ items: [...inputs.items, { title: "", hours: 0, partnerId: null }] })}>
              <Plus size={15} /> بند
            </button>
            <p className="text-sm text-ink-2">
              المجموع <strong>{fmtHours(result.baseHours)}</strong>
              {inputs.riskPct > 0 && result.baseHours > 0 && (
                <>
                  {" "}
                  · مع المخاطرة <strong>{fmtHours(result.bufferedHours)}</strong>
                </>
              )}
            </p>
          </div>

          <div className="mt-5 border-t border-line pt-4">
            <span className="label">وضوح النطاق (هامش مخاطرة على الساعات)</span>
            <div className="flex flex-wrap items-center gap-2">
              <Chips label="هامش المخاطرة" options={RISK_OPTIONS} value={inputs.riskPct} onChange={(v) => patchInputs({ riskPct: v })} />
              <NumInput label="هامش المخاطرة ٪" value={inputs.riskPct} onChange={(n) => patchInputs({ riskPct: n ?? 0 })} suffix="٪" className="w-20" />
            </div>
            <p className="mt-1.5 text-xs text-ink-3">تجاوز الساعات المقدّرة بأكثر من 20٪ يعني أن الخلل في التقدير لا في التنفيذ.</p>
          </div>
        </Section>

        <Section step={3} title="تكاليف مباشرة" hint="ما يُدفع لطرف ثالث من أجل هذا المشروع تحديداً: استضافة، تراخيص، مستقل.">
          {inputs.directCosts.length > 0 && (
            <div className="mb-3 space-y-2">
              {inputs.directCosts.map((c, i) => (
                <div key={i} className="grid grid-cols-[minmax(0,1fr)_7.5rem_auto] gap-2">
                  <input className="input input-sm" aria-label={`تكلفة ${i + 1}`} placeholder="مثال: استضافة السنة الأولى" value={c.title} onChange={(e) => setCost(i, { title: e.target.value })} />
                  <NumInput label={`مبلغ التكلفة ${i + 1}`} value={c.amount} onChange={(n) => setCost(i, { amount: n ?? 0 })} suffix="ر.س" />
                  <button
                    type="button"
                    className="btn btn-ghost btn-icon text-ink-3 hover:text-danger"
                    aria-label="حذف التكلفة"
                    onClick={() => patchInputs({ directCosts: inputs.directCosts.filter((_, idx) => idx !== i) })}
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => patchInputs({ directCosts: [...inputs.directCosts, { title: "", amount: 0 }] })}>
            <Plus size={15} /> تكلفة مباشرة
          </button>
        </Section>

        <Section step={4} title="عوامل السعر">
          <div className="grid gap-x-4 gap-y-5 sm:grid-cols-2">
            <Labeled label="هامش الربح المستهدف" hint={`من السعر، بعد احتساب وقتكما بسعره الحقيقي. الحد الأدنى المتفق عليه ${rules.minMarginPct}٪.`}>
              <NumInput label="هامش الربح ٪" value={inputs.marginPct} onChange={(n) => patchInputs({ marginPct: Math.min(n ?? 0, 90) })} suffix="٪" className="w-28" />
            </Labeled>
            <Labeled label="قيمة المنتج الجاهز" hint="إن بُني المشروع على أحد منتجاتكم: قيمة ما سبق بناؤه، تُضاف فوق سعر الساعات.">
              <NumInput label="قيمة المنتج" value={inputs.productValue} onChange={(n) => patchInputs({ productValue: n ?? 0 })} suffix="ر.س" className="w-36" />
            </Labeled>
            <div>
              <span className="label">الاستعجال</span>
              <Chips label="الاستعجال" options={URGENCY_OPTIONS} value={inputs.urgencyPct} onChange={(v) => patchInputs({ urgencyPct: v })} />
            </div>
            <div>
              <span className="label">ضغط العمل الحالي</span>
              <div className="flex flex-wrap items-center gap-2">
                <NumInput label="علاوة ضغط العمل ٪" value={inputs.loadPct} onChange={(n) => patchInputs({ loadPct: n ?? 0 })} suffix="٪" className="w-24" />
                {workload.suggestedLoadPct !== inputs.loadPct && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => patchInputs({ loadPct: workload.suggestedLoadPct })}>
                    المقترح {pct(workload.suggestedLoadPct)}
                  </button>
                )}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-ink-3">
                {workload.committedHours > 0
                  ? `في الجدول ${Math.round(workload.committedHours)} ساعة ملتزم بها ≈ ${num(workload.backlogWeeks, 1)} أسبوع عمل. كلما امتلأ الجدول ارتفعت قيمة الساعة المتبقية.`
                  : "الجدول فارغ حالياً: لا علاوة ندرة."}
              </p>
            </div>
            <Labeled label="خصم" hint="للمسار المخفّض أو أول العملاء. اطلبوا مقابله شهادة أو دراسة حالة.">
              <NumInput label="الخصم ٪" value={inputs.discountPct} onChange={(n) => patchInputs({ discountPct: Math.min(n ?? 0, 100) })} suffix="٪" className="w-28" />
            </Labeled>
            <Labeled label="الدفعة المقدمة" hint="اختبار جدية العميل قبل أن تكون سيولة.">
              <NumInput label="الدفعة المقدمة ٪" value={inputs.downPaymentPct} onChange={(n) => patchInputs({ downPaymentPct: Math.min(n ?? 0, 100) })} suffix="٪" className="w-28" />
            </Labeled>
          </div>
        </Section>

        <Section step={5} title="توزيع العائد" hint="يحدد كيف يُقسم صافي المشروع بعد تكاليفه المباشرة.">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <span className="label">نوع المشروع</span>
              <div className="flex gap-1.5">
                {(["joint", "individual"] as const).map((t) => (
                  <button key={t} type="button" className="chip" aria-pressed={inputs.projectType === t} onClick={() => patchInputs({ projectType: t })}>
                    {t === "joint" ? "مشترك" : "فردي"}
                  </button>
                ))}
              </div>
            </div>
            {inputs.projectType === "individual" && (
              <>
                <Labeled label={`جالب المشروع (${rules.finderPct}٪)`}>{partnerSelect(inputs.finderId, (v) => patchInputs({ finderId: v }), "جالب المشروع", "— لا أحد —")}</Labeled>
                <Labeled label={`المنفّذ (${rules.executorPct}٪)`}>{partnerSelect(inputs.executorId, (v) => patchInputs({ executorId: v }), "المنفّذ", "— اختر —")}</Labeled>
              </>
            )}
          </div>
        </Section>

        <Section step={6} title="النطاق" hint="ما يظهر للعميل في العرض. النطاق الواضح يمنع التعديلات التي تتوسع دون اتفاق.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Labeled label="المشمول" htmlFor="q-included">
              <textarea id="q-included" className="input" rows={4} value={draft.scopeIncluded} onChange={(e) => patch({ scopeIncluded: e.target.value })} placeholder="ما الذي سيُسلَّم بالضبط؟" />
            </Labeled>
            <Labeled label="غير المشمول" htmlFor="q-excluded">
              <textarea id="q-excluded" className="input" rows={4} value={draft.scopeExcluded} onChange={(e) => patch({ scopeExcluded: e.target.value })} placeholder="ما الذي يُسعَّر مستقلاً إن طُلب؟" />
            </Labeled>
            <Labeled label="ملاحظات داخلية" htmlFor="q-notes" hint="لا تظهر للعميل." className="sm:col-span-2">
              <textarea id="q-notes" className="input" rows={2} value={draft.notes} onChange={(e) => patch({ notes: e.target.value })} />
            </Labeled>
          </div>
        </Section>
      </fieldset>

      {/* ── النتيجة ── */}
      <aside className="space-y-4 lg:sticky lg:top-6">
        <div className="card overflow-hidden">
          <div className="h-1" style={{ background: "var(--spectrum)" }} aria-hidden />
          <div className="p-5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[13px] font-medium text-ink-3">{number ? `عرض ${number}` : "عرض جديد"}</p>
              <Badge tone={QUOTE_STATUSES[status].tone}>{QUOTE_STATUSES[status].label}</Badge>
            </div>
            <p className="mt-2 text-[13px] text-ink-2">السعر النهائي{per}</p>
            <p className="text-[34px] leading-tight font-bold tracking-tight" aria-live="polite">
              {money(result.finalPrice, { digits: 0 })}
            </p>
            {rules.vatEnabled && result.finalPrice > 0 && (
              <p className="text-[13px] text-ink-3">
                + ضريبة {pct(rules.vatPct)} = {money(result.totalWithVat, { digits: 0 })}
              </p>
            )}

            <div className="mt-3 flex items-end gap-2">
              <Labeled label="سعر يدوي" className="flex-1">
                <NumInput
                  label="سعر يدوي"
                  nullable
                  value={inputs.manualPrice}
                  onChange={(n) => patchInputs({ manualPrice: n })}
                  placeholder={result.suggestedPrice ? String(result.suggestedPrice) : "0"}
                  suffix="ر.س"
                />
              </Labeled>
              {inputs.manualPrice != null && !locked && (
                <button type="button" className="btn btn-ghost btn-sm mb-0.5" onClick={() => patchInputs({ manualPrice: null })} title="العودة للسعر المقترح">
                  <RotateCcw size={14} /> المقترح {num(result.suggestedPrice, 0)}
                </button>
              )}
            </div>

            {result.totalCost > 0 && (
              <div className="mt-4">
                <PriceLadder result={result} minMarginPct={rules.minMarginPct} onPick={(price) => !locked && patchInputs({ manualPrice: price })} />
              </div>
            )}

            {result.warnings.length > 0 && (
              <div className="mt-4 space-y-2">
                {result.warnings.map((w) => (
                  <Alert key={w.code + w.message} level={w.level}>
                    {w.message}
                  </Alert>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="card p-5">
          <h3 className="mb-1 text-sm font-semibold">من أين جاء السعر؟</h3>
          <Row label={`وقت الفريق (${fmtHours(result.bufferedHours)})`} value={money(result.laborCost, { digits: 0 })} />
          <Row label="نصيب التكاليف التشغيلية" value={money(result.overheadCost, { digits: 0 })} />
          {result.directCost > 0 && <Row label="تكاليف مباشرة" value={money(result.directCost, { digits: 0 })} />}
          <div className="border-t border-line">
            <Row label="التكلفة الحقيقية" value={money(result.totalCost, { digits: 0 })} strong />
          </div>
          <Row label={`هامش ${pct(inputs.marginPct)}`} value={money(result.basePrice - result.totalCost, { digits: 0, sign: true })} />
          {result.urgencyAmount > 0 && <Row label={`استعجال ${pct(inputs.urgencyPct)}`} value={money(result.urgencyAmount, { digits: 0, sign: true })} />}
          {result.loadAmount > 0 && <Row label={`ضغط العمل ${pct(inputs.loadPct)}`} value={money(result.loadAmount, { digits: 0, sign: true })} />}
          {result.productValue > 0 && <Row label="قيمة المنتج الجاهز" value={money(result.productValue, { digits: 0, sign: true })} />}
          {result.discountAmount > 0 && <Row label={`خصم ${pct(inputs.discountPct)}`} value={money(-result.discountAmount, { digits: 0 })} />}
          <div className="border-t border-line">
            <Row label="الربح بعد التكلفة" value={money(result.profit, { digits: 0, sign: true })} strong />
            <Row label="الهامش الفعلي" value={pct(result.marginPct)} />
            {result.baseHours > 0 && <Row label="سعر الساعة المبيعة" value={money(result.effectiveHourlyRate, { digits: 0 })} />}
            {result.meterPrice > 0 && <Row label="بقاعدة العداد الحالية" value={money(result.meterPrice, { digits: 0 })} muted />}
          </div>
        </div>

        <div className="card p-5">
          <h3 className="mb-1 text-sm font-semibold">أين يذهب المبلغ؟</h3>
          <Row label="الدفعة المقدمة" value={`${money(result.downPayment, { digits: 0 })} (${pct(inputs.downPaymentPct)})`} />
          <Row label="خزينة الشركة" value={money(result.distribution.treasury, { digits: 0 })} />
          {result.distribution.shares.map((s) => (
            <Row
              key={s.partnerId + s.role}
              label={`${s.name}${s.role === "finder" ? " (جالب)" : s.role === "executor" ? " (منفّذ)" : s.role === "finder_executor" ? " (جالب ومنفّذ)" : ""}`}
              value={money(s.amount, { digits: 0 })}
            />
          ))}
          {result.bufferedHours > 0 && (
            <div className="mt-1 border-t border-line pt-1">
              <Row label="عائد الساعة الفعلي للشركاء" value={money(result.takeHomePerHour, { digits: 0 })} strong />
            </div>
          )}
          {result.deliveryWeeks != null && (
            <p className="mt-2 text-xs leading-relaxed text-ink-3">
              مدة التسليم المتوقعة بالطاقة الحالية: نحو <strong className="text-ink-2">{fmtWeeks(result.deliveryWeeks)}</strong>
              {workload.committedHours > 0 ? " (بعد المشاريع الجارية)" : ""}.
            </p>
          )}
          {result.capacitySharePct != null && (
            <p className="mt-2 text-xs leading-relaxed text-ink-3">
              تستهلك <strong className="text-ink-2">{pct(result.capacitySharePct)}</strong> من الطاقة الشهرية القابلة للفوترة.
            </p>
          )}
        </div>

        {message && (
          <p role={message.ok ? "status" : "alert"} className={cx("rounded-lg border px-3 py-2 text-sm", message.ok ? "border-success/25 bg-success-soft text-success" : "border-danger/30 bg-danger-soft text-danger")}>
            {message.text}
          </p>
        )}

        {locked ? (
          <Alert level="success" title="عرض مقبول">
            حُوِّل إلى مشروع ولا يُعدَّل.{" "}
            {projectId && (
              <Link href={`/projects/${projectId}`} className="font-semibold underline">
                فتح المشروع
              </Link>
            )}
          </Alert>
        ) : (
          <div className="hidden flex-wrap gap-2 lg:flex">
            <button type="button" className="btn btn-primary flex-1" disabled={!canSave || pending || (!dirty && !!quoteId)} onClick={() => save()}>
              {pending ? <LoaderCircle size={16} className="animate-spin" /> : <Check size={16} />}
              {quoteId ? (dirty ? "حفظ التعديلات" : "محفوظ") : "حفظ العرض"}
            </button>
          </div>
        )}

        {quoteId && (
          <div className="card space-y-2 p-4">
            <Link href={`/quote/${quoteId}`} target="_blank" className={cx("btn btn-secondary w-full", dirty && "pointer-events-none opacity-50")}>
              <Printer size={16} /> نسخة العميل (طباعة / PDF) <ExternalLink size={13} className="text-ink-3" />
            </Link>
            {!locked && (
              <>
                {status === "draft" && (
                  <button type="button" className="btn btn-secondary w-full" disabled={pending || dirty} onClick={() => changeStatus("sent")}>
                    <Send size={15} className="-scale-x-100" /> تعليم كمُرسل للعميل
                  </button>
                )}
                <button type="button" className="btn btn-primary w-full" disabled={pending || dirty} onClick={accept}>
                  <Check size={16} /> قبِل العميل: حوّله إلى مشروع
                </button>
                <div className="flex gap-2">
                  {status !== "rejected" ? (
                    <button type="button" className="btn btn-ghost btn-sm flex-1" disabled={pending || dirty} onClick={() => changeStatus("rejected")}>
                      رفضه العميل
                    </button>
                  ) : (
                    <button type="button" className="btn btn-ghost btn-sm flex-1" disabled={pending || dirty} onClick={() => changeStatus("draft")}>
                      إعادة إلى مسودة
                    </button>
                  )}
                </div>
                {dirty && <p className="text-center text-xs text-ink-3">احفظ التعديلات أولاً لتفعيل هذه الأزرار.</p>}
              </>
            )}
          </div>
        )}
      </aside>

      {/* شريط الحفظ على الجوال */}
      {!locked && (
        <div className="no-print fixed inset-x-0 bottom-0 z-20 flex items-center gap-3 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur lg:hidden">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-ink-3">السعر النهائي{per}</p>
            <p className="truncate text-lg leading-tight font-bold">{money(result.finalPrice, { digits: 0 })}</p>
          </div>
          <button type="button" className="btn btn-primary" disabled={!canSave || pending || (!dirty && !!quoteId)} onClick={() => save()}>
            {pending && <LoaderCircle size={16} className="animate-spin" />}
            {quoteId ? (dirty ? "حفظ" : "محفوظ") : "حفظ العرض"}
          </button>
        </div>
      )}
    </div>
  );
}
