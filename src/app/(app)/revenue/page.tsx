import type { Metadata } from "next";
import Link from "next/link";
import { HandCoins, Pencil, Plus } from "lucide-react";
import { Meter, type MeterStatus } from "@/components/charts";
import { MonthNav } from "@/components/filters";
import { DeleteButton } from "@/components/form";
import { Modal } from "@/components/modal";
import { Badge, Card, EmptyState, PageHeader, Stat } from "@/components/ui";
import { currentMonth, dateShort, isMonth, money, monthLabel, pct } from "@/lib/format";
import { getSettings } from "@/modules/core/queries";
import { deletePayment } from "@/modules/finance/actions";
import { PaymentForm } from "@/modules/finance/components/forms";
import { PAYMENT_KINDS, TREASURY_LABEL, type PaymentKind } from "@/modules/finance/constants";
import { getFormLookups } from "@/modules/finance/lookups";
import { listPayments, monthTotals } from "@/modules/finance/queries";
import { listProjects } from "@/modules/projects/queries";

export const metadata: Metadata = { title: "الإيرادات" };

export default async function RevenuePage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const sp = await searchParams;
  const now = currentMonth();
  const month = isMonth(sp.month) && sp.month <= now ? sp.month : now;

  const [settings, lookups, rows, totals, projects] = await Promise.all([
    getSettings(),
    getFormLookups({ withClients: true }),
    listPayments({ month }),
    monthTotals(month),
    listProjects(),
  ]);

  const target = settings.monthlyRevenueTarget;
  const reached = target > 0 ? (totals.revenue / target) * 100 : 0;
  const status: MeterStatus = reached >= 100 ? "good" : reached >= 50 ? "warning" : "critical";
  const receivables = projects.filter((p) => p.outstanding > 0).sort((a, b) => b.outstanding - a.outstanding);
  const outstanding = receivables.reduce((s, p) => s + p.outstanding, 0);

  return (
    <>
      <PageHeader
        title="الإيرادات"
        description="ما دخل فعلاً (أساس نقدي): كل دفعة، من أي مشروع، ومن استلمها."
        actions={
          <Modal trigger={<><Plus size={17} /> دفعة مستلمة</>} title="تسجيل دفعة مستلمة">
            <PaymentForm lookups={lookups} />
          </Modal>
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Stat label={`إيراد ${monthLabel(month)}`} value={money(totals.revenue, { digits: 0 })}>
          <Meter
            value={totals.revenue}
            max={target}
            status={status}
            caption={target > 0 ? `${pct(reached)} من هدف ${money(target, { digits: 0 })}` : "لم يُحدَّد هدف شهري"}
          />
        </Stat>
        <Stat
          label="صافي الشهر"
          value={money(totals.net, { digits: 0 })}
          tone={totals.net < 0 ? "danger" : undefined}
          hint={`بعد مصروفات ${money(totals.expenses, { digits: 0 })}`}
        />
        <Stat label="مستحقات لم تُحصَّل" value={money(outstanding, { digits: 0 })} hint={`${receivables.length} مشروع بمبالغ متبقية`} />
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-3">
        <Card flush className="lg:col-span-2" title={<MonthNav month={month} current={now} />}>
          {rows.length === 0 ? (
            <EmptyState icon={<HandCoins size={20} />} title={`لا دفعات في ${monthLabel(month)}`} description="سجّل الدفعة فور وصولها حتى تبقى التسوية بين الشركاء دقيقة." />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th className="max-md:hidden">التاريخ</th>
                    <th>المشروع / العميل</th>
                    <th className="max-md:hidden">النوع</th>
                    <th className="max-md:hidden">استلمها</th>
                    <th className="cell-num">المبلغ</th>
                    <th className="cell-actions" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => (
                    <tr key={p.id}>
                      <td className="whitespace-nowrap text-ink-2 max-md:hidden">{dateShort(p.date)}</td>
                      <td className="md:min-w-44">
                        {p.projectId ? (
                          <Link href={`/projects/${p.projectId}`} className="font-medium hover:underline">
                            {p.projectName}
                          </Link>
                        ) : (
                          <span className="font-medium">إيراد عام</span>
                        )}
                        {p.clientName && <span className="block text-xs text-ink-3">{p.clientName}</span>}
                        <span className="mt-0.5 block text-xs leading-relaxed text-ink-3 md:hidden">
                          {[dateShort(p.date), PAYMENT_KINDS[p.kind as PaymentKind] ?? p.kind, `استلمها ${p.receivedByName ?? TREASURY_LABEL}`].join(" · ")}
                        </span>
                      </td>
                      <td className="max-md:hidden"><Badge>{PAYMENT_KINDS[p.kind as PaymentKind] ?? p.kind}</Badge></td>
                      <td className="whitespace-nowrap text-ink-2 max-md:hidden">{p.receivedByName ?? TREASURY_LABEL}</td>
                      <td className="cell-num font-semibold text-success">{money(p.amount)}</td>
                      <td className="cell-actions">
                        <div className="flex items-center">
                          <Modal trigger={<Pencil size={15} />} triggerClassName="btn btn-ghost btn-icon text-ink-3" triggerLabel="تعديل" title="تعديل دفعة">
                            <PaymentForm payment={p} lookups={lookups} />
                          </Modal>
                          <DeleteButton action={deletePayment.bind(null, p.id)} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="مستحقات على العملاء" description="سعر المشروع ناقص ما حُصّل منه">
          {receivables.length === 0 ? (
            <p className="text-sm text-ink-3">لا مبالغ متبقية على المشاريع.</p>
          ) : (
            <ul className="divide-y divide-line">
              {receivables.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <Link href={`/projects/${p.id}`} className="block truncate text-sm font-medium hover:underline">
                      {p.name}
                    </Link>
                    <p className="text-xs text-ink-3">
                      حُصّل {money(p.collected, { digits: 0 })} من {money(p.price, { digits: 0 })}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-bold">{money(p.outstanding, { digits: 0 })}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
