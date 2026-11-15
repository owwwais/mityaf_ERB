import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowLeftRight, Landmark, Plus } from "lucide-react";
import { DeleteButton } from "@/components/form";
import { Modal } from "@/components/modal";
import { Alert, Badge, Card, EmptyState, PageHeader, Row, cx } from "@/components/ui";
import { date, money, pct, todayISO } from "@/lib/format";
import { partnerOptions } from "@/modules/core/queries";
import { deleteTransfer } from "@/modules/finance/actions";
import { TransferForm } from "@/modules/finance/components/forms";
import { TREASURY_LABEL } from "@/modules/finance/constants";
import { getSettlement, listTransfers } from "@/modules/finance/queries";
import { TREASURY, type PartyPosition } from "@/modules/finance/settlement";

export const metadata: Metadata = { title: "الشركاء والخزينة" };

function balanceText(p: PartyPosition): { text: string; tone: "ok" | "owes" | "owed" } {
  if (Math.abs(p.balance) < 0.5) return { text: "متوازن", tone: "ok" };
  if (p.id === TREASURY) {
    // الخزينة ليست شخصاً: فائضها دين عليها للشركاء، ونقصها مال لها عندهم.
    return p.balance > 0
      ? { text: `مدينة للشركاء بـ ${money(p.balance, { digits: 0 })}`, tone: "owes" }
      : { text: `لها ${money(-p.balance, { digits: 0 })} بحوزة الشركاء`, tone: "owed" };
  }
  if (p.balance > 0) return { text: `بحوزته ${money(p.balance, { digits: 0 })} فوق حقه`, tone: "owes" };
  return { text: `له ${money(-p.balance, { digits: 0 })} لم يستلمها`, tone: "owed" };
}

function PositionCard({ position, title, subtitle, icon }: { position: PartyPosition; title: string; subtitle: string; icon?: React.ReactNode }) {
  const b = balanceText(position);
  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft font-bold text-primary-ink">{icon ?? title.charAt(0)}</span>
        <div className="min-w-0">
          <p className="truncate font-semibold">{title}</p>
          <p className="text-xs text-ink-3">{subtitle}</p>
        </div>
      </div>
      <Row label={position.id === TREASURY ? "رصيدها الدفتري" : "المستحق له"} value={money(position.entitlement, { digits: 0 })} />
      <Row label={position.id === TREASURY ? "النقد في حساب الشركة" : "النقد الذي بحوزته"} value={money(position.cashHeld, { digits: 0 })} />
      <div className="mt-2 border-t border-line pt-2.5">
        <p className={cx("text-sm font-bold", b.tone === "ok" ? "text-success" : b.tone === "owes" ? "text-warning" : "text-info")}>{b.text}</p>
        <p className="mt-0.5 text-xs text-ink-3">
          استلم {money(position.received, { digits: 0 })} · صرف {money(position.spent, { digits: 0 })}
        </p>
      </div>
    </div>
  );
}

