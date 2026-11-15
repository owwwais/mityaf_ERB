"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { monthLabel, shiftMonth } from "@/lib/format";
import type { Option } from "./form";
import { cx } from "./ui";

function useQueryNav() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, startTransition] = useTransition();
  const hrefWith = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v == null || v === "") next.delete(k);
      else next.set(k, v);
    }
    const qs = next.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };
  const set = (patch: Record<string, string | null>) => startTransition(() => router.replace(hrefWith(patch), { scroll: false }));
  return { params, pending, set, hrefWith };
}

/** تنقّل بين الأشهر: السابق ← الشهر الحالي → التالي. */
export function MonthNav({ month, current }: { month: string; current: string }) {
  const { hrefWith } = useQueryNav();
  return (
    <div className="flex items-center gap-1">
      <Link href={hrefWith({ month: shiftMonth(month, -1) })} className="btn btn-secondary btn-icon" aria-label="الشهر السابق" scroll={false}>
        <ChevronRight size={17} />
      </Link>
      <span className="min-w-32 text-center text-sm font-semibold">{monthLabel(month)}</span>
      <Link
        href={hrefWith({ month: shiftMonth(month, 1) })}
        className={cx("btn btn-secondary btn-icon", month >= current && "pointer-events-none opacity-40")}
        aria-label="الشهر التالي"
        aria-disabled={month >= current}
        scroll={false}
      >
        <ChevronLeft size={17} />
      </Link>
      {month !== current && (
        <Link href={hrefWith({ month: null })} className="btn btn-ghost btn-sm" scroll={false}>
          هذا الشهر
        </Link>
      )}
    </div>
  );
}

/** قائمة منسدلة تكتب قيمتها في رابط الصفحة فور التغيير. */
export function SelectFilter({ name, label, options, allLabel }: { name: string; label: string; options: Option[]; allLabel: string }) {
  const { params, set } = useQueryNav();
  return (
    <select aria-label={label} className="input input-sm w-auto min-w-36" value={params.get(name) ?? ""} onChange={(e) => set({ [name]: e.target.value })}>
      <option value="">{allLabel}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function SearchFilter({ name = "q", placeholder }: { name?: string; placeholder: string }) {
  const { params, set } = useQueryNav();
  const [value, setValue] = useState(params.get(name) ?? "");
  return (
    <form
      className="relative"
      onSubmit={(e) => {
        e.preventDefault();
        set({ [name]: value.trim() });
      }}
    >
      <Search size={15} className="pointer-events-none absolute inset-y-0 start-2.5 my-auto text-ink-3" aria-hidden />
      <input
        type="search"
        aria-label={placeholder}
        placeholder={placeholder}
        className="input input-sm w-44 ps-8"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          if (e.target.value === "") set({ [name]: null });
        }}
      />
    </form>
  );
}

/** شرائح اختيار تكتب قيمتها في رابط الصفحة. */
export function ChipFilter({ name, options, allLabel = "الكل" }: { name: string; options: (Option & { count?: number })[]; allLabel?: string }) {
  const { params, hrefWith } = useQueryNav();
  const active = params.get(name) ?? "";
  return (
    <div className="flex flex-wrap gap-1.5">
      <Link href={hrefWith({ [name]: null })} className="chip" aria-current={active === "" ? "true" : undefined} scroll={false}>
        {allLabel}
      </Link>
      {options.map((o) => (
        <Link key={o.value} href={hrefWith({ [name]: o.value })} className="chip" aria-current={active === o.value ? "true" : undefined} scroll={false}>
          {o.label}
          {o.count != null && <span className="text-ink-3">{o.count}</span>}
        </Link>
      ))}
    </div>
  );
}
