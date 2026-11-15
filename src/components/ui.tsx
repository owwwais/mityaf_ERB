import Link from "next/link";
import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, OctagonAlert } from "lucide-react";

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
      <div className="min-w-0">
        <h1 className="text-[22px] font-bold tracking-tight">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-ink-2">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Card({
  title,
  description,
  actions,
  children,
  className,
  flush,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /** بلا حشوة داخلية (للجداول). */
  flush?: boolean;
}) {
  return (
    <section className={cx("card", className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold">{title}</h2>
            {description && <p className="mt-0.5 text-[13px] text-ink-3">{description}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={flush ? "" : "p-5"}>{children}</div>
    </section>
  );
}

export type Tone = "neutral" | "primary" | "success" | "warning" | "danger" | "info";

const toneClass: Record<Tone, string> = {
  neutral: "bg-surface-2 text-ink-2",
  primary: "bg-primary-soft text-primary-ink",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={cx("inline-flex h-6 items-center rounded-[5px] px-2 text-xs font-medium whitespace-nowrap", toneClass[tone])}>
      {children}
    </span>
  );
}

/** بطاقة رقم رئيسي. */
export function Stat({
  label,
  value,
  hint,
  tone,
  children,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "success" | "danger" | "warning";
  children?: ReactNode;
}) {
  const color = tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : "text-ink";
  return (
    <div className="card p-5">
      <p className="text-[13px] font-medium text-ink-3">{label}</p>
      <p className={cx("mt-1.5 text-2xl font-bold tracking-tight", color)}>{value}</p>
      {hint && <p className="mt-1 text-[13px] text-ink-3">{hint}</p>}
      {children}
    </div>
  );
}

const alertStyle = {
  info: { cls: "border-info/25 bg-info-soft text-info", Icon: Info },
  success: { cls: "border-success/25 bg-success-soft text-success", Icon: CheckCircle2 },
  warning: { cls: "border-warning/30 bg-warning-soft text-warning", Icon: AlertTriangle },
  danger: { cls: "border-danger/30 bg-danger-soft text-danger", Icon: OctagonAlert },
} as const;

export function Alert({ level = "info", title, children }: { level?: keyof typeof alertStyle; title?: ReactNode; children?: ReactNode }) {
  const { cls, Icon } = alertStyle[level];
  return (
    <div className={cx("flex gap-2.5 rounded-sm border px-3.5 py-2.5 text-[13.5px] leading-relaxed", cls)} role={level === "danger" ? "alert" : "status"}>
      <Icon size={17} className="mt-[3px] shrink-0" aria-hidden />
      <div className="min-w-0 flex-1 text-ink">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? "text-ink-2" : ""}>{children}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      {icon && <div className="mb-3 flex size-11 items-center justify-center rounded-full bg-surface-2 text-ink-3">{icon}</div>}
      <p className="font-semibold">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-ink-3">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** سطر «تسمية: قيمة» للملخصات. */
export function Row({ label, value, strong, muted }: { label: ReactNode; value: ReactNode; strong?: boolean; muted?: boolean }) {
  return (
    <div className={cx("flex items-baseline justify-between gap-4 py-1.5 text-sm", strong && "font-semibold", muted && "text-ink-3")}>
      <span className={strong ? "" : "text-ink-2"}>{label}</span>
      <span className="text-end whitespace-nowrap">{value}</span>
    </div>
  );
}

/**
 * شعار مطياف الأصلي (العلامة + الاسم). النسخة الفاتحة تُستخدم تلقائياً في الوضع الداكن،
 * إلا إذا طُلبت النسخة الداكنة دائماً (للمستندات المطبوعة).
 */
export function BrandLogo({ height = 30, alwaysLight }: { height?: number; alwaysLight?: boolean }) {
  // نسبة أبعاد الشعار الأساسي ≈ 3.87 : 1
  const width = Math.round(height * 3.87);
  return (
    <picture>
      {!alwaysLight && <source srcSet="/brand/primary-ar-white.svg" media="(prefers-color-scheme: dark)" />}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/primary-ar.svg" alt="مطياف" width={width} height={height} style={{ height, width: "auto" }} />
    </picture>
  );
}

/** شريط الأطياف الأربعة: أعمال، شفرة، برامج، عدسة. */
export function SpectrumBar({ className = "h-1" }: { className?: string }) {
  return <div className={className} style={{ background: "var(--spectrum)" }} aria-hidden />;
}

export function Tabs({ items, current }: { items: { href: string; label: string }[]; current: string }) {
  return (
    <nav className="mb-5 flex gap-1 overflow-x-auto border-b border-line" aria-label="أقسام الصفحة">
      {items.map((item) => {
        const active = item.href === current;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cx(
              "-mb-px border-b-2 px-3.5 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors",
              active ? "border-ink-strong text-ink-strong" : "border-transparent text-ink-3 hover:text-ink",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