export default async function PartnersPage() {
  const [{ settlement, projects, partners, settings }, transfers] = await Promise.all([getSettlement(), listTransfers()]);
  const today = todayISO();
  const options = partnerOptions(partners);
  const partnerById = new Map(partners.map((p) => [p.id, p]));
  const idOrNull = (id: string) => (id === TREASURY ? null : id);
  const projectRows = projects
    .map((p) => ({ project: p, net: settlement.projectNets.get(p.id) }))
    .filter((r): r is { project: (typeof projects)[number]; net: NonNullable<typeof r.net> } => !!r.net);

  return (
    <>
      <PageHeader
        title="الشركاء والخزينة"
        description="من يحمل المال الآن، ولمن يعود. تُحسب من كل دفعة ومصروف وتحويل مسجَّل."
        actions={
          <Modal trigger={<><Plus size={17} /> تحويل تسوية</>} title="تسجيل تحويل" description="تحويل فعلي بين شريك والخزينة، أو بين شريكين.">
            <TransferForm partners={options} today={today} />
          </Modal>
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <PositionCard
          position={settlement.treasury}
          title={TREASURY_LABEL}
          subtitle={`${pct(settings.treasuryPct)} من صافي كل مشروع، وتتحمل المصروف العام`}
          icon={<Landmark size={18} />}
        />
        {settlement.partners.map((p) => {
          const partner = partnerById.get(p.id);
          return (
            <PositionCard
              key={p.id}
              position={p}
              title={p.name}
              subtitle={`${partner?.title || "شريك"}${partner && !partner.active ? " · غير نشط" : ""}`}
            />
          );
        })}
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Card title="التسوية المقترحة" description="أقل عدد من التحويلات يجعل ما بحوزة كل طرف مساوياً لحقه">
          {settlement.suggestions.length === 0 ? (
            <Alert level="success">الحسابات متوازنة: كل طرف بحوزته ما يستحقه تماماً.</Alert>
          ) : (
            <ul className="space-y-2.5">
              {settlement.suggestions.map((s, i) => (
                <li key={i} className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-line px-3.5 py-2.5">
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2 text-sm">
                      <strong>{s.fromName}</strong>
                      <ArrowLeft size={15} className="text-ink-3" aria-label="يحوّل إلى" />
                      <strong>{s.toName}</strong>
                      <span className="font-bold text-primary-ink">{money(s.amount)}</span>
                    </span>
                    {s.from === TREASURY && settlement.treasury.cashHeld < s.amount && (
                      <span className="mt-0.5 block text-xs text-ink-3">دين على الشركة: يُسدَّد حين تدخل حصة الخزينة من الإيرادات القادمة.</span>
                    )}
                  </span>
                  <Modal trigger="تسجيل بعد التحويل" triggerClassName="btn btn-secondary btn-sm" title="تسجيل تحويل">
                    <TransferForm partners={options} today={today} preset={{ from: idOrNull(s.from), to: idOrNull(s.to), amount: s.amount }} />
                  </Modal>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-xs leading-relaxed text-ink-3">
            لا يوجد حساب بنكي للشركة بعد؟ اتركوا مبلغ الخزينة لدى أحدكما؛ سيظهر هنا بوضوح أنه أمانة للشركة وليس من حقه.
          </p>
        </Card>

        <Card title="رصيد الخزينة" description="كيف تكوّن">
          <Row label={`حصتها من صافي المشاريع (${pct(settings.treasuryPct)})`} value={money(settlement.treasury.projectShare, { sign: true })} />
          <Row label="إيرادات عامة بلا مشروع" value={money(settlement.treasury.generalRevenue, { sign: true })} />
          <Row label="مصروفات تشغيلية عامة" value={money(-settlement.treasury.overhead)} />
          <div className="mt-1 border-t border-line pt-1">
            <Row label="الرصيد الدفتري" value={money(settlement.treasury.entitlement)} strong />
          </div>
          {settlement.treasury.entitlement < 0 && (
            <div className="mt-3">
              <Alert level="warning">الخزينة بالسالب: المصروف العام أكبر مما اقتُطع لها. الفرق يتحمله من دفع من جيبه حتى تدخل إيرادات جديدة.</Alert>
            </div>
          )}
        </Card>
      </div>

      <Card className="mt-5" flush title="توزيع صافي كل مشروع" description="المحصَّل ناقص التكاليف المباشرة، ثم الخزينة، ثم الشركاء">
        {projectRows.length === 0 ? (
          <EmptyState title="لا حركات على المشاريع بعد" />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>المشروع</th>
                  <th className="cell-num">المحصَّل</th>
                  <th className="cell-num">تكاليف مباشرة</th>
                  <th className="cell-num">الصافي</th>
                  <th className="cell-num">الخزينة</th>
                  {settlement.partners.map((p) => (
                    <th key={p.id} className="cell-num">
                      {p.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {projectRows.map(({ project, net }) => (
                  <tr key={project.id}>
                    <td className="min-w-48">
                      <Link href={`/projects/${project.id}`} className="font-medium hover:underline">
                        {project.name}
                      </Link>
                      <span className="ms-2"><Badge>{project.type === "joint" ? "مشترك" : "فردي"}</Badge></span>
                    </td>
                    <td className="cell-num">{money(net.revenue, { digits: 0 })}</td>
                    <td className="cell-num text-ink-2">{money(net.directCost, { digits: 0 })}</td>
                    <td className="cell-num font-semibold">{money(net.net, { digits: 0 })}</td>
                    <td className="cell-num">{money(net.treasury, { digits: 0 })}</td>
                    {settlement.partners.map((p) => (
                      <td key={p.id} className="cell-num">
                        {money(net.shares.get(p.id) ?? 0, { digits: 0 })}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="mt-5" flush title="سجل التحويلات">
        {transfers.length === 0 ? (
          <EmptyState icon={<ArrowLeftRight size={20} />} title="لا تحويلات مسجّلة" description="عند تنفيذ أي تحويل تسوية سجّله ليُحدَّث ما بحوزة كل طرف." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>التاريخ</th>
                  <th>من</th>
                  <th>إلى</th>
                  <th>ملاحظات</th>
                  <th className="cell-num">المبلغ</th>
                  <th className="cell-actions" />
                </tr>
              </thead>
              <tbody>
                {transfers.map((t) => (
                  <tr key={t.id}>
                    <td className="whitespace-nowrap text-ink-2">{date(t.date)}</td>
                    <td>{t.fromName ?? TREASURY_LABEL}</td>
                    <td>{t.toName ?? TREASURY_LABEL}</td>
                    <td className="text-ink-2">{t.notes || "—"}</td>
                    <td className="cell-num font-semibold">{money(t.amount)}</td>
                    <td className="cell-actions">
                      <DeleteButton action={deleteTransfer.bind(null, t.id)} confirm="حذف هذا التحويل من السجل؟" />
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
