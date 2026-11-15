import type { Metadata } from "next";
import { Pencil, Plus, Receipt, Repeat } from "lucide-react";
import { Meter, type MeterStatus } from "@/components/charts";
import { MonthNav, SearchFilter, SelectFilter } from "@/components/filters";
import { ActionButton, DeleteButton } from "@/components/form";
import { Modal } from "@/components/modal";
import { Badge, Card, EmptyState, PageHeader, Stat, Tabs } from "@/components/ui";
import { currentMonth, dateShort, isMonth, money, monthLabel, pct } from "@/lib/format";
import { getSettings } from "@/modules/core/queries";
import { deleteExpense, recordOperatingCost } from "@/modules/finance/actions";
import { ExpenseForm } from "@/modules/finance/components/forms";
import { CYCLES, EXPENSE_TABS, TREASURY_LABEL } from "@/modules/finance/constants";
import { getFormLookups } from "@/modules/finance/lookups";
import { listExpenses, listOperatingCosts, monthTotals, recordedOperatingCostIds } from "@/modules/finance/queries";

export const metadata: Metadata = { title: "المصروفات" };

type Search = { month?: string; category?: string; paidBy?: string; scope?: string; q?: string };

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const now = currentMonth();
  const month = isMonth(sp.month) && sp.month <= now ? sp.month : now;

  const [settings, lookups, rows, totals, costs, recorded] = await Promise.all([
    getSettings(),
    getFormLookups(),
    listExpenses({ month, categoryId: sp.category, paidBy: sp.paidBy, scope: sp.scope, q: sp.q }),
    monthTotals(month),
    listOperatingCosts(),
    recordedOperatingCostIds(month),
  ]);

  const cap = settings.monthlyExpenseCap;
  // السقف يخص المصروف التشغيلي العام؛ تكاليف المشاريع المباشرة يغطيها سعر المشروع.
  const used = cap > 0 ? (totals.overhead / cap) * 100 : 0;
  const status: MeterStatus = used >= 100 ? "critical" : used >= 80 ? "warning" : "good";
  const capCaption =
    cap <= 0
      ? "لم يُحدَّد سقف شهري"
      : used >= 100
        ? `تجاوز السقف بـ ${money(totals.overhead - cap, { digits: 0 })}`
        : used >= 80
          ? `اقتراب من السقف: ${pct(used)} من ${money(cap, { digits: 0 })}`
          : `${pct(used)} من سقف ${money(cap, { digits: 0 })}`;

  // بنود شهرية لم تُسجَّل بعد في الشهر الحالي
  const pending = month === now ? costs.filter((c) => c.active && c.cycle === "monthly" && !recorded.has(c.id)) : [];
  const filtered = !!(sp.category || sp.paidBy || sp.scope || sp.q);
  const shownTotal = rows.reduce((s, r) => s + r.amount, 0);

  return (
    <>
      <PageHeader
        title="المصروفات"
        description="كل ريال يخرج يُسجَّل هنا: من دفعه، وعلى أي مشروع، ومن أي فئة."
        actions={
          <Modal trigger={<><Plus size={17} /> مصروف جديد</>} title="تسجيل مصروف">
            <ExpenseForm lookups={lookups} />
          </Modal>
        }
      />
      <Tabs items={EXPENSE_TABS} current="/expenses" />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Stat label={`المصروف التشغيلي — ${monthLabel(month)}`} value={money(totals.overhead, { digits: 0 })}>
          <Meter value={totals.overhead} max={cap} status={status} caption={capCaption} />
        </Stat>
        <Stat label="تكاليف مباشرة على المشاريع" value={money(totals.direct, { digits: 0 })} hint="تُخصم من صافي مشاريعها قبل التوزيع" />
        <Stat label="إجمالي ما خرج هذا الشهر" value={money(totals.expenses, { digits: 0 })} hint={`مقابل إيراد ${money(totals.revenue, { digits: 0 })}`} />
      </div>

      {pending.length > 0 && (
        <Card
          className="mb-5"
          title={<span className="flex items-center gap-2"><Repeat size={16} className="text-ink-3" /> بنود متكررة لم تُسجَّل هذا الشهر</span>}
          description="سجّلها بضغطة عند دفعها فعلاً، بتاريخ اليوم ومن حسابك."
        >
          <ul className="flex flex-wrap gap-2">
            {pending.map((c) => (
              <li key={c.id} className="flex items-center gap-3 rounded-lg border border-line py-1.5 ps-3 pe-1.5">
                <span className="text-sm">
                  {c.name} <span className="font-semibold">{money(c.amount, { digits: 0 })}</span>
                  <span className="text-ink-3"> · {CYCLES[c.cycle].label}</span>
                </span>
                <ActionButton action={recordOperatingCost.bind(null, c.id)} className="btn btn-secondary btn-sm">
                  تسجيل
                </ActionButton>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card
        flush
        title={
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <MonthNav month={month} current={now} />
          </div>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <SearchFilter placeholder="بحث في الوصف" />
            <SelectFilter name="category" label="الفئة" allLabel="كل الفئات" options={lookups.categories} />
            <SelectFilter name="paidBy" label="دُفع من" allLabel="كل الدافعين" options={[{ value: "treasury", label: TREASURY_LABEL }, ...lookups.partners]} />
            <SelectFilter
              name="scope"
              label="النوع"
              allLabel="عام ومباشر"
              options={[
                { value: "overhead", label: "تشغيلي عام" },
                { value: "direct", label: "مباشر على مشروع" },
              ]}
            />
          </div>
        }
      >
        {rows.length === 0 ? (
          <EmptyState
            icon={<Receipt size={20} />}
            title={filtered ? "لا مصروفات تطابق التصفية" : `لا مصروفات في ${monthLabel(month)}`}
            description={filtered ? "غيّر التصفية أو امسحها." : "سجّل أول مصروف من الزر أعلى الصفحة."}
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>التاريخ</th>
                  <th>الوصف</th>
                  <th>الفئة</th>
                  <th>المشروع</th>
                  <th>دُفع من</th>
                  <th className="cell-num">المبلغ</th>
                  <th className="cell-actions" />
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.id}>
                    <td className="whitespace-nowrap text-ink-2">{dateShort(e.date)}</td>
                    <td className="min-w-44">
                      <span className="font-medium">{e.description}</span>
                      {e.operatingCostId && <Repeat size={13} className="ms-1.5 inline text-ink-3" aria-label="بند متكرر" />}
                      {e.vendor && <span className="block text-xs text-ink-3">{e.vendor}</span>}
                    </td>
                    <td>{e.categoryName ? <Badge>{e.categoryName}</Badge> : <span className="text-ink-3">—</span>}</td>
                    <td className="text-ink-2">{e.projectName ?? <span className="text-ink-3">عام</span>}</td>
                    <td className="whitespace-nowrap text-ink-2">{e.paidByName ?? TREASURY_LABEL}</td>
                    <td className="cell-num font-semibold">{money(e.amount)}</td>
                    <td className="cell-actions">
                      <div className="flex items-center">
                        <Modal trigger={<Pencil size={15} />} triggerClassName="btn btn-ghost btn-icon text-ink-3" triggerLabel="تعديل" title="تعديل مصروف">
                          <ExpenseForm expense={e} lookups={lookups} />
                        </Modal>
                        <DeleteButton action={deleteExpense.bind(null, e.id)} confirm={`حذف «${e.description}»؟`} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={5} className="border-t border-line px-4 py-3 text-sm text-ink-3">
                    {rows.length} حركة{filtered ? " (بعد التصفية)" : ""}
                  </td>
                  <td className="cell-num border-t border-line px-4 py-3 font-bold">{money(shownTotal)}</td>
                  <td className="border-t border-line" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
