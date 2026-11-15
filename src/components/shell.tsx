"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { LogOut, Menu, X } from "lucide-react";
import { GROUP_LABELS, MODULES, type ModuleGroup } from "@/modules/registry";
import { BrandLogo, cx } from "./ui";

const GROUPS: ModuleGroup[] = ["main", "finance", "work", "system"];

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function Nav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4" aria-label="التنقل الرئيسي">
      {GROUPS.map((group) => {
        const items = MODULES.filter((m) => m.group === group);
        if (!items.length) return null;
        return (
          <div key={group}>
            {GROUP_LABELS[group] && <p className="eyebrow mb-1.5 px-3">{GROUP_LABELS[group]}</p>}
            <ul className="space-y-0.5">
              {items.map((m) => {
                const active = isActive(pathname, m.href);
                const Icon = m.icon;
                return (
                  <li key={m.id}>
                    <Link
                      href={m.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={cx(
                        "flex h-10 items-center gap-3 rounded-sm px-3 text-[14.5px] transition-colors",
                        // العنصر النشط خانة داكنة مصمتة، كزر الدعوة في ترويسة الموقع
                        active ? "bg-primary font-semibold text-primary-fg" : "font-medium text-ink-2 hover:bg-surface-2 hover:text-ink-strong",
                      )}
                    >
                      <Icon size={18} strokeWidth={1.8} aria-hidden />
                      {m.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

function Brand({ company }: { company: string }) {
  return (
    <Link href="/" className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-line px-5" aria-label={company}>
      <BrandLogo height={27} />
      <span className="eyebrow" dir="ltr">
        ERP
      </span>
    </Link>
  );
}

function UserBox({ name, logout }: { name: string; logout: () => Promise<void> }) {
  return (
    <div className="flex shrink-0 items-center gap-3 border-t border-line px-4 py-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-sm bg-surface-2 text-sm font-bold text-ink-strong" aria-hidden>
        {name.trim().charAt(0) || "؟"}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{name}</span>
      <form action={logout}>
        <button type="submit" className="btn btn-ghost btn-icon size-9" aria-label="تسجيل الخروج" title="تسجيل الخروج">
          <LogOut size={17} className="-scale-x-100" />
        </button>
      </form>
    </div>
  );
}

export function AppShell({
  company,
  userName,
  logout,
  children,
}: {
  company: string;
  userName: string;
  logout: () => Promise<void>;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const current = MODULES.find((m) => isActive(pathname, m.href));

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="min-h-dvh lg:ps-64">
      {/* Desktop sidebar */}
      <aside className="no-print fixed inset-y-0 start-0 z-30 hidden w-64 flex-col border-e border-line bg-surface lg:flex">
        <Brand company={company} />
        <Nav />
        <UserBox name={userName} logout={logout} />
      </aside>

      {/* Mobile top bar */}
      <header className="no-print sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur lg:hidden">
        <button type="button" className="btn btn-ghost btn-icon -ms-1.5" onClick={() => setOpen(true)} aria-label="فتح القائمة">
          <Menu size={20} />
        </button>
        <BrandLogo height={22} />
        {current && <span className="truncate border-s border-line ps-3 text-sm text-ink-2">{current.label}</span>}
      </header>

      {/* Mobile drawer */}
      {open && (
        <div className="no-print fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-[#111514]/50" onClick={() => setOpen(false)} aria-hidden />
          <aside className="absolute inset-y-0 start-0 flex w-72 max-w-[85vw] flex-col border-e border-line bg-surface shadow-pop">
            <div className="relative">
              <Brand company={company} />
              <button type="button" className="btn btn-ghost btn-icon absolute inset-y-0 end-3 my-auto size-9 bg-surface" onClick={() => setOpen(false)} aria-label="إغلاق القائمة">
                <X size={19} />
              </button>
            </div>
            <Nav onNavigate={() => setOpen(false)} />
            <UserBox name={userName} logout={logout} />
          </aside>
        </div>
      )}

      <main className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
    </div>
  );
}
