import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, Calculator, ChevronLeft, FolderKanban, Plus, Receipt, Repeat } from "lucide-react";
import { BarList, Meter, PairedBars, type MeterStatus } from "@/components/charts";
import { Modal } from "@/components/modal";
import { Alert, Badge, Card, EmptyState, PageHeader, Stat } from "@/components/ui";
import { dateShort, hours, money, monthLabel, monthShort, pct } from "@/lib/format";
import { requireUser } from "@/lib/auth";
import { getDashboard, WEEKLY_TARGETS } from "@/modules/dashboard/queries";
import { ExpenseForm } from "@/modules/finance/components/forms";
import { getFormLookups } from "@/modules/finance/lookups";
import { projectStatusMeta } from "@/modules/projects/constants";

export const metadata: Metadata = { title: "لوحة القيادة" };

function Kpi({ label, value, target, ok }: { label: string; value: string; target: string; ok: boolean | null }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <div className="min-w-0">
        <p className="text-sm">{label}</p>
        <p className="text-xs text-ink-3">الهدف {target}</p>
      </div>
      <span className="flex shrink-0 items-center gap-2">
        <span className="text-base font-bold">{value}</span>
        {ok != null && <Badge tone={ok ? "success" : "neutral"}>{ok ? "تحقق" : "دون الهدف"}</Badge>}
      </span>
    </div>
  );
}

