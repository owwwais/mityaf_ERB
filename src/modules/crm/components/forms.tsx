import { ActionForm, DateField, NumberField, SelectField, TextAreaField, TextField } from "@/components/form";
import type { Client } from "@/db/schema";
import { saveClient } from "../actions";
import { SOURCES, STAGES } from "../constants";

const stageOptions = Object.entries(STAGES).map(([value, s]) => ({ value, label: s.label }));
const sourceOptions = Object.entries(SOURCES).map(([value, label]) => ({ value, label }));

export function ClientForm({ client }: { client?: Client }) {
  return (
    <ActionForm action={saveClient.bind(null, client?.id ?? null)} className="grid gap-4 sm:grid-cols-2">
      <TextField label="العميل / الجهة" name="name" defaultValue={client?.name} className="sm:col-span-2" autoFocus={!client} required />
      <SelectField label="مرحلة البيع" name="stage" options={stageOptions} defaultValue={client?.stage ?? "new"} />
      <SelectField label="المصدر" name="source" options={sourceOptions} defaultValue={client?.source ?? "direct"} />
      <TextField label="اسم جهة الاتصال" name="contactName" defaultValue={client?.contactName} />
      <TextField label="القطاع" name="sector" defaultValue={client?.sector} placeholder="عقار، مطاعم، استشارات…" />
      <TextField label="الهاتف" name="phone" type="tel" dir="ltr" defaultValue={client?.phone} />
      <TextField label="البريد" name="email" type="email" dir="ltr" defaultValue={client?.email} />
      <TextField label="المنتج أو الخدمة المهتم بها" name="interest" defaultValue={client?.interest} />
      <NumberField label="القيمة المتوقعة" name="expectedValue" suffix="ر.س" defaultValue={client?.expectedValue || undefined} />
      <TextAreaField
        label="الاحتياج / المشكلة"
        name="need"
        defaultValue={client?.need}
        rows={2}
        className="sm:col-span-2"
        hint="ما أكّده العميل بنفسه، لا ما نفترضه."
      />
      <TextField label="الخطوة التالية" name="nextStep" defaultValue={client?.nextStep} />
      <DateField label="موعد المتابعة" name="followUpDate" defaultValue={client?.followUpDate ?? ""} />
      <TextAreaField label="ملاحظات" name="notes" defaultValue={client?.notes} rows={2} className="sm:col-span-2" />
    </ActionForm>
  );
}
