import { AlertTriangle, CheckCircle2, OctagonAlert } from "lucide-react";
import { compact, money, pct } from "@/lib/format";
import { cx } from "./ui";

// رسوم خفيفة بـ HTML/CSS: نص واضح بأي عرض، واتجاه يتبع القراءة من اليمين لليسار.

function niceMax(value: number): number {
  if (value <= 0) return 100;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  for (const step of [1, 2, 2.5, 5, 10]) {
    if (value <= step * magnitude) return step * magnitude;
  }
  return 10 * magnitude;
}

export type PairPoint = { key: string; label: string; a: number; b: number; detail?: string };

/** أعمدة مزدوجة (سلسلتان) على محور واحد، مع تلميح عند المرور. */
export function PairedBars({
  data,
  seriesA,
  seriesB,
  height = 208,
}: {
  data: PairPoint[];
  seriesA: string;
  seriesB: string;
  height?: number;
}) {
  const max = niceMax(Math.max(...data.flatMap((d) => [d.a, d.b]), 0));
  const ticks = [1, 0.5, 0];
  return (
    <figure>
      <figcaption className="mb-4 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-ink-2">
        <span className="flex items-center gap-2">
          <span className="size-2.5 rounded-sm" style={{ background: "var(--series-1)" }} aria-hidden />
          {seriesA}
        </span>
        <span className="flex items-center gap-2">
          <span className="size-2.5 rounded-sm" style={{ background: "var(--series-2)" }} aria-hidden />
          {seriesB}
        </span>
      </figcaption>
      <div className="flex gap-3">
        <div className="relative w-9 shrink-0 text-[11px] text-ink-3" style={{ height }} aria-hidden>
          {ticks.map((t) => (
            <span key={t} className="absolute end-0 -translate-y-1/2" style={{ top: `${(1 - t) * 100}%` }}>
              {compact(max * t)}
            </span>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <div className="viz-group relative flex" style={{ height }}>
            {ticks.map((t) => (
              <span
                key={t}
                className="pointer-events-none absolute inset-x-0 border-t"
                style={{ top: `${(1 - t) * 100}%`, borderColor: t === 0 ? "var(--border-strong)" : "var(--grid)" }}
                aria-hidden
              />
            ))}
            {data.map((d, i) => (
              <div
                key={d.key}
                className="viz-col relative flex h-full flex-1 items-end justify-center gap-0.5 outline-none"
                tabIndex={0}
                aria-label={`${d.label}: ${seriesA} ${Math.round(d.a)}، ${seriesB} ${Math.round(d.b)}`}
              >
                <span className="viz-bar w-3.5 max-w-6 rounded-t sm:w-4" style={{ height: `${(d.a / max) * 100}%`, minHeight: d.a > 0 ? 2 : 0, background: "var(--series-1)" }} />
                <span className="viz-bar w-3.5 max-w-6 rounded-t sm:w-4" style={{ height: `${(d.b / max) * 100}%`, minHeight: d.b > 0 ? 2 : 0, background: "var(--series-2)" }} />
                <div
                  className={cx(
                    "viz-tip absolute bottom-full z-10 mb-1 w-max rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-pop",
                    i === 0 ? "start-0" : i === data.length - 1 ? "end-0" : "start-1/2 translate-x-1/2",
                  )}
                  role="tooltip"
                >
                  <p className="mb-1 font-semibold">{d.label}</p>
                  <p className="flex items-center justify-between gap-4">
                    <span className="flex items-center gap-1.5 text-ink-2">
                      <span className="size-2 rounded-sm" style={{ background: "var(--series-1)" }} />
                      {seriesA}
                    </span>
                    <span className="font-semibold">{money(d.a, { digits: 0 })}</span>
                  </p>
                  <p className="flex items-center justify-between gap-4">
                    <span className="flex items-center gap-1.5 text-ink-2">
                      <span className="size-2 rounded-sm" style={{ background: "var(--series-2)" }} />
                      {seriesB}
                    </span>
                    <span className="font-semibold">{money(d.b, { digits: 0 })}</span>
                  </p>
                  {d.detail && <p className="mt-1 border-t border-line pt-1 text-ink-2">{d.detail}</p>}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 flex text-[11.5px] text-ink-3" aria-hidden>
            {data.map((d) => (
              <span key={d.key} className="flex-1 text-center">
                {d.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </figure>
  );
}

/** قائمة أشرطة أفقية مرتّبة بقيمها (لون واحد = مقدار واحد). */
export function BarList({ items, total }: { items: { key: string; label: string; value: number }[]; total?: number }) {
  const max = Math.max(...items.map((i) => i.value), 0);
  const sum = total ?? items.reduce((s, i) => s + i.value, 0);
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.key}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
            <span className="truncate text-ink-2">{item.label}</span>
            <span className="shrink-0 font-semibold">
              {money(item.value, { digits: 0 })}
              {sum > 0 && <span className="ms-2 font-normal text-ink-3">{pct((item.value / sum) * 100)}</span>}
            </span>
          </div>
          <div className="h-2 rounded-full bg-surface-2">
            <div className="h-full rounded-full" style={{ width: `${max > 0 ? Math.max((item.value / max) * 100, 1.5) : 0}%`, background: "var(--series-1)" }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export type MeterStatus = "good" | "warning" | "critical";

const meterMeta: Record<MeterStatus, { color: string; Icon: typeof CheckCircle2 }> = {
  good: { color: "var(--status-good)", Icon: CheckCircle2 },
  warning: { color: "var(--status-warning)", Icon: AlertTriangle },
  critical: { color: "var(--status-critical)", Icon: OctagonAlert },
};

/** شريط تقدّم نحو هدف أو سقف، بحالة يدلّ عليها لون وأيقونة ونص. */
export function Meter({ value, max, status, caption }: { value: number; max: number; status: MeterStatus; caption: string }) {
  const ratio = max > 0 ? value / max : 0;
  const { color, Icon } = meterMeta[status];
  return (
    <div className="mt-3">
      <div className="h-2 overflow-hidden rounded-full bg-surface-2" role="meter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.round(value)} aria-label={caption}>
        <div className="h-full rounded-full transition-[width]" style={{ width: `${Math.min(Math.max(ratio, 0), 1) * 100}%`, background: color }} />
      </div>
      <p className="mt-1.5 flex items-center gap-1.5 text-xs text-ink-2">
        <Icon size={13} style={{ color }} aria-hidden />
        {caption}
      </p>
    </div>
  );
}
