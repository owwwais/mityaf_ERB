import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ActionForm, TextField } from "@/components/form";
import { getCurrentUser, hasAnyUser } from "@/lib/auth";
import { loginAction } from "@/modules/core/actions";

export const metadata: Metadata = { title: "تسجيل الدخول" };

export default async function LoginPage() {
  if (!(await hasAnyUser())) redirect("/setup");
  if (await getCurrentUser()) redirect("/");
  return (
    <>
      <h1 className="text-xl font-bold">تسجيل الدخول</h1>
      <p className="mt-1 mb-5 text-sm text-ink-3">أدخل بريدك وكلمة المرور للمتابعة.</p>
      <ActionForm action={loginAction} submitLabel="دخول" className="space-y-4">
        <TextField label="البريد الإلكتروني" name="email" type="email" dir="ltr" autoComplete="email" required autoFocus />
        <TextField label="كلمة المرور" name="password" type="password" dir="ltr" autoComplete="current-password" required />
      </ActionForm>
    </>
  );
}
