import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, FolderKanban, Plus } from "lucide-react";
import { ChipFilter } from "@/components/filters";
import { Modal } from "@/components/modal";
import { Badge, Card, EmptyState, PageHeader, Stat } from "@/components/ui";
import { date, hours, money, pct, todayISO } from "@/lib/format";
import { getSettings, listPartners, partnerOptions } from "@/modules/core/queries";
import { clientOptions } from "@/modules/crm/queries";
import { ProjectForm } from "@/modules/projects/components/forms";
import { BILLING, PROJECT_STATUSES, projectStatusMeta } from "@/modules/projects/constants";
import { listProjects } from "@/modules/projects/queries";

export const metadata: Metadata = { title: "المشاريع" };

function Bar({ value, max, danger }: { value: number; max: number; danger?: boolean }) {
  const ratio = max > 0 ? Math.min(value / max, 1) : 0;
  return (
    <div className="mt-1 h-1.5 w-28 overflow-hidden rounded-full bg-surface-2">
      <div className="h-full rounded-full" style={{ width: `${ratio * 100}%`, background: danger ? "var(--status-critical)" : "var(--series-1)" }} />
    </div>
  );
}

export default async function ProjectsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const [{ status }, all, settings, clients, partners] = await Promise.all([searchParams, listProjects(), getSettings(), clientOptions(), listPartners()]);
  const rows = status ? all.filter((p) => p.status === status) : all;
  const open = all.filter((p) => p.open);
  const overrunLimit = settings.hoursOverrunAlertPct;
  const committed = open.reduce((s, p) => s + p.remainingHours, 0);
  const outstanding = all.reduce((s, p) => s + p.outstanding, 0);
  const counts = new Map<string, number>();
  for (const p of all) counts.set(p.status, (counts.get(p.status) ?? 0) + 1);

  return (
    <>
      <PageHeader
        title="المشاريع"
        description="كل مشروع بسعره وساعاته وما حُصّل منه. الساعات الفعلية هي ما يصحّح التسعير القادم."
        actions={
          <Modal trigger={<><Plus size={17} /> مشروع جديد</>} title="مشروع جديد" description="المشاريع القادمة من عرض سعر مقبول تُنشأ تلقائياً من صفحة العرض." wide>
            <ProjectForm clients={clients} partners={partnerOptions(partners)} today={todayISO()} />
          </Modal>
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Stat label="مشاريع جارية" value={open.length} hint={`من أصل ${all.length}`} />
        <Stat label="ساعات ملتزم بها" value={hours(committed)} hint="المتبقي من تقديرات المشاريع الجارية" />
        <Stat label="مبالغ لم تُحصَّل" value={money(outstanding, { digits: 0 })} />
      </div>

      <Card
        flush
        title={
          <ChipFilter
            name="status"
            options={Object.entries(PROJECT_STATUSES)
              .filter(([key]) => counts.has(key))
              .map(([value, s]) => ({ value, label: s.label, count: counts.get(value) }))}
          />
        }
      >
        {rows.length === 0 ? (
          <EmptyState
            icon={<FolderKanban size={20} />}
            title="لا مشاريع"
            description="أنشئ مشروعاً من الزر أعلاه، أو اقبل عرض سعر ليتحول إلى مشروع بسعره وساعاته."
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>المشروع</th>
                  <th>الحالة</th>
                  <th>الساعات</th>
                  <th>التحصيل</th>
                  <th className="cell-num">السعر</th>
                  <th>التسليم</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const meta = projectStatusMeta(p.status);
                  const overrun = p.billing === "one_time" && p.overrunPct > overrunLimit;
                  return (
                    <tr key={p.id}>
                      <td className="min-w-56">
                        <Link href={`/projects/${p.id}`} className="font-medium hover:underline">
                          {p.name}
                        </Link>
                        <span className="block text-xs text-ink-3">
                          {p.clientName ?? "بلا عميل"} · {p.type === "joint" ? "مشترك" : "فردي"}
                          {p.billing === "monthly" && ` · ${BILLING.monthly}`}
                        </span>
                      </td>
                      <td><Badge tone={meta.tone}>{meta.label}</Badge></td>
                      <td className="whitespace-nowrap">
                        <span className="text-[13px]">
                          {hours(p.hoursLogged)} <span className="text-ink-3">/ {hours(p.estimatedHours)}</span>
                          {overrun && (
                            <span className="ms-1.5 inline-flex items-center gap-1 font-semibold text-danger">
                              <AlertTriangle size={13} aria-hidden /> {pct(p.overrunPct)}+
                            </span>
                          )}
                        </span>
                        {p.billing === "one_time" && <Bar value={p.hoursLogged} max={p.estimatedHours} danger={overrun} />}
                      </td>
                      <td className="whitespace-nowrap">
                        <span className="text-[13px]">
                          {money(p.collected, { digits: 0 })}
                          {p.billing === "one_time" && <span className="text-ink-3"> / {money(p.price, { digits: 0 })}</span>}
                        </span>
                        {p.billing === "one_time" && <Bar value={p.collected} max={p.price} />}
                      </td>
                      <td className="cell-num font-semibold">
                        {money(p.price, { digits: 0 })}
                        {p.billing === "monthly" && <span className="block text-xs font-normal text-ink-3">شهرياً</span>}
                      </td>
                      <td className="whitespace-nowrap text-ink-2">{date(p.dueDate)}</td>
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
