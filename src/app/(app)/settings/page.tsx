import type { Metadata } from "next";
import { Pencil, Plus } from "lucide-react";
import { ActionForm, CheckboxField, DeleteButton, NumberField, SelectField, TextAreaField, TextField } from "@/components/form";
import { Modal } from "@/components/modal";
import { Alert, Badge, Card, PageHeader } from "@/components/ui";
import type { Partner, Service } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { hours, money, pct } from "@/lib/format";
import {
  changePassword,
  deleteCategory,
  deleteService,
  deleteUser,
  resetOperationalData,
  saveCategory,
  savePartner,
  saveService,
  saveSettings,
  saveUser,
} from "@/modules/core/actions";
import { getSettings, listPartners, listUsers, partnerOptions } from "@/modules/core/queries";
import { listCategories } from "@/modules/finance/queries";
import { SERVICE_KINDS } from "@/modules/pricing/model";
import { listServices } from "@/modules/pricing/queries";

export const metadata: Metadata = { title: "الإعدادات" };

const kindOptions = Object.entries(SERVICE_KINDS).map(([value, label]) => ({ value, label }));

function PartnerForm({ partner }: { partner?: Partner }) {
  return (
    <ActionForm action={savePartner.bind(null, partner?.id ?? null)} className="grid gap-4 sm:grid-cols-2">
      <TextField label="الاسم" name="name" defaultValue={partner?.name} required />
      <TextField label="المسمّى" name="title" defaultValue={partner?.title} placeholder="الشريك التقني" />
      <NumberField label="الساعات المتاحة أسبوعياً" name="weeklyHours" suffix="س" defaultValue={partner?.weeklyHours ?? 15} hint="القيد الحاكم: ما يمكن الالتزام به فعلاً بجانب الوظيفة." />
      <NumberField
        label="السعر الحقيقي لساعته"
        name="hourlyCost"
        suffix="ر.س"
        defaultValue={partner?.hourlyCost ?? 100}
        hint="كم يكلّف من يقوم بعمله في السوق؟ ليس سعر البيع."
      />
      <NumberField label="حصته من المشاريع المشتركة" name="profitSharePct" suffix="٪" defaultValue={partner?.profitSharePct ?? 50} hint="تُقسم نسبةً وتناسباً بين الشركاء الفعّالين." />
      <div className="self-end pb-2">
        <CheckboxField label="شريك فعّال" name="active" defaultChecked={partner?.active ?? true} />
      </div>
    </ActionForm>
  );
}

function ServiceForm({ service }: { service?: Service }) {
  return (
    <ActionForm action={saveService.bind(null, service?.id ?? null)} className="grid gap-4 sm:grid-cols-2">
      <TextField label="الاسم" name="name" defaultValue={service?.name} className="sm:col-span-2" required />
      <SelectField label="النوع" name="kind" options={kindOptions} defaultValue={service?.kind ?? "service"} />
      <NumberField label="الساعات المعتادة" name="typicalHours" suffix="س" defaultValue={service?.typicalHours || undefined} hint="تُقترح عند اختيارها في الحاسبة." />
      <NumberField
        label="قيمة المنتج الجاهز"
        name="baseValue"
        suffix="ر.س"
        defaultValue={service?.baseValue || undefined}
        className="sm:col-span-2"
        hint="«القيمة الأدنى للمنتج» في قاعدتكم: تُضاف فوق سعر الساعات عند البناء على هذا المنتج."
      />
      <TextAreaField label="الوصف" name="description" defaultValue={service?.description} rows={2} className="sm:col-span-2" />
      <div className="sm:col-span-2">
        <CheckboxField label="متاحة في الحاسبة" name="active" defaultChecked={service?.active ?? true} />
      </div>
    </ActionForm>
  );
}

