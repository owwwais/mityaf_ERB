"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { LogOut, Menu, X } from "lucide-react";
import { GROUP_LABELS, MODULES, type ModuleGroup } from "@/modules/registry";
import { Logo, cx } from "./ui";

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
            {GROUP_LABELS[group] && <p className="mb-1.5 px-3 text-[11px] font-semibold tracking-wide text-white/40">{GROUP_LABELS[group]}</p>}
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
                        "relative flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                        active ? "bg-white/10 text-white" : "text-[var(--sidebar-text)] hover:bg-white/5 hover:text-white",
                      )}
                    >
                      {active && <span className="absolute inset-y-2 start-0 w-[3px] rounded-full" style={{ background: "var(--spectrum)" }} aria-hidden />}
                      <Icon size={18} strokeWidth={1.9} aria-hidden />
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
    <Link href="/" className="flex h-16 shrink-0 items-center gap-2.5 px-5 text-white">
      <Logo size={30} />
      <span className="leading-tight">
        <span className="block text-[17px] font-bold">{company}</span>
        <span className="block text-[11px] text-white/45">نظام إدارة الموارد</span>
      </span>
    </Link>
  );
}

function UserBox({ name, logout }: { name: string; logout: () => Promise<void> }) {
  return (
    <div className="flex shrink-0 items-center gap-3 border-t border-white/10 px-4 py-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-sm font-bold text-white" aria-hidden>
        {name.trim().charAt(0) || "؟"}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-white">{name}</span>
      <form action={logout}>
        <button type="submit" className="flex size-9 items-center justify-center rounded-lg text-[var(--sidebar-text)] hover:bg-white/10 hover:text-white" aria-label="تسجيل الخروج" title="تسجيل الخروج">
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
      <aside className="no-print fixed inset-y-0 start-0 z-30 hidden w-64 flex-col bg-sidebar lg:flex">
        <Brand company={company} />
        <Nav />
        <UserBox name={userName} logout={logout} />
      </aside>

      {/* Mobile top bar */}
      <header className="no-print sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur lg:hidden">
        <button type="button" className="btn btn-ghost btn-icon -ms-1.5" onClick={() => setOpen(true)} aria-label="فتح القائمة">
          <Menu size={20} />
        </button>
        <Logo size={24} />
        <span className="truncate font-bold">{current?.label ?? company}</span>
      </header>

      {/* Mobile drawer */}
      {open && (
        <div className="no-print fixed inset-0 z-40 lg:hidden">
          <button type="button" className="absolute inset-0 bg-black/55" aria-label="إغلاق القائمة" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 start-0 flex w-72 max-w-[85vw] flex-col bg-sidebar shadow-pop">
            <div className="flex items-center justify-between pe-3">
              <Brand company={company} />
              <button type="button" className="flex size-9 items-center justify-center rounded-lg text-white/70 hover:bg-white/10" onClick={() => setOpen(false)} aria-label="إغلاق القائمة">
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
