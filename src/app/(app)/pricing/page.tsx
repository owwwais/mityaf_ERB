import type { Metadata } from "next";
import Link from "next/link";
import { Calculator, Plus } from "lucide-react";
import { DeleteButton } from "@/components/form";
import { Alert, Badge, Card, EmptyState, PageHeader, Stat } from "@/components/ui";
import { date, hours, money, num, pct } from "@/lib/format";
import { deleteQuote } from "@/modules/pricing/actions";
import { rateForMargin } from "@/modules/pricing/engine";
import { QUOTE_STATUSES } from "@/modules/pricing/model";
import { getPricingContext, listQuotes } from "@/modules/pricing/queries";

export const metadata: Metadata = { title: "التسعير" };

function Term({ label, value, tone }: { label: string; value: string; tone?: "result" }) {
  return (
    <div className={tone === "result" ? "rounded-lg bg-primary-soft px-3.5 py-2.5" : "rounded-lg bg-surface-2 px-3.5 py-2.5"}>
      <p className="text-[11.5px] text-ink-3">{label}</p>
      <p className={tone === "result" ? "text-base font-bold text-primary-ink" : "text-base font-semibold"}>{value}</p>
    </div>
  );
}

const Op = ({ children }: { children: string }) => <span className="px-0.5 text-lg font-light text-ink-3" aria-hidden>{children}</span>;

