import { ActionForm, DateField, NumberField, SelectField, TextAreaField, TextField, type Option } from "@/components/form";
import { saveProject, saveTimeLog } from "../actions";
import { BILLING, PROJECT_STATUSES, PROJECT_TYPES } from "../constants";

type ProjectValues = {
  id: string;
  name: string;
  clientId: string | null;
  type: string;
  billing: string;
  finderId: string | null;
  executorId: string | null;
  status: string;
  price: number;
  estimatedHours: number;
  startDate: string | null;
  dueDate: string | null;
  notes: string;
};

const statusOptions = Object.entries(PROJECT_STATUSES).map(([value, s]) => ({ value, label: s.label }));
const toOptions = (map: Record<string, string>) => Object.entries(map).map(([value, label]) => ({ value, label }));

export function ProjectForm({ project, clients, partners, today }: { project?: ProjectValues; clients: Option[]; partners: Option[]; today: string }) {
  return (
    <ActionForm action={saveProject.bind(null, project?.id ?? null)} className="grid gap-4 sm:grid-cols-2">
      <TextField label="اسم المشروع" name="name" defaultValue={project?.name} className="sm:col-span-2" autoFocus={!project} required />
      <SelectField label="العميل" name="clientId" options={clients} placeholder="— بلا عميل —" defaultValue={project?.clientId ?? ""} />
      <SelectField label="الحالة" name="status" options={statusOptions} defaultValue={project?.status ?? "active"} />
      <NumberField label="السعر المتفق عليه" name="price" suffix="ر.س" defaultValue={project?.price} hint="للباقة الشهرية: قيمة الشهر." />
      <NumberField label="الساعات المقدّرة" name="estimatedHours" suffix="س" defaultValue={project?.estimatedHours} hint="للباقة الشهرية: ساعات الشهر." />
      <SelectField label="الفوترة" name="billing" options={toOptions(BILLING)} defaultValue={project?.billing ?? "one_time"} />
      <SelectField
        label="توزيع العائد"
        name="type"
        options={toOptions(PROJECT_TYPES)}
        defaultValue={project?.type ?? "joint"}
        hint="مشترك: يُقسم بحصص الشركاء. فردي: جالب + منفّذ + الشركة."
      />
      <SelectField label="جالب المشروع" name="finderId" options={partners} placeholder="— لا أحد —" defaultValue={project?.finderId ?? ""} hint="للمشروع الفردي فقط." />
      <SelectField label="المنفّذ" name="executorId" options={partners} placeholder="— لا أحد —" defaultValue={project?.executorId ?? ""} hint="للمشروع الفردي فقط." />
      <DateField label="تاريخ البدء" name="startDate" defaultValue={project?.startDate ?? today} />
      <DateField label="موعد التسليم" name="dueDate" defaultValue={project?.dueDate ?? ""} />
      <TextAreaField label="ملاحظات" name="notes" defaultValue={project?.notes} rows={2} className="sm:col-span-2" />
    </ActionForm>
  );
}

export function TimeLogForm({ projectId, partners, myPartnerId, today }: { projectId: string; partners: Option[]; myPartnerId: string | null; today: string }) {
  return (
    <ActionForm action={saveTimeLog} submitLabel="تسجيل الساعات" keepOpen className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="projectId" value={projectId} />
      <NumberField label="الساعات" name="hours" suffix="س" autoFocus required />
      <DateField label="التاريخ" name="date" defaultValue={today} max={today} required />
      <SelectField label="الشريك" name="partnerId" options={partners} defaultValue={myPartnerId ?? partners[0]?.value} />
      <TextField label="ماذا أُنجز؟" name="note" />
    </ActionForm>
  );
}
