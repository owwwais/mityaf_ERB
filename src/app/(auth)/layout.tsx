import { Logo } from "@/components/ui";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="mb-6 flex items-center gap-3">
        <Logo size={40} />
        <div className="leading-tight">
          <p className="text-2xl font-bold">مطياف</p>
          <p className="text-[13px] text-ink-3">نظام إدارة الموارد</p>
        </div>
      </div>
      <div className="card w-full max-w-md overflow-hidden">
        <div className="h-1" style={{ background: "var(--spectrum)" }} aria-hidden />
        <div className="p-6 sm:p-7">{children}</div>
      </div>
    </div>
  );
}
