import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Clock, Pencil, Plus } from "lucide-react";
import { ActionButton, DeleteButton } from "@/components/form";
import { Modal } from "@/components/modal";
import { Alert, Badge, Card, EmptyState, PageHeader, Row, Stat } from "@/components/ui";
import { date, dateShort, hours, money, pct } from "@/lib/format";
import { getSettings, partnerOptions } from "@/modules/core/queries";
import { clientOptions } from "@/modules/crm/queries";
import { deleteExpense, deletePayment } from "@/modules/finance/actions";
import { ExpenseForm, PaymentForm } from "@/modules/finance/components/forms";
import { PAYMENT_KINDS, TREASURY_LABEL, type PaymentKind } from "@/modules/finance/constants";
import { distribute } from "@/modules/finance/distribution";
import { getFormLookups } from "@/modules/finance/lookups";
import { listExpenses, listPayments } from "@/modules/finance/queries";
import { getPricingContext } from "@/modules/pricing/queries";
import { deleteProject, deleteTimeLog } from "@/modules/projects/actions";
import { ProjectForm, TimeLogForm } from "@/modules/projects/components/forms";
import { BILLING, projectStatusMeta } from "@/modules/projects/constants";
import { getProject, listTimeLogs } from "@/modules/projects/queries";

export const metadata: Metadata = { title: "مشروع" };

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) notFound();

  const [settings, lookups, clients, logs, payments, expenses, { model, rules }] = await Promise.all([
    getSettings(),
    getFormLookups(),
    clientOptions(),
    listTimeLogs(id),
    listPayments({ projectId: id }),
    listExpenses({ projectId: id }),
    getPricingContext(),
  ]);

  const meta = projectStatusMeta(project.status);
  const monthly = project.billing === "monthly";
  const partnerCost = new Map(model.partners.map((p) => [p.id, p.loadedPerHour]));
  // تكلفة الوقت الفعلية: ساعات كل شريك × تكلفة ساعته المحمّلة
  const timeCost = logs.reduce((s, l) => s + l.hours * (partnerCost.get(l.partnerId) ?? model.breakEvenRate), 0);
  const realCost = timeCost + project.directCost;
  // للمقطوع نقيس على السعر المتفق عليه؛ للشهري على ما حُصّل فعلاً.
  const revenueBasis = monthly ? project.collected : project.price;
  const profit = revenueBasis - realCost;
  const margin = revenueBasis > 0 ? (profit / revenueBasis) * 100 : 0;
  const overrun = !monthly && project.estimatedHours > 0 && project.overrunPct > settings.hoursOverrunAlertPct;
  const split = distribute(project.collected - project.directCost, project, rules, rules.partnerShares);
  const hasMoney = project.collected > 0 || project.directCost > 0;

  return (
    <>
      <Link href="/projects" className="mb-3 inline-flex items-center gap-1 text-[13px] font-medium text-ink-3 hover:text-ink">
        <ChevronRight size={15} /> المشاريع
      </Link>
      <PageHeader
        title={project.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={meta.tone}>{meta.label}</Badge>
            <span>{project.clientName ?? "بلا عميل"}</span>
            <span className="text-ink-3">· {project.type === "joint" ? "مشترك" : "فردي"} · {BILLING[project.billing]}</span>
            {project.dueDate && <span className="text-ink-3">· التسليم {date(project.dueDate)}</span>}
            {project.quoteId && (
              <Link href={`/pricing/${project.quoteId}`} className="font-semibold text-primary-ink hover:underline">
                عرض السعر
              </Link>
            )}
          </span>
        }
        actions={
          <>
            <Modal trigger={<><Pencil size={15} /> تعديل</>} triggerClassName="btn btn-secondary" title="تعديل المشروع" wide>
              <ProjectForm project={project} clients={clients} partners={lookups.partners} today={lookups.today} />
            </Modal>
            <ActionButton
              action={deleteProject.bind(null, project.id)}
              confirm="حذف المشروع وسجل ساعاته؟ الدفعات والمصروفات تبقى وتصبح عامة."
              className="btn btn-danger"
            >
              حذف
            </ActionButton>
          </>
        }
      />

      {overrun && (
        <div className="mb-5">
          <Alert level="danger" title={`تجاوز الساعات المقدّرة بـ ${pct(project.overrunPct)}`}>
            الحد المتفق عليه {pct(settings.hoursOverrunAlertPct)}. التجاوز فوقه يعني أن المشكلة في التقدير لا في التنفيذ: ارفعوا هامش المخاطرة في العروض المشابهة القادمة.
          </Alert>
        </div>
      )}

      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={monthly ? "قيمة الباقة شهرياً" : "السعر المتفق عليه"} value={money(project.price, { digits: 0 })} />
        <Stat
          label="المحصَّل"
          value={money(project.collected, { digits: 0 })}
          hint={monthly ? `${payments.length} دفعة` : project.outstanding > 0 ? `المتبقي ${money(project.outstanding, { digits: 0 })}` : "حُصّل كاملاً"}
        />
        <Stat
          label="الساعات"
          value={hours(project.hoursLogged)}
          tone={overrun ? "danger" : undefined}
          hint={monthly ? `التقدير ${hours(project.estimatedHours)} شهرياً` : `من ${hours(project.estimatedHours)} مقدّرة`}
        />
        <Stat
          label={monthly ? "الربح الحقيقي حتى الآن" : "الربح الحقيقي المتوقع"}
          value={money(profit, { digits: 0 })}
          tone={profit < 0 ? "danger" : margin < settings.minMarginPct ? "warning" : "success"}
          hint={`هامش ${pct(margin)} بعد احتساب الوقت`}
        />
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card
            flush
            title="سجل الساعات"
            description="سجّل كل جلسة عمل: هذا ما يكشف دقة التقدير"
            actions={
              <Modal trigger={<><Plus size={15} /> ساعات</>} triggerClassName="btn btn-secondary btn-sm" title="تسجيل ساعات عمل">
                {lookups.partners.length ? (
                  <TimeLogForm projectId={project.id} partners={lookups.partners} myPartnerId={lookups.myPartnerId} today={lookups.today} />
                ) : (
                  <p className="text-sm text-ink-3">أضف شريكاً فعّالاً من الإعدادات أولاً.</p>
                )}
              </Modal>
            }
          >
            {logs.length === 0 ? (
              <EmptyState icon={<Clock size={20} />} title="لا ساعات مسجّلة" />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>التاريخ</th>
                      <th>الشريك</th>
                      <th>ما أُنجز</th>
                      <th className="cell-num">الساعات</th>
                      <th className="cell-actions" />
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((l) => (
                      <tr key={l.id}>
                        <td className="whitespace-nowrap text-ink-2">{dateShort(l.date)}</td>
                        <td className="whitespace-nowrap">{l.partnerName}</td>
                        <td className="text-ink-2">{l.note || "—"}</td>
                        <td className="cell-num font-semibold">{hours(l.hours)}</td>
                        <td className="cell-actions">
                          <DeleteButton action={deleteTimeLog.bind(null, l.id)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card
            flush
            title="الدفعات المستلمة"
            actions={
              <Modal trigger={<><Plus size={15} /> دفعة</>} triggerClassName="btn btn-secondary btn-sm" title="تسجيل دفعة مستلمة">
                <PaymentForm lookups={lookups} projectId={project.id} />
              </Modal>
            }
          >
            {payments.length === 0 ? (
              <EmptyState title="لم تُستلم دفعات بعد" description={`الدفعة المقدمة المتفق عليها ${pct(settings.downPaymentPct)}.`} />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id}>
                        <td className="whitespace-nowrap text-ink-2">{dateShort(p.date)}</td>
                        <td><Badge>{PAYMENT_KINDS[p.kind as PaymentKind] ?? p.kind}</Badge></td>
                        <td className="whitespace-nowrap text-ink-2">استلمها {p.receivedByName ?? TREASURY_LABEL}</td>
                        <td className="cell-num font-semibold text-success">{money(p.amount)}</td>
                        <td className="cell-actions">
                          <DeleteButton action={deletePayment.bind(null, p.id)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card
            flush
            title="تكاليف مباشرة"
            description="ما صُرف لطرف ثالث من أجل هذا المشروع"
            actions={
              <Modal trigger={<><Plus size={15} /> تكلفة</>} triggerClassName="btn btn-secondary btn-sm" title="تسجيل تكلفة على المشروع">
                <ExpenseForm lookups={lookups} projectId={project.id} />
              </Modal>
            }
          >
            {expenses.length === 0 ? (
              <EmptyState title="لا تكاليف مباشرة" />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <tbody>
                    {expenses.map((e) => (
                      <tr key={e.id}>
                        <td className="whitespace-nowrap text-ink-2">{dateShort(e.date)}</td>
                        <td className="font-medium">{e.description}</td>
                        <td className="whitespace-nowrap text-ink-2">دفعها {e.paidByName ?? TREASURY_LABEL}</td>
                        <td className="cell-num font-semibold">{money(e.amount)}</td>
                        <td className="cell-actions">
                          <DeleteButton action={deleteExpense.bind(null, e.id)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card title="الربحية الحقيقية" description="بعد احتساب وقتكما بسعره الحقيقي">
            <Row label={monthly ? "المحصَّل حتى الآن" : "السعر المتفق عليه"} value={money(revenueBasis, { digits: 0 })} />
            <Row label={`تكلفة الوقت (${hours(project.hoursLogged)})`} value={money(-timeCost, { digits: 0 })} />
            <Row label="تكاليف مباشرة" value={money(-project.directCost, { digits: 0 })} />
            <div className="border-t border-line">
              <Row label="الربح" value={money(profit, { digits: 0, sign: true })} strong />
              <Row label="الهامش" value={pct(margin)} />
            </div>
            {!monthly && project.hoursLogged > 0 && (
              <p className="mt-2 text-xs leading-relaxed text-ink-3">
                سعر الساعة المحقَّق: <strong className="text-ink-2">{money((project.price - project.directCost) / project.hoursLogged, { digits: 0 })}</strong> مقابل سعر تعادل{" "}
                {money(model.breakEvenRate, { digits: 0 })}.
              </p>
            )}
          </Card>

          <Card title="توزيع المحصَّل" description="المحصَّل ناقص التكاليف المباشرة">
            {hasMoney ? (
              <>
                <Row label="الصافي القابل للتوزيع" value={money(split.net, { digits: 0 })} strong />
                <Row label="خزينة الشركة" value={money(split.treasury, { digits: 0 })} />
                {split.shares.map((s) => (
                  <Row
                    key={s.partnerId}
                    label={`${s.name}${s.role === "finder" ? " (جالب)" : s.role === "executor" ? " (منفّذ)" : s.role === "finder_executor" ? " (جالب ومنفّذ)" : ""}`}
                    value={money(s.amount, { digits: 0 })}
                  />
                ))}
                <Link href="/partners" className="mt-2 inline-block text-[13px] font-semibold text-primary-ink hover:underline">
                  التسوية بين الشركاء
                </Link>
              </>
            ) : (
              <p className="text-sm text-ink-3">يظهر التوزيع عند استلام أول دفعة.</p>
            )}
          </Card>

          {project.notes && (
            <Card title="ملاحظات">
              <p className="text-sm leading-relaxed whitespace-pre-line text-ink-2">{project.notes}</p>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