export default async function DashboardPage() {
  const user = await requireUser();
  const [d, lookups] = await Promise.all([getDashboard(), getFormLookups()]);
  const { settings, current, kpis } = d;

  const target = settings.monthlyRevenueTarget;
  const reached = target > 0 ? (current.revenue / target) * 100 : 0;
  const revenueStatus: MeterStatus = reached >= 100 ? "good" : reached >= 50 ? "warning" : "critical";
  const cap = settings.monthlyExpenseCap;
  const used = cap > 0 ? (current.overhead / cap) * 100 : 0;
  const capStatus: MeterStatus = used >= 100 ? "critical" : used >= 80 ? "warning" : "good";
  const usedHours = kpis.weeklyCapacity > 0 ? (kpis.hoursThisWeek / kpis.weeklyCapacity) * 100 : 0;

  return (
    <>
      <PageHeader
        title={`أهلاً ${user.name.split(" ")[0]}`}
        description={`${monthLabel(d.month)} — أين وصلت الشركة هذا الشهر، وما الذي يحتاج قراراً.`}
        actions={
          <>
            <Link href="/pricing/new" className="btn btn-secondary">
              <Calculator size={16} /> عرض سعر
            </Link>
            <Modal trigger={<><Plus size={17} /> مصروف</>} title="تسجيل مصروف">
              <ExpenseForm lookups={lookups} />
            </Modal>
          </>
        }
      />

      {d.isEmpty && (
        <Card className="mb-5" title="ثلاث خطوات ليعمل النظام لكم">
          <ol className="grid gap-3 sm:grid-cols-3">
            {[
              { href: "/expenses/recurring", icon: Repeat, title: "١. التكاليف المتكررة", text: "استضافة، نطاقات، أدوات. منها تُحسب تكلفة الساعة." },
              { href: "/settings", icon: FolderKanban, title: "٢. ساعاتكما وسعر وقتكما", text: "الطاقة الأسبوعية والسعر الحقيقي لساعة كل شريك." },
              { href: "/pricing/new", icon: Calculator, title: "٣. أول عرض سعر", text: "أدخل بنود العمل ودَع النظام يقترح السعر." },
            ].map((s) => (
              <li key={s.href}>
                <Link href={s.href} className="flex h-full gap-3 rounded-sm border border-line p-3.5 transition-colors hover:border-accent hover:bg-primary-soft">
                  <s.icon size={19} className="mt-0.5 shrink-0 text-primary-ink" aria-hidden />
                  <span>
                    <span className="block text-sm font-semibold">{s.title}</span>
                    <span className="block text-[13px] leading-relaxed text-ink-3">{s.text}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </Card>
      )}

      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="إيراد الشهر" value={money(current.revenue, { digits: 0 })}>
          <Meter value={current.revenue} max={target} status={revenueStatus} caption={target > 0 ? `${pct(reached)} من هدف ${money(target, { digits: 0 })}` : "لا هدف محدد"} />
        </Stat>
        <Stat label="المصروف التشغيلي" value={money(current.overhead, { digits: 0 })}>
          <Meter
            value={current.overhead}
            max={cap}
            status={capStatus}
            caption={cap > 0 ? (used >= 100 ? `تجاوز سقف ${money(cap, { digits: 0 })}` : `${pct(used)} من سقف ${money(cap, { digits: 0 })}`) : "لا سقف محدد"}
          />
        </Stat>
        <Stat
          label="صافي الشهر"
          value={money(current.net, { digits: 0 })}
          tone={current.net < 0 ? "danger" : current.net > 0 ? "success" : undefined}
          hint={d.previous ? `الشهر الماضي ${money(d.previous.net, { digits: 0 })}` : undefined}
        />
        <Stat
          label="رصيد الخزينة"
          value={money(d.treasury.entitlement, { digits: 0 })}
          tone={d.treasury.entitlement < 0 ? "danger" : undefined}
          hint={`مستحقات لم تُحصَّل ${money(d.outstanding, { digits: 0 })}`}
        />
      </div>

      {d.alerts.length > 0 && (
        <Card className="mb-5" title="يحتاج انتباهكما" description={`${d.alerts.length} تنبيه مشتق من الأرقام الحالية`}>
          <ul className="space-y-2">
            {d.alerts.map((a, i) => (
              <li key={i}>
                <Link href={a.href} className="group block">
                  <Alert level={a.level} title={<span className="flex items-center justify-between gap-3">{a.title}<ChevronLeft size={16} className="shrink-0 text-ink-3 transition-transform group-hover:-translate-x-0.5" aria-hidden /></span>}>
                    {a.detail}
                  </Alert>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2" title="الإيراد والمصروف" description="آخر ستة أشهر، بالريال (أساس نقدي)" actions={<Link href="/reports" className="btn btn-ghost btn-sm">التقرير الكامل</Link>}>
          <PairedBars
            seriesA="الإيراد"
            seriesB="المصروف"
            data={d.series.map((m) => ({
              key: m.month,
              label: monthShort(m.month),
              a: m.revenue,
              b: m.expenses,
              detail: `الصافي ${money(m.net, { digits: 0, sign: true })}`,
            }))}
          />
        </Card>

        <Card title="مؤشرات الأسبوع" description="من خطة الـ90 يوماً">
          <div className="divide-y divide-line">
            <Kpi label="عملاء محتملون جدد" value={String(kpis.newLeads)} target={`${WEEKLY_TARGETS.newLeads} أسبوعياً`} ok={kpis.newLeads >= WEEKLY_TARGETS.newLeads} />
            <Kpi label="عروض مُرسلة" value={String(kpis.quotesSent)} target={`${WEEKLY_TARGETS.quotesSent} أسبوعياً`} ok={kpis.quotesSent >= WEEKLY_TARGETS.quotesSent} />
            <Kpi
              label="عملاء دفعوا (90 يوماً)"
              value={String(kpis.payingClients90d)}
              target={String(WEEKLY_TARGETS.payingClients90d)}
              ok={kpis.payingClients90d >= WEEKLY_TARGETS.payingClients90d}
            />
            <Kpi
              label="التحويل من عرض إلى عقد"
              value={kpis.conversionPct == null ? "—" : pct(kpis.conversionPct)}
              target={`${WEEKLY_TARGETS.conversionPct}٪`}
              ok={kpis.conversionPct == null ? null : kpis.conversionPct >= WEEKLY_TARGETS.conversionPct}
            />
          </div>
          <div className="mt-2 border-t border-line pt-3">
            <p className="text-sm">ساعات هذا الأسبوع</p>
            <Meter
              value={kpis.hoursThisWeek}
              max={kpis.weeklyCapacity}
              status={usedHours > 100 ? "critical" : usedHours > 85 ? "warning" : "good"}
              caption={`${hours(kpis.hoursThisWeek)} من ${hours(kpis.weeklyCapacity)} متاحة للشريكين`}
            />
          </div>
        </Card>

        <Card title={`مصروفات ${monthLabel(d.month)}`} description="حسب الفئة" actions={<Link href="/expenses" className="btn btn-ghost btn-sm">السجل</Link>}>
          {d.categories.length === 0 ? (
            <EmptyState icon={<Receipt size={20} />} title="لا مصروفات هذا الشهر" />
          ) : (
            <BarList items={d.categories} />
          )}
        </Card>

        <Card flush title="مشاريع جارية" actions={<Link href="/projects" className="btn btn-ghost btn-sm">الكل</Link>}>
          {d.openProjects.length === 0 ? (
            <EmptyState icon={<FolderKanban size={20} />} title="لا مشاريع جارية" />
          ) : (
            <ul className="divide-y divide-line">
              {d.openProjects.slice(0, 5).map((p) => {
                const meta = projectStatusMeta(p.status);
                const progress = p.estimatedHours > 0 ? Math.min(p.hoursLogged / p.estimatedHours, 1) : 0;
                return (
                  <li key={p.id}>
                    <Link href={`/projects/${p.id}`} className="block px-5 py-3 transition-colors hover:bg-surface-2/60">
                      <span className="flex items-start justify-between gap-3">
                        <span className="min-w-0 truncate text-sm font-medium">{p.name}</span>
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                      </span>
                      <span className="mt-1.5 flex items-center gap-3 text-xs text-ink-3">
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                          <span className="block h-full rounded-full" style={{ width: `${progress * 100}%`, background: "var(--series-1)" }} />
                        </span>
                        <span className="shrink-0">
                          {hours(p.hoursLogged)} / {hours(p.estimatedHours)}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card flush title="آخر الحركات">
          {d.activity.length === 0 ? (
            <EmptyState title="لا حركات بعد" />
          ) : (
            <ul className="divide-y divide-line">
              {d.activity.map((a) => (
                <li key={a.id} className="flex items-center gap-3 px-5 py-2.5">
                  <span className={`flex size-8 shrink-0 items-center justify-center rounded-full ${a.amount > 0 ? "bg-success-soft text-success" : "bg-surface-2 text-ink-3"}`}>
                    {a.amount > 0 ? <ArrowDownLeft size={15} aria-label="إيراد" /> : <ArrowUpRight size={15} aria-label="مصروف" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{a.label}</span>
                    <span className="block truncate text-xs text-ink-3">
                      {dateShort(a.date)} · {a.sub}
                    </span>
                  </span>
                  <span className={`shrink-0 text-sm font-semibold ${a.amount > 0 ? "text-success" : ""}`}>{money(a.amount, { sign: true })}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
