import { BrandLogo, SpectrumBar } from "@/components/ui";

// Every page reads live data for the signed-in user: never prerender at build time.
export const dynamic = "force-dynamic";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dot-grid flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="mb-7 flex flex-col items-center gap-2">
        <BrandLogo height={46} />
        <p className="eyebrow">نظام إدارة الموارد</p>
      </div>
      <div className="card w-full max-w-md overflow-hidden rounded-lg shadow-pop">
        <SpectrumBar />
        <div className="p-6 sm:p-7">{children}</div>
      </div>
    </div>
  );
}
