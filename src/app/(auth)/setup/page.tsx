import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ActionForm, CheckboxField, SelectField, TextField } from "@/components/form";
import { hasAnyUser } from "@/lib/auth";
import { setupAction } from "@/modules/core/actions";

export const metadata: Metadata = { title: "الإعداد الأولي" };

export default async function SetupPage() {
  if (await hasAnyUser()) redirect("/login");
  return (
    <>
      <h1 className="text-xl font-bold">أهلاً بك في مطياف</h1>
      <p className="mt-1 mb-5 text-sm leading-relaxed text-ink-3">
        دقيقة واحدة لإنشاء حساب المدير وتعريف الشريكين. كل ما تدخله هنا يمكن تعديله لاحقاً من الإعدادات.
      </p>
      <ActionForm action={setupAction} submitLabel="إنشاء الحساب والبدء" className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="اسمك" name="name" required autoFocus />
          <SelectField
            label="دورك"
            name="role"
            options={[
              { value: "technical", label: "الشريك التقني" },
              { value: "commercial", label: "الشريك التجاري" },
            ]}
          />
        </div>
        <TextField label="اسم شريكك" name="partnerName" required hint="يُضاف كشريك ثانٍ. تنشئ له حساب دخول لاحقاً من الإعدادات." />
        <TextField label="البريد الإلكتروني" name="email" type="email" dir="ltr" autoComplete="email" required />
        <TextField label="كلمة المرور" name="password" type="password" dir="ltr" autoComplete="new-password" required hint="8 أحرف على الأقل." />
        <CheckboxField
          label="أضف بيانات تجريبية للاستكشاف"
          name="demo"
          hint="عملاء ومشاريع ومصروفات وهمية لترى النظام ممتلئاً. تُحذف بضغطة من الإعدادات ← تصفير البيانات."
        />
      </ActionForm>
    </>
  );
}
