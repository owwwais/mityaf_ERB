import type { Metadata } from "next";
import Link from "next/link";
import { Pencil, Plus, Repeat } from "lucide-react";
import { DeleteButton } from "@/components/form";
import { Modal } from "@/components/modal";
import { Alert, Badge, Card, EmptyState, PageHeader, Stat, Tabs } from "@/components/ui";
import { money } from "@/lib/format";
import { deleteOperatingCost } from "@/modules/finance/actions";
import { OperatingCostForm } from "@/modules/finance/components/forms";
import { CYCLES, EXPENSE_TABS } from "@/modules/finance/constants";
import { listCategories, listOperatingCosts } from "@/modules/finance/queries";
import { getPricingContext } from "@/modules/pricing/queries";

export const metadata: Metadata = { title: "التكاليف المتكررة" };

export default async function RecurringCostsPage() {
  const [costs, categoryRows, { model }] = await Promise.all([listOperatingCosts(), listCategories(), getPricingContext()]);
  const categories = categoryRows.map((c) => ({ value: c.id, label: c.name }));
  const annual = model.annualOperatingCost;

  return (
    <>
      <PageHeader
        title="المصروفات"
        description="التزامات الشركة الثابتة: استضافة، نطاقات، أدوات، اشتراكات. مجموعها السنوي هو ما يحمّله محرك التسعير على كل ساعة تبيعونها."
        actions={
          <Modal trigger={<><Plus size={17} /> بند متكرر</>} title="بند تكلفة متكرر">
            <OperatingCostForm categories={categories} />
          </Modal>
        }
      />
      <Tabs items={EXPENSE_TABS} current="/expenses/recurring" />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Stat label="التكاليف التشغيلية السنوية" value={money(annual, { digits: 0 })} hint={`≈ ${money(annual / 12, { digits: 0 })} شهرياً`} />
        <Stat
          label="نصيب كل ساعة مبيعة"
          value={money(model.overheadPerHour)}
          hint={`موزّعة على ${Math.round(model.billableHours)} ساعة قابلة للفوترة سنوياً`}
        />
        <Stat label="سعر التعادل للساعة" value={money(model.breakEvenRate, { digits: 0 })} hint="وقت الفريق + نصيب التكاليف">
          <Link href="/pricing" className="mt-2 inline-block text-[13px] font-semibold text-primary-ink hover:underline">
            كيف يُحسب السعر؟
          </Link>
        </Stat>
      </div>

      {costs.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Repeat size={20} />}
            title="لا بنود متكررة بعد"
            description="أضف ما تدفعونه دورياً ليدخل في حساب تكلفة الساعة. بلا هذه البنود يفترض التسعير أن تشغيل الشركة مجاني."
          />
        </Card>
      ) : (
        <Card flush>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>البند</th>
                  <th>الفئة</th>
                  <th>الدورة</th>
                  <th className="cell-num">المبلغ</th>
                  <th className="cell-num">سنوياً</th>
                  <th className="cell-actions" />
                </tr>
              </thead>
              <tbody>
                {costs.map((c) => (
                  <tr key={c.id} className={c.active ? "" : "opacity-55"}>
                    <td className="min-w-44">
                      <span className="font-medium">{c.name}</span>
                      {!c.active && <span className="ms-2"><Badge>موقوف</Badge></span>}
                      {c.notes && <span className="block text-xs text-ink-3">{c.notes}</span>}
                    </td>
                    <td>{c.categoryName ? <Badge>{c.categoryName}</Badge> : <span className="text-ink-3">—</span>}</td>
                    <td className="text-ink-2">{CYCLES[c.cycle].label}</td>
                    <td className="cell-num">{money(c.amount)}</td>
                    <td className="cell-num font-semibold">{money(c.annual, { digits: 0 })}</td>
                    <td className="cell-actions">
                      <div className="flex items-center">
                        <Modal trigger={<Pencil size={15} />} triggerClassName="btn btn-ghost btn-icon text-ink-3" triggerLabel="تعديل" title="تعديل بند متكرر">
                          <OperatingCostForm cost={c} categories={categories} />
                        </Modal>
                        <DeleteButton action={deleteOperatingCost.bind(null, c.id)} confirm={`حذف «${c.name}»؟ المصروفات المسجّلة منه تبقى.`} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4} className="border-t border-line px-4 py-3 text-sm text-ink-3">
                    مجموع البنود الفعّالة
                  </td>
                  <td className="cell-num border-t border-line px-4 py-3 font-bold">{money(annual, { digits: 0 })}</td>
                  <td className="border-t border-line" />
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}

      <div className="mt-5">
        <Alert level="info">
          عند دفع أي بند فعلياً سجّله من «سجل المصروفات» بزر <strong>تسجيل</strong>؛ هذه الصفحة تعرّف الالتزام، والسجل يثبت الدفع.
        </Alert>
      </div>
    </>
  );
}
