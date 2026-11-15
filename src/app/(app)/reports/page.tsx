import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { BarList, PairedBars } from "@/components/charts";
import { Alert, Card, EmptyState, PageHeader, Stat, cx } from "@/components/ui";
import { currentMonth, money, monthLabel, monthShort, pct } from "@/lib/format";
import { getSettings } from "@/modules/core/queries";
import { expensesByCategory, monthlySeries, revenueByClient } from "@/modules/finance/queries";

export const metadata: Metadata = { title: "التقارير" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const sp = await searchParams;
  const now = currentMonth();
  const thisYear = Number(now.slice(0, 4));
  const year = /^\d{4}$/.test(sp.year ?? "") ? Math.min(Math.max(Number(sp.year), 2020), thisYear) : thisYear;
  const lastMonth = year === thisYear ? Number(now.slice(5)) : 12;
  const months = Array.from({ length: lastMonth }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
  const from = `${year}-01-01`;
  const to = `${year + 1}-01-01`;

  const [settings, series, categories, clients] = await Promise.all([
    getSettings(),
    monthlySeries(months),
    expensesByCategory(from, to),
    revenueByClient(from, to),
  ]);

  const total = series.reduce(
    (t, m) => ({ revenue: t.revenue + m.revenue, direct: t.direct + m.direct, overhead: t.overhead + m.overhead, expenses: t.expenses + m.expenses, net: t.net + m.net }),
    { revenue: 0, direct: 0, overhead: 0, expenses: 0, net: 0 },
  );
  const netMargin = total.revenue > 0 ? (total.net / total.revenue) * 100 : 0;
  const avgRevenue = months.length ? total.revenue / months.length : 0;
  const topClient = clients.find((c) => c.key !== "none");
  const topShare = topClient && total.revenue > 0 ? (topClient.value / total.revenue) * 100 : 0;
  const hasData = total.revenue > 0 || total.expenses > 0;

  return (
    <>
      <PageHeader
        title="التقارير"
        description="قائمة الدخل على أساس نقدي: ما دخل وما خرج فعلاً، شهراً بشهر."
        actions={
          <>
            <div className="flex items-center gap-1">
              <Link href={`/reports?year=${year - 1}`} className="btn btn-secondary btn-icon" aria-label="السنة السابقة">
                <ChevronRight size={17} />
              </Link>
              <span className="num min-w-14 text-center text-sm font-semibold">{year}</span>
              <Link
                href={`/reports?year=${year + 1}`}
                className={cx("btn btn-secondary btn-icon", year >= thisYear && "pointer-events-none opacity-40")}
                aria-label="السنة التالية"
                aria-disabled={year >= thisYear}
              >
                <ChevronLeft size={17} />
              </Link>
            </div>
            <a href={`/reports/export?type=expenses&year=${year}`} className="btn btn-secondary" download>
              <Download size={16} /> المصروفات CSV
            </a>
            <a href={`/reports/export?type=payments&year=${year}`} className="btn btn-secondary" download>
              <Download size={16} /> الإيرادات CSV
            </a>
          </>
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={`إيراد ${year}`} value={money(total.revenue, { digits: 0 })} hint={`متوسط ${money(avgRevenue, { digits: 0 })} شهرياً · الهدف ${money(settings.monthlyRevenueTarget, { digits: 0 })}`} />
        <Stat label="إجمالي المصروفات" value={money(total.expenses, { digits: 0 })} hint={`تشغيلي ${money(total.overhead, { digits: 0 })} · مباشر ${money(total.direct, { digits: 0 })}`} />
        <Stat label="الصافي النقدي" value={money(total.net, { digits: 0 })} tone={total.net < 0 ? "danger" : total.net > 0 ? "success" : undefined} hint={`${pct(netMargin)} من الإيراد، قبل احتساب وقتكما`} />
        <Stat label="أكبر عميل" value={topClient ? pct(topShare) : "—"} tone={topShare > settings.clientConcentrationAlertPct ? "warning" : undefined} hint={topClient ? `${topClient.label} من إيراد السنة` : "لا إيراد مسجّل"} />
      </div>

      {!hasData ? (
        <Card>
          <EmptyState title={`لا حركات مالية في ${year}`} description="سجّل المصروفات والدفعات لتظهر هنا." />
        </Card>
      ) : (
        <>
          <Card className="mb-5" title="الإيراد والمصروف شهرياً" description="بالريال">
            <PairedBars
              seriesA="الإيراد"
              seriesB="المصروف"
              data={series.map((m) => ({ key: m.month, label: monthShort(m.month), a: m.revenue, b: m.expenses, detail: `الصافي ${money(m.net, { digits: 0, sign: true })}` }))}
            />
          </Card>

          <Card className="mb-5" flush title="قائمة الدخل الشهرية">
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>الشهر</th>
                    <th className="cell-num">الإيراد</th>
                    <th className="cell-num">تكاليف مباشرة</th>
                    <th className="cell-num">مصروف تشغيلي</th>
                    <th className="cell-num">الصافي</th>
                    <th className="cell-num">من الهدف</th>
                  </tr>
                </thead>
                <tbody>
                  {series.map((m) => (
                    <tr key={m.month}>
                      <td className="whitespace-nowrap font-medium">{monthLabel(m.month)}</td>
                      <td className="cell-num">{money(m.revenue, { digits: 0 })}</td>
                      <td className="cell-num text-ink-2">{money(m.direct, { digits: 0 })}</td>
                      <td className="cell-num text-ink-2">{money(m.overhead, { digits: 0 })}</td>
                      <td className={cx("cell-num font-semibold", m.net < 0 && "text-danger")}>{money(m.net, { digits: 0 })}</td>
                      <td className="cell-num text-ink-2">{settings.monthlyRevenueTarget > 0 ? pct((m.revenue / settings.monthlyRevenueTarget) * 100) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="font-bold">
                    <td className="border-t border-line px-4 py-3">المجموع</td>
                    <td className="cell-num border-t border-line px-4 py-3">{money(total.revenue, { digits: 0 })}</td>
                    <td className="cell-num border-t border-line px-4 py-3">{money(total.direct, { digits: 0 })}</td>
                    <td className="cell-num border-t border-line px-4 py-3">{money(total.overhead, { digits: 0 })}</td>
                    <td className={cx("cell-num border-t border-line px-4 py-3", total.net < 0 && "text-danger")}>{money(total.net, { digits: 0 })}</td>
                    <td className="border-t border-line" />
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>

          <div className="grid items-start gap-5 lg:grid-cols-2">
            <Card title="المصروفات حسب الفئة" description={`سنة ${year}`}>
              {categories.length ? <BarList items={categories} /> : <p className="text-sm text-ink-3">لا مصروفات.</p>}
            </Card>
            <Card title="الإيراد حسب العميل" description="لقياس الاعتماد على عميل واحد">
              {clients.length ? <BarList items={clients} /> : <p className="text-sm text-ink-3">لا إيرادات.</p>}
              {topShare > settings.clientConcentrationAlertPct && (
                <div className="mt-4">
                  <Alert level="warning">
                    عميل واحد يمثّل {pct(topShare)} من الإيراد، فوق الحد المتفق عليه ({pct(settings.clientConcentrationAlertPct)}).
                  </Alert>
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </>
  );
}