export default async function SettingsPage() {
  const me = await requireUser();
  const [settings, partners, users, categories, services] = await Promise.all([
    getSettings(),
    listPartners({ includeInactive: true }),
    listUsers(),
    listCategories(),
    listServices({ includeInactive: true }),
  ]);
  const isAdmin = me.role === "admin";
  const partnerById = new Map(partners.map((p) => [p.id, p.name]));
  const individualCompany = 100 - settings.finderPct - settings.executorPct;

  const userForm = (user?: (typeof users)[number]) => (
    <ActionForm action={saveUser.bind(null, user?.id ?? null)} className="grid gap-4 sm:grid-cols-2">
      <TextField label="الاسم" name="name" defaultValue={user?.name} required />
      <TextField label="البريد الإلكتروني" name="email" type="email" dir="ltr" defaultValue={user?.email} required />
      <TextField
        label={user ? "كلمة مرور جديدة" : "كلمة المرور"}
        name="password"
        type="password"
        dir="ltr"
        autoComplete="new-password"
        hint={user ? "اتركها فارغة لإبقاء الحالية." : "8 أحرف على الأقل."}
      />
      <SelectField
        label="الصلاحية"
        name="role"
        defaultValue={user?.role ?? "admin"}
        options={[
          { value: "admin", label: "مدير (كل شيء)" },
          { value: "member", label: "عضو (بلا إعدادات)" },
        ]}
      />
      <SelectField
        label="الشريك المرتبط"
        name="partnerId"
        options={partnerOptions(partners)}
        placeholder="— ليس شريكاً —"
        defaultValue={user?.partnerId ?? ""}
        className="sm:col-span-2"
        hint="يُستخدم كافتراضي لمن دفع المصروف ومن سجّل الساعات."
      />
    </ActionForm>
  );

  return (
    <>
      <PageHeader title="الإعدادات" description="قواعد الشركة المالية والتسعيرية. كل تغيير هنا ينعكس فوراً على الحاسبة والتنبيهات." />
      {!isAdmin && (
        <div className="mb-5">
          <Alert level="info">حسابك بصلاحية عضو: تستطيع تغيير كلمة مرورك وإدارة الفئات والخدمات. بقية الإعدادات للمدير.</Alert>
        </div>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Card title="الشركة والأهداف">
          <ActionForm action={saveSettings.bind(null, "company")} className="grid gap-4 sm:grid-cols-2">
            <TextField label="اسم الشركة" name="companyName" defaultValue={settings.companyName} required />
            <TextField label="رمز العملة" name="currency" defaultValue={settings.currency} required />
            <NumberField label="هدف الإيراد الشهري" name="monthlyRevenueTarget" suffix="ر.س" defaultValue={settings.monthlyRevenueTarget} hint="أدنى إيراد شهري يعني أن الشركة تمشي." />
            <NumberField label="سقف المصروف التشغيلي الشهري" name="monthlyExpenseCap" suffix="ر.س" defaultValue={settings.monthlyExpenseCap} hint="ينبّه النظام عند بلوغ 80٪ منه." />
            <NumberField label="تنبيه تجاوز الساعات المقدّرة" name="hoursOverrunAlertPct" suffix="٪" defaultValue={settings.hoursOverrunAlertPct} />
            <NumberField label="تنبيه تركّز الإيراد في عميل" name="clientConcentrationAlertPct" suffix="٪" defaultValue={settings.clientConcentrationAlertPct} />
          </ActionForm>
        </Card>

        <Card title="توزيع العوائد" description="يُطبَّق على صافي كل مشروع بعد تكاليفه المباشرة">
          <ActionForm action={saveSettings.bind(null, "distribution")} className="grid gap-4 sm:grid-cols-3">
            <NumberField label="خزينة الشركة" name="treasuryPct" suffix="٪" defaultValue={settings.treasuryPct} hint="من المشاريع المشتركة، قبل التوزيع." />
            <NumberField label="جالب المشروع" name="finderPct" suffix="٪" defaultValue={settings.finderPct} hint="في المشروع الفردي." />
            <NumberField label="المنفّذ" name="executorPct" suffix="٪" defaultValue={settings.executorPct} hint="في المشروع الفردي." />
          </ActionForm>
          <p className="mt-4 text-[13px] leading-relaxed text-ink-3">
            المشروع المشترك: {pct(settings.treasuryPct)} للخزينة والباقي بحصص الشركاء. المشروع الفردي: {pct(settings.finderPct)} للجالب، {pct(settings.executorPct)} للمنفّذ،
            و{pct(individualCompany)} للشركة.
          </p>
        </Card>

        <Card className="lg:col-span-2" title="التسعير والسعة" description="مدخلات محرك التسعير">
          <ActionForm action={saveSettings.bind(null, "pricing")} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <NumberField label="هامش الربح المستهدف" name="targetMarginPct" suffix="٪" defaultValue={settings.targetMarginPct} hint="الافتراضي في كل عرض جديد." />
            <NumberField label="الحد الأدنى للهامش" name="minMarginPct" suffix="٪" defaultValue={settings.minMarginPct} hint="تحته يتطلب السعر موافقة الطرفين." />
            <NumberField label="هامش المخاطرة الافتراضي" name="defaultRiskPct" suffix="٪" defaultValue={settings.defaultRiskPct} hint="يُضاف على الساعات المقدّرة." />
            <NumberField label="الدفعة المقدمة" name="downPaymentPct" suffix="٪" defaultValue={settings.downPaymentPct} />
            <NumberField label="أسابيع العمل في السنة" name="workingWeeks" defaultValue={settings.workingWeeks} hint="بعد الإجازات والانقطاعات." />
            <NumberField
              label="نسبة الساعات القابلة للفوترة"
              name="utilizationPct"
              suffix="٪"
              defaultValue={settings.utilizationPct}
              hint="الباقي يذهب للبيع والإدارة وتطوير المنتجات."
            />
            <NumberField label="فتح العداد (القاعدة الحالية)" name="meterOpeningFee" suffix="ر.س" defaultValue={settings.meterOpeningFee} hint="للمقارنة فقط." />
            <NumberField label="سعر ساعة العداد" name="meterHourlyRate" suffix="ر.س" defaultValue={settings.meterHourlyRate} hint="للمقارنة فقط." />
            <NumberField label="صلاحية عرض السعر" name="quoteValidityDays" suffix="يوم" defaultValue={settings.quoteValidityDays} />
            <NumberField label="نسبة ضريبة القيمة المضافة" name="vatPct" suffix="٪" defaultValue={settings.vatPct} />
            <div className="self-end pb-2 sm:col-span-2">
              <CheckboxField label="إضافة الضريبة في عروض الأسعار" name="vatEnabled" defaultChecked={settings.vatEnabled} hint="فعّلها بعد التسجيل الضريبي فقط." />
            </div>
            <TextAreaField label="شروط عرض السعر" name="quoteTerms" defaultValue={settings.quoteTerms} rows={3} className="sm:col-span-2 lg:col-span-4" hint="تظهر في نسخة العميل." />
          </ActionForm>
        </Card>

        <Card
          flush
          title="الشركاء"
          description="الطاقة وسعر الوقت والحصص"
          actions={
            isAdmin && (
              <Modal trigger={<><Plus size={15} /> شريك</>} triggerClassName="btn btn-secondary btn-sm" title="شريك جديد" wide>
                <PartnerForm />
              </Modal>
            )
          }
        >
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>الشريك</th>
                  <th className="cell-num">ساعات/أسبوع</th>
                  <th className="cell-num">سعر ساعته</th>
                  <th className="cell-num">الحصة</th>
                  <th className="cell-actions" />
                </tr>
              </thead>
              <tbody>
                {partners.map((p) => (
                  <tr key={p.id} className={p.active ? "" : "opacity-55"}>
                    <td>
                      <span className="font-medium">{p.name}</span>
                      <span className="block text-xs text-ink-3">{p.title || "شريك"}{!p.active && " · غير فعّال"}</span>
                    </td>
                    <td className="cell-num">{hours(p.weeklyHours)}</td>
                    <td className="cell-num">{money(p.hourlyCost, { digits: 0 })}</td>
                    <td className="cell-num">{pct(p.profitSharePct)}</td>
                    <td className="cell-actions">
                      {isAdmin && (
                        <Modal trigger={<Pencil size={15} />} triggerClassName="btn btn-ghost btn-icon text-ink-3" triggerLabel="تعديل" title={`تعديل ${p.name}`} wide>
                          <PartnerForm partner={p} />
                        </Modal>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card
          flush
          title="المستخدمون"
          description="من يدخل النظام"
          actions={
            isAdmin && (
              <Modal trigger={<><Plus size={15} /> مستخدم</>} triggerClassName="btn btn-secondary btn-sm" title="مستخدم جديد" wide>
                {userForm()}
              </Modal>
            )
          }
        >
          <div className="table-wrap">
            <table className="table">
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <span className="font-medium">{u.name}</span>
                      {u.id === me.id && <span className="ms-2"><Badge tone="primary">أنت</Badge></span>}
                      <span className="block text-xs text-ink-3" dir="ltr" style={{ textAlign: "start" }}>{u.email}</span>
                    </td>
                    <td className="text-ink-2">{u.partnerId ? partnerById.get(u.partnerId) : "—"}</td>
                    <td><Badge>{u.role === "admin" ? "مدير" : "عضو"}</Badge></td>
                    <td className="cell-actions">
                      {isAdmin && (
                        <div className="flex items-center">
                          <Modal trigger={<Pencil size={15} />} triggerClassName="btn btn-ghost btn-icon text-ink-3" triggerLabel="تعديل" title={`تعديل ${u.name}`} wide>
                            {userForm(u)}
                          </Modal>
                          {u.id !== me.id && <DeleteButton action={deleteUser.bind(null, u.id)} confirm={`حذف حساب ${u.name}؟`} />}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card
          className="lg:col-span-2"
          flush
          title="كتالوج الخدمات والمنتجات"
          description="ما يظهر في حاسبة التسعير"
          actions={
            <Modal trigger={<><Plus size={15} /> خدمة</>} triggerClassName="btn btn-secondary btn-sm" title="خدمة أو منتج جديد" wide>
              <ServiceForm />
            </Modal>
          }
        >
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>الاسم</th>
                  <th>النوع</th>
                  <th className="cell-num">ساعات معتادة</th>
                  <th className="cell-num">قيمة المنتج</th>
                  <th className="cell-actions" />
                </tr>
              </thead>
              <tbody>
                {services.map((s) => (
                  <tr key={s.id} className={s.active ? "" : "opacity-55"}>
                    <td className="min-w-56">
                      <span className="font-medium">{s.name}</span>
                      {s.description && <span className="block text-xs text-ink-3">{s.description}</span>}
                    </td>
                    <td><Badge tone={s.kind === "product" ? "primary" : s.kind === "consulting" ? "info" : "neutral"}>{SERVICE_KINDS[s.kind]}</Badge></td>
                    <td className="cell-num text-ink-2">{s.typicalHours > 0 ? hours(s.typicalHours) : "—"}</td>
                    <td className="cell-num">{s.baseValue > 0 ? money(s.baseValue, { digits: 0 }) : <span className="text-ink-3">—</span>}</td>
                    <td className="cell-actions">
                      <div className="flex items-center">
                        <Modal trigger={<Pencil size={15} />} triggerClassName="btn btn-ghost btn-icon text-ink-3" triggerLabel="تعديل" title="تعديل خدمة" wide>
                          <ServiceForm service={s} />
                        </Modal>
                        {isAdmin && <DeleteButton action={deleteService.bind(null, s.id)} confirm={`حذف «${s.name}» من الكتالوج؟`} />}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card
          title="فئات المصروف"
          actions={
            <Modal trigger={<><Plus size={15} /> فئة</>} triggerClassName="btn btn-secondary btn-sm" title="فئة مصروف جديدة">
              <ActionForm action={saveCategory.bind(null, null)}>
                <TextField label="اسم الفئة" name="name" autoFocus required />
              </ActionForm>
            </Modal>
          }
        >
          <ul className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <li key={c.id} className="flex items-center gap-0.5 rounded-full border border-line py-0.5 ps-3 pe-1 text-[13px]">
                {c.name}
                <Modal trigger={<Pencil size={12} />} triggerClassName="btn btn-ghost size-6 rounded-full p-0 text-ink-3" triggerLabel={`تعديل ${c.name}`} title="تعديل فئة">
                  <ActionForm action={saveCategory.bind(null, c.id)} secondary={isAdmin ? <DeleteButton action={deleteCategory.bind(null, c.id)} confirm={`حذف فئة «${c.name}»؟ مصروفاتها تبقى بلا فئة.`} /> : undefined}>
                    <TextField label="اسم الفئة" name="name" defaultValue={c.name} required />
                  </ActionForm>
                </Modal>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="كلمة المرور" description="لحسابك الحالي">
          <ActionForm action={changePassword} submitLabel="تغيير كلمة المرور" className="grid gap-4 sm:grid-cols-2">
            <TextField label="الحالية" name="current" type="password" dir="ltr" autoComplete="current-password" required />
            <TextField label="الجديدة" name="next" type="password" dir="ltr" autoComplete="new-password" hint="8 أحرف على الأقل." required />
          </ActionForm>
        </Card>

        {isAdmin && (
          <Card className="border-danger/30 lg:col-span-2" title="تصفير البيانات" description="لحذف البيانات التجريبية والبدء ببيانات حقيقية">
            <p className="mb-4 text-sm leading-relaxed text-ink-2">
              يحذف نهائياً كل الحركات: المصروفات، الإيرادات، التحويلات، المشاريع وساعاتها، عروض الأسعار، العملاء، والتكاليف المتكررة. تبقى الإعدادات والشركاء
              والمستخدمون والفئات والكتالوج. <strong>لا يمكن التراجع.</strong>
            </p>
            <ActionForm action={resetOperationalData} submitLabel="حذف كل الحركات" className="max-w-xs">
              <TextField label="اكتب كلمة «تصفير» للتأكيد" name="confirm" />
            </ActionForm>
          </Card>
        )}
      </div>
    </>
  );
}
