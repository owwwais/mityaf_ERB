import type { Metadata } from "next";
import Link from "next/link";
import { Calculator, CalendarClock, Pencil, Plus, Users } from "lucide-react";
import { ChipFilter } from "@/components/filters";
import { DeleteButton } from "@/components/form";
import { Modal } from "@/components/modal";
import { Badge, Card, EmptyState, PageHeader, Stat } from "@/components/ui";
import { dateShort, money, pct, todayISO } from "@/lib/format";
import { deleteClient } from "@/modules/crm/actions";
import { ClientForm } from "@/modules/crm/components/forms";
import { SOURCES, STAGES, stageMeta, type Source, type Stage } from "@/modules/crm/constants";
import { listClients } from "@/modules/crm/queries";

export const metadata: Metadata = { title: "العملاء" };

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ stage?: string }> }) {
  const [{ stage }, all] = await Promise.all([searchParams, listClients()]);
  const today = todayISO();
  const rows = stage ? all.filter((c) => c.stage === stage) : all;

  const counts = new Map<string, number>();
  for (const c of all) counts.set(c.stage, (counts.get(c.stage) ?? 0) + 1);
  const openClients = all.filter((c) => stageMeta(c.stage).open);
  const pipeline = openClients.reduce((s, c) => s + c.expectedValue, 0);
  const won = counts.get("won") ?? 0;
  const lost = counts.get("lost") ?? 0;
  const due = openClients.filter((c) => c.followUpDate && c.followUpDate <= today).length;

  return (
    <>
      <PageHeader
        title="العملاء"
        description="من المنشأة المحتملة إلى العقد: مرحلة كل عميل، وما المطلوب بعدها، ومتى."
        actions={
          <Modal trigger={<><Plus size={17} /> عميل جديد</>} title="عميل جديد" wide>
            <ClientForm />
          </Modal>
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Stat label="قيمة الفرص المفتوحة" value={money(pipeline, { digits: 0 })} hint={`${openClients.length} عميل قيد المتابعة`} />
        <Stat label="عملاء فازوا" value={won} hint={won + lost > 0 ? `${pct((won / (won + lost)) * 100)} من المحسوم` : "لا صفقات محسومة بعد"} />
        <Stat label="متابعات حان موعدها" value={due} tone={due > 0 ? "warning" : undefined} hint={due > 0 ? "اليوم أو قبله" : "لا متابعات متأخرة"} />
      </div>

      <Card
        flush
        title={
          <ChipFilter
            name="stage"
            options={(Object.keys(STAGES) as Stage[]).filter((s) => counts.has(s)).map((s) => ({ value: s, label: STAGES[s].label, count: counts.get(s) }))}
          />
        }
      >
        {rows.length === 0 ? (
          <EmptyState icon={<Users size={20} />} title="لا عملاء" description="أضف أول عميل محتمل وحدد خطوته التالية." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>العميل</th>
                  <th>المرحلة</th>
                  <th>مهتم بـ</th>
                  <th>الخطوة التالية</th>
                  <th className="cell-num">القيمة المتوقعة</th>
                  <th className="cell-actions" />
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => {
                  const meta = stageMeta(c.stage);
                  const overdue = meta.open && c.followUpDate != null && c.followUpDate <= today;
                  return (
                    <tr key={c.id}>
                      <td className="min-w-48">
                        <span className="font-medium">{c.name}</span>
                        <span className="block text-xs text-ink-3">
                          {[c.contactName, c.sector, SOURCES[c.source as Source]].filter(Boolean).join(" · ")}
                        </span>
                      </td>
                      <td><Badge tone={meta.tone}>{meta.label}</Badge></td>
                      <td className="text-ink-2">{c.interest || "—"}</td>
                      <td className="min-w-40">
                        <span className="text-ink-2">{c.nextStep || "—"}</span>
                        {c.followUpDate && meta.open && (
                          <span className={`mt-0.5 flex items-center gap-1 text-xs ${overdue ? "font-semibold text-warning" : "text-ink-3"}`}>
                            <CalendarClock size={12} aria-hidden /> {dateShort(c.followUpDate)}
                            {overdue && " · حان موعدها"}
                          </span>
                        )}
                      </td>
                      <td className="cell-num">{c.expectedValue > 0 ? money(c.expectedValue, { digits: 0 }) : <span className="text-ink-3">—</span>}</td>
                      <td className="cell-actions">
                        <div className="flex items-center">
                          <Link href={`/pricing/new?client=${c.id}`} className="btn btn-ghost btn-icon text-ink-3" aria-label="عرض سعر لهذا العميل" title="عرض سعر لهذا العميل">
                            <Calculator size={15} />
                          </Link>
                          <Modal trigger={<Pencil size={15} />} triggerClassName="btn btn-ghost btn-icon text-ink-3" triggerLabel="تعديل" title="تعديل عميل" wide>
                            <ClientForm client={c} />
                          </Modal>
                          <DeleteButton action={deleteClient.bind(null, c.id)} confirm={`حذف «${c.name}»؟ مشاريعه وعروضه تبقى بلا عميل.`} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
