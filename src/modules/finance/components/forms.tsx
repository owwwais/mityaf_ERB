import { ActionForm, CheckboxField, DateField, NumberField, SelectField, TextAreaField, TextField, type Option } from "@/components/form";
import { saveExpense, saveOperatingCost, savePayment, saveTransfer } from "../actions";
import { CYCLES, METHODS, PAYMENT_KINDS, TREASURY_LABEL, toOptions } from "../constants";

const cycleOptions = Object.entries(CYCLES).map(([value, c]) => ({ value, label: c.label }));

export type FormLookups = {
  categories: Option[];
  projects: Option[];
  partners: Option[];
  clients?: Option[];
  /** شريك المستخدم الحالي: الافتراضي لمن دفع أو استلم. */
  myPartnerId: string | null;
  today: string;
};

type ExpenseValues = {
  id: string;
  date: string;
  amount: number;
  description: string;
  categoryId: string | null;
  vendor: string;
  projectId: string | null;
  paidBy: string | null;
  method: string;
  notes: string;
};

export function ExpenseForm({ expense, lookups, projectId }: { expense?: ExpenseValues; lookups: FormLookups; projectId?: string }) {
  return (
    <ActionForm action={saveExpense.bind(null, expense?.id ?? null)} submitLabel={expense ? "حفظ التعديل" : "تسجيل المصروف"} className="grid gap-4 sm:grid-cols-2">
      <NumberField label="المبلغ" name="amount" suffix="ر.س" defaultValue={expense?.amount} autoFocus={!expense} required />
      <DateField label="التاريخ" name="date" defaultValue={expense?.date ?? lookups.today} max={lookups.today} required />
      <TextField label="الوصف" name="description" defaultValue={expense?.description} placeholder="مثال: تجديد الاستضافة" className="sm:col-span-2" required />
      <SelectField label="الفئة" name="categoryId" options={lookups.categories} placeholder="بلا فئة" defaultValue={expense?.categoryId ?? ""} />
      <SelectField
        label="دُفع من"
        name="paidBy"
        options={lookups.partners}
        placeholder={TREASURY_LABEL}
        defaultValue={expense ? (expense.paidBy ?? "") : (lookups.myPartnerId ?? "")}
        hint="من دفع من جيبه يُحتسب له في التسوية."
      />
      <SelectField
        label="المشروع"
        name="projectId"
        options={lookups.projects}
        placeholder="مصروف تشغيلي عام"
        defaultValue={expense?.projectId ?? projectId ?? ""}
        hint="اختر مشروعاً إن كان تكلفة مباشرة عليه."
      />
      <SelectField label="طريقة الدفع" name="method" options={toOptions(METHODS)} defaultValue={expense?.method ?? "transfer"} />
      <TextField label="المورّد" name="vendor" defaultValue={expense?.vendor} className="sm:col-span-2" />
      <TextAreaField label="ملاحظات" name="notes" defaultValue={expense?.notes} rows={2} className="sm:col-span-2" />
    </ActionForm>
  );
}

type OperatingCostValues = { id: string; name: string; categoryId: string | null; amount: number; cycle: string; active: boolean; notes: string };

export function OperatingCostForm({ cost, categories }: { cost?: OperatingCostValues; categories: Option[] }) {
  return (
    <ActionForm action={saveOperatingCost.bind(null, cost?.id ?? null)} className="grid gap-4 sm:grid-cols-2">
      <TextField label="البند" name="name" defaultValue={cost?.name} placeholder="مثال: استضافة المنصات" className="sm:col-span-2" autoFocus={!cost} required />
      <NumberField label="المبلغ لكل دورة" name="amount" suffix="ر.س" defaultValue={cost?.amount} required />
      <SelectField label="الدورة" name="cycle" options={cycleOptions} defaultValue={cost?.cycle ?? "monthly"} />
      <SelectField label="الفئة" name="categoryId" options={categories} placeholder="بلا فئة" defaultValue={cost?.categoryId ?? ""} className="sm:col-span-2" />
      <TextAreaField label="ملاحظات" name="notes" defaultValue={cost?.notes} rows={2} className="sm:col-span-2" />
      <div className="sm:col-span-2">
        <CheckboxField label="بند فعّال" name="active" defaultChecked={cost?.active ?? true} hint="البنود الموقوفة لا تدخل في التكاليف السنوية ولا في التسعير." />
      </div>
    </ActionForm>
  );
}

type PaymentValues = {
  id: string;
  date: string;
  amount: number;
  projectId: string | null;
  clientId: string | null;
  kind: string;
  receivedBy: string | null;
  method: string;
  notes: string;
};

export function PaymentForm({ payment, lookups, projectId }: { payment?: PaymentValues; lookups: FormLookups; projectId?: string }) {
  const fixedProject = projectId ?? null;
  return (
    <ActionForm action={savePayment.bind(null, payment?.id ?? null)} submitLabel={payment ? "حفظ التعديل" : "تسجيل الدفعة"} className="grid gap-4 sm:grid-cols-2">
      <NumberField label="المبلغ المستلم" name="amount" suffix="ر.س" defaultValue={payment?.amount} autoFocus={!payment} required />
      <DateField label="تاريخ الاستلام" name="date" defaultValue={payment?.date ?? lookups.today} max={lookups.today} required />
      <SelectField
        label="المشروع"
        name="projectId"
        options={lookups.projects}
        placeholder="إيراد عام (بلا مشروع)"
        defaultValue={payment?.projectId ?? fixedProject ?? ""}
        hint="الإيراد العام يذهب كاملاً لخزينة الشركة."
      />
      <SelectField label="نوع الدفعة" name="kind" options={toOptions(PAYMENT_KINDS)} defaultValue={payment?.kind ?? "down_payment"} />
      <SelectField
        label="استلمها"
        name="receivedBy"
        options={lookups.partners}
        placeholder={TREASURY_LABEL}
        defaultValue={payment ? (payment.receivedBy ?? "") : (lookups.myPartnerId ?? "")}
        hint="من استلم في حسابه الشخصي يُحتسب عليه في التسوية."
      />
      <SelectField label="طريقة الدفع" name="method" options={toOptions(METHODS)} defaultValue={payment?.method ?? "transfer"} />
      {lookups.clients && !fixedProject && (
        <SelectField
          label="العميل"
          name="clientId"
          options={lookups.clients}
          placeholder="—"
          defaultValue={payment?.clientId ?? ""}
          hint="يُؤخذ من المشروع تلقائياً إن اختير مشروع."
          className="sm:col-span-2"
        />
      )}
      <TextAreaField label="ملاحظات" name="notes" defaultValue={payment?.notes} rows={2} className="sm:col-span-2" />
    </ActionForm>
  );
}

export function TransferForm({
  partners,
  today,
  preset,
}: {
  partners: Option[];
  today: string;
  preset?: { from: string | null; to: string | null; amount: number };
}) {
  return (
    <ActionForm action={saveTransfer} submitLabel="تسجيل التحويل" className="grid gap-4 sm:grid-cols-2">
      <SelectField label="من" name="fromPartnerId" options={partners} placeholder={TREASURY_LABEL} defaultValue={preset?.from ?? ""} />
      <SelectField label="إلى" name="toPartnerId" options={partners} placeholder={TREASURY_LABEL} defaultValue={preset?.to ?? ""} />
      <NumberField label="المبلغ" name="amount" suffix="ر.س" defaultValue={preset?.amount} required />
      <DateField label="التاريخ" name="date" defaultValue={today} max={today} required />
      <TextField label="ملاحظات" name="notes" className="sm:col-span-2" />
    </ActionForm>
  );
}
