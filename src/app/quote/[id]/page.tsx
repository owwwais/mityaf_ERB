import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/print-button";
import { Logo } from "@/components/ui";
import { date, money, pct, weeks } from "@/lib/format";
import { getSettings } from "@/modules/core/queries";
import { getQuote } from "@/modules/pricing/queries";

export const metadata: Metadata = { title: "عرض سعر" };

const lines = (text: string) =>
  text
    .split(/\n+/)
    .map((l) => l.replace(/^[-•*\s]+/, "").trim())
    .filter(Boolean);

/** نسخة العميل: نطاق وسعر وشروط فقط — بلا تكاليف داخلية ولا هوامش. */
export default async function QuotePrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [row, settings] = await Promise.all([getQuote(id), getSettings()]);
  if (!row) notFound();
  const { quote } = row;
  const { inputs, result } = quote;
  const monthly = inputs.billing === "monthly";
  const items = inputs.items.filter((i) => i.title);
  const included = lines(quote.scopeIncluded);
  const excluded = lines(quote.scopeExcluded);
  const vat = settings.vatEnabled ? (quote.price * settings.vatPct) / 100 : 0;
  const downPayment = ((quote.price + vat) * inputs.downPaymentPct) / 100;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-10 print:max-w-none print:p-0">
      <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link href={`/pricing/${quote.id}`} className="btn btn-secondary">
          العودة للحاسبة
        </Link>
        <PrintButton />
      </div>

      <article className="card overflow-hidden print:rounded-none print:border-0 print:shadow-none">
        <div className="h-1.5" style={{ background: "var(--spectrum)" }} aria-hidden />
        <div className="p-7 sm:p-10 print:p-0 print:pt-4">
          <header className="flex flex-wrap items-start justify-between gap-6 border-b border-line pb-6">
            <div className="flex items-center gap-3">
              <Logo size={44} />
              <div>
                <p className="text-2xl leading-tight font-bold">{settings.companyName}</p>
                <p className="text-[13px] text-ink-3">حلول أعمال وتقنية على مقاس احتياجك</p>
              </div>
            </div>
            <div className="text-sm leading-relaxed">
              <p className="text-lg font-bold">عرض سعر</p>
              <p className="text-ink-2">
                رقم العرض: <span dir="ltr">{quote.number}</span>
              </p>
              <p className="text-ink-2">التاريخ: {date(quote.updatedAt.toISOString())}</p>
              {quote.validUntil && <p className="text-ink-2">صالح حتى: {date(quote.validUntil)}</p>}
            </div>
          </header>

          <section className="mt-6">
            {row.clientName && (
              <p className="text-sm text-ink-2">
                مقدَّم إلى: <strong className="text-ink">{row.clientName}</strong>
                {row.clientContact && <span> — عناية {row.clientContact}</span>}
              </p>
            )}
            <h1 className="mt-2 text-2xl font-bold">{quote.title}</h1>
          </section>

          {items.length > 0 && (
            <section className="mt-7">
              <h2 className="mb-2 text-[15px] font-bold">مراحل العمل</h2>
              <ol className="divide-y divide-line rounded-lg border border-line">
                {items.map((item, i) => (
                  <li key={i} className="flex gap-3 px-4 py-2.5 text-sm">
                    <span className="num w-5 shrink-0 font-semibold text-ink-3">{i + 1}</span>
                    <span>{item.title}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {(included.length > 0 || excluded.length > 0) && (
            <section className="mt-7 grid gap-6 sm:grid-cols-2 print:grid-cols-2">
              {included.length > 0 && (
                <div>
                  <h2 className="mb-2 text-[15px] font-bold">يشمل العرض</h2>
                  <ul className="list-disc space-y-1 ps-5 text-sm leading-relaxed text-ink-2">
                    {included.map((l, i) => (
                      <li key={i}>{l}</li>
                    ))}
                  </ul>
                </div>
              )}
              {excluded.length > 0 && (
                <div>
                  <h2 className="mb-2 text-[15px] font-bold">لا يشمل العرض</h2>
                  <ul className="list-disc space-y-1 ps-5 text-sm leading-relaxed text-ink-2">
                    {excluded.map((l, i) => (
                      <li key={i}>{l}</li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          <section className="mt-7 break-inside-avoid rounded-xl bg-surface-2 p-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-sm text-ink-2">{monthly ? "قيمة الباقة الشهرية" : "قيمة العرض"}</p>
                <p className="text-3xl font-bold">
                  {money(quote.price, { digits: 0 })}
                  {monthly && <span className="text-base font-medium text-ink-2"> / شهرياً</span>}
                </p>
              </div>
              <dl className="space-y-1 text-sm">
                {settings.vatEnabled && (
                  <>
                    <div className="flex justify-between gap-8">
                      <dt className="text-ink-2">ضريبة القيمة المضافة {pct(settings.vatPct)}</dt>
                      <dd>{money(vat)}</dd>
                    </div>
                    <div className="flex justify-between gap-8 font-bold">
                      <dt>الإجمالي شامل الضريبة</dt>
                      <dd>{money(quote.price + vat)}</dd>
                    </div>
                  </>
                )}
                {inputs.downPaymentPct > 0 && inputs.downPaymentPct < 100 && (
                  <div className="flex justify-between gap-8">
                    <dt className="text-ink-2">دفعة مقدمة عند التعاقد ({pct(inputs.downPaymentPct)})</dt>
                    <dd className="font-semibold">{money(downPayment)}</dd>
                  </div>
                )}
                {!monthly && result.deliveryWeeks != null && (
                  <div className="flex justify-between gap-8">
                    <dt className="text-ink-2">مدة التنفيذ التقديرية</dt>
                    <dd className="font-semibold">نحو {weeks(result.deliveryWeeks)}</dd>
                  </div>
                )}
              </dl>
            </div>
          </section>

          {settings.quoteTerms && (
            <section className="mt-7 break-inside-avoid">
              <h2 className="mb-2 text-[15px] font-bold">الشروط</h2>
              <p className="text-sm leading-relaxed whitespace-pre-line text-ink-2">{settings.quoteTerms}</p>
            </section>
          )}

          <footer className="mt-10 grid grid-cols-2 gap-8 border-t border-line pt-6 text-sm break-inside-avoid">
            <div>
              <p className="text-ink-3">عن {settings.companyName}</p>
              <p className="mt-8 border-t border-line-strong pt-1.5 text-ink-3">الاسم والتوقيع</p>
            </div>
            <div>
              <p className="text-ink-3">موافقة العميل</p>
              <p className="mt-8 border-t border-line-strong pt-1.5 text-ink-3">الاسم والتوقيع والتاريخ</p>
            </div>
          </footer>
        </div>
      </article>
    </div>
  );
}