export default async function PricingPage() {
  const [{ settings, model, workload }, quotes] = await Promise.all([getPricingContext(), listQuotes()]);
  const margin = settings.targetMarginPct;
  const targetRate = rateForMargin(model, margin);
  const requiredMonthly = model.annualTotalCost / (1 - margin / 100) / 12;
  // عائد الساعة الفعلي لو تحقق الهدف الشهري بالضبط: اختبار «وظيفة ثانية؟»
  const takeHomeAtTarget = model.annualHours > 0 ? (settings.monthlyRevenueTarget * 12 - model.annualOperatingCost) / model.annualHours : 0;
  const meterGap = model.breakEvenRate - settings.meterHourlyRate;

  const decided = quotes.filter((q) => q.status === "accepted" || q.status === "rejected");
  const sentOrDecided = quotes.filter((q) => q.status !== "draft");
  const conversion = sentOrDecided.length ? (quotes.filter((q) => q.status === "accepted").length / sentOrDecided.length) * 100 : null;

  const workloadLabel = { free: "جدول فارغ", normal: "انشغال معتدل", busy: "جدول مزدحم", full: "جدول ممتلئ" }[workload.level];

  return (
    <>
      <PageHeader
        title="التسعير"
        description="السعر يُبنى على رقم لا على حدس: تكاليف الشركة السنوية، وقتكما بسعره الحقيقي، وهامش ربح معلن."
        actions={
          <Link href="/pricing/new" className="btn btn-primary">
            <Plus size={17} /> عرض سعر جديد
          </Link>
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="سعر التعادل للساعة" value={money(model.breakEvenRate, { digits: 0 })} hint="تحته كل ساعة مبيعة خسارة" />
        <Stat label={`السعر المطلوب (هامش ${pct(margin)})`} value={money(targetRate, { digits: 0 })} hint={`قاعدة العداد الحالية ${money(settings.meterHourlyRate, { digits: 0 })}`} />
        <Stat label="الإيراد الشهري المطلوب" value={money(requiredMonthly, { digits: 0 })} hint={`الهدف الحالي ${money(settings.monthlyRevenueTarget, { digits: 0 })}`} />
        <Stat
          label="ضغط العمل"
          value={workloadLabel}
          hint={
            workload.committedHours > 0
              ? `${hours(workload.committedHours)} ملتزم بها ≈ ${num(workload.backlogWeeks, 1)} أسبوع · علاوة مقترحة ${pct(workload.suggestedLoadPct)}`
              : "لا ساعات ملتزم بها في المشاريع الجارية"
          }
        />
      </div>

      <Card className="mb-5" title="كيف تُحسب تكلفة ساعتنا؟" description="كل رقم هنا يأتي من الإعدادات والتكاليف المتكررة، ويتحدّث معها">
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-[13px] font-semibold text-ink-2">١. الساعات التي يمكن بيعها في السنة</p>
            <div className="flex flex-wrap items-center gap-2">
              <Term label="ساعات الشركاء أسبوعياً" value={hours(model.partners.reduce((s, p) => s + p.weeklyHours, 0))} />
              <Op>×</Op>
              <Term label="أسابيع العمل" value={num(model.workingWeeks, 0)} />
              <Op>×</Op>
              <Term label="نسبة القابل للفوترة" value={pct(model.utilizationPct)} />
              <Op>=</Op>
              <Term label="ساعة قابلة للفوترة سنوياً" value={num(model.billableHours, 0)} tone="result" />
            </div>
            <p className="mt-1.5 text-xs text-ink-3">الباقي يذهب للبيع والمقابلات والإدارة وتطوير المنتجات، ويجب أن تحمله الساعات المبيعة.</p>
          </div>
          <div>
            <p className="mb-2 text-[13px] font-semibold text-ink-2">٢. تكلفة الساعة المبيعة</p>
            <div className="flex flex-wrap items-center gap-2">
              <Term label="وقت الشريك محمّلاً" value={money(model.blendedLaborPerHour, { digits: 0 })} />
              <Op>+</Op>
              <Term label={`نصيبها من ${money(model.annualOperatingCost, { digits: 0 })} تكاليف سنوية`} value={money(model.overheadPerHour)} />
              <Op>=</Op>
              <Term label="سعر التعادل" value={money(model.breakEvenRate, { digits: 0 })} tone="result" />
            </div>
          </div>
          <div>
            <p className="mb-2 text-[13px] font-semibold text-ink-2">٣. سعر البيع</p>
            <div className="flex flex-wrap items-center gap-2">
              <Term label="سعر التعادل" value={money(model.breakEvenRate, { digits: 0 })} />
              <Op>÷</Op>
              <Term label={`(1 − هامش ${pct(margin)})`} value={num(1 - margin / 100, 2)} />
              <Op>=</Op>
              <Term label="السعر المطلوب للساعة" value={money(targetRate, { digits: 0 })} tone="result" />
            </div>
          </div>
        </div>

        <div className="mt-5 space-y-2.5">
          {model.annualOperatingCost === 0 && (
            <Alert level="warning" title="لم تُدخل تكاليف تشغيلية بعد">
              التسعير الآن يفترض أن تشغيل الشركة مجاني.{" "}
              <Link href="/expenses/recurring" className="font-semibold underline">
                أضف التكاليف المتكررة
              </Link>
            </Alert>
          )}
          {meterGap > 0 && (
            <Alert level="warning" title={`قاعدة العداد (${money(settings.meterHourlyRate, { digits: 0 })} للساعة) أقل من سعر التعادل بـ ${money(meterGap, { digits: 0 })}`}>
              البيع بها يعني أن وقتكما يُحتسب بأقل من {money(model.partners[0]?.hourlyCost ?? 0, { digits: 0 })} للساعة. إما أن ترفعوا سعر الساعة أو تعتمدوا على «قيمة المنتج الجاهز» لتعويض الفرق.
            </Alert>
          )}
          {model.annualHours > 0 && (
            <Alert level="info" title={`لو تحقق هدف ${money(settings.monthlyRevenueTarget, { digits: 0 })} شهرياً بالضبط`}>
              يكون عائد ساعة عملكما الفعلي نحو <strong>{money(Math.max(takeHomeAtTarget, 0), { digits: 0 })}</strong> بعد التكاليف التشغيلية، مقابل{" "}
              {money(model.partners[0]?.hourlyCost ?? 0, { digits: 0 })} هي قيمة ساعتكما المعلنة في الإعدادات.
            </Alert>
          )}
        </div>

        <div className="table-wrap mt-5 rounded-lg border border-line">
          <table className="table">
            <thead>
              <tr>
                <th>الشريك</th>
                <th className="cell-num">ساعات/أسبوع</th>
                <th className="cell-num">قابلة للفوترة/سنة</th>
                <th className="cell-num">سعر ساعته الحقيقي</th>
                <th className="cell-num">تكلفة ساعته المبيعة</th>
              </tr>
            </thead>
            <tbody>
              {model.partners.map((p) => (
                <tr key={p.id}>
                  <td className="font-medium">{p.name}</td>
                  <td className="cell-num">{num(p.weeklyHours, 1)}</td>
                  <td className="cell-num">{num(p.billableHours, 0)}</td>
                  <td className="cell-num">{money(p.hourlyCost, { digits: 0 })}</td>
                  <td className="cell-num font-semibold">{money(p.loadedPerHour, { digits: 0 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-ink-3">
          تُعدَّل هذه الأرقام من{" "}
          <Link href="/settings" className="font-semibold text-primary-ink hover:underline">
            الإعدادات
          </Link>{" "}
          و
          <Link href="/expenses/recurring" className="font-semibold text-primary-ink hover:underline">
            التكاليف المتكررة
          </Link>
          .
        </p>
      </Card>

      <Card
        flush
        title="عروض الأسعار"
        description={
          conversion == null
            ? "لم يُرسل أي عرض بعد"
            : `معدل التحويل ${pct(conversion)} من ${sentOrDecided.length} عرض مُرسل (${decided.length} محسوم) · الهدف 30٪`
        }
      >
        {conversion != null && conversion > 60 && sentOrDecided.length >= 3 && (
          <div className="border-b border-line p-4">
            <Alert level="info">معدل تحويل فوق 60٪ يعني غالباً أنكم تبيعون بأرخص مما تستحقون. جرّبوا رفع السعر في العرض القادم.</Alert>
          </div>
        )}
        {quotes.length === 0 ? (
          <EmptyState
            icon={<Calculator size={20} />}
            title="لا عروض أسعار بعد"
            description="ابدأ بعرض جديد: أدخل بنود العمل وساعاتها، والنظام يقترح السعر ويريك هامشه وتوزيعه."
            action={
              <Link href="/pricing/new" className="btn btn-primary">
                <Plus size={17} /> عرض سعر جديد
              </Link>
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>الرقم</th>
                  <th>العرض</th>
                  <th>الحالة</th>
                  <th className="cell-num">الساعات</th>
                  <th className="cell-num">الهامش</th>
                  <th className="cell-num">السعر</th>
                  <th>التاريخ</th>
                  <th className="cell-actions" />
                </tr>
              </thead>
              <tbody>
                {quotes.map((q) => (
                  <tr key={q.id}>
                    <td className="whitespace-nowrap text-ink-3" dir="ltr">{q.number}</td>
                    <td className="min-w-52">
                      <Link href={`/pricing/${q.id}`} className="font-medium hover:underline">
                        {q.title}
                      </Link>
                      {q.clientName && <span className="block text-xs text-ink-3">{q.clientName}</span>}
                    </td>
                    <td><Badge tone={QUOTE_STATUSES[q.status].tone}>{QUOTE_STATUSES[q.status].label}</Badge></td>
                    <td className="cell-num text-ink-2">{num(q.totalHours, 1)}</td>
                    <td className="cell-num">
                      <span className={q.marginPct < settings.minMarginPct ? "font-semibold text-warning" : ""}>{pct(q.marginPct)}</span>
                    </td>
                    <td className="cell-num font-semibold">{money(q.price, { digits: 0 })}</td>
                    <td className="whitespace-nowrap text-ink-2">{date(q.createdAt.toISOString())}</td>
                    <td className="cell-actions">
                      {q.status !== "accepted" && <DeleteButton action={deleteQuote.bind(null, q.id)} confirm={`حذف العرض ${q.number}؟`} />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
