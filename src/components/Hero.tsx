import type { ReactNode } from "react";

export interface HeroFieldProps {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  /** Tints the value when it's bad news (e.g. overspent, owed). */
  warn?: boolean;
}

/**
 * The gradient header used by the redesigned tabs: a pill, one headline figure,
 * an optional line under it, then a row of small fields. Each tab passes its own
 * gradient so they stay distinguishable. See STYLING_GUIDELINES.md.
 */
export default function Hero({
  gradient,
  badge,
  label,
  value,
  under,
  fields = [],
  aside,
  decoration,
  children,
}: {
  /** Tailwind gradient stops, e.g. "from-indigo-500 via-violet-600 to-purple-700 dark:from-…". */
  gradient: string;
  badge?: ReactNode;
  label: string;
  value: ReactNode;
  /** Right under the headline figure: a delta chip, a progress bar… */
  under?: ReactNode;
  fields?: HeroFieldProps[];
  /** Right-hand column on desktop (below on phones). */
  aside?: ReactNode;
  /** Faint background SVG. */
  decoration?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section
      className={`relative overflow-hidden rounded-3xl bg-gradient-to-br text-white shadow-lg shadow-black/5 dark:shadow-none ${gradient}`}
    >
      {decoration}
      <div className={`relative grid gap-6 p-5 sm:p-7 ${aside ? "md:grid-cols-[minmax(0,1fr)_auto] md:items-end" : ""}`}>
        <div className="min-w-0">
          {badge && (
            <span className="inline-block rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] backdrop-blur">
              {badge}
            </span>
          )}
          <p className={`${badge ? "mt-4" : ""} text-[10px] font-semibold uppercase tracking-[0.14em] text-white/70`}>{label}</p>
          <p className="mt-1 text-4xl font-extrabold tabular-nums tracking-tight sm:text-5xl">{value}</p>
          {under && <div className="mt-2">{under}</div>}
          {fields.length > 0 && (
            <div className={`mt-6 grid grid-cols-2 gap-4 ${fields.length >= 4 ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}>
              {fields.map((f) => (
                <HeroField key={f.label} {...f} />
              ))}
            </div>
          )}
          {children}
        </div>
        {aside && (
          <div className="border-t border-dashed border-white/25 pt-5 md:border-l md:border-t-0 md:pl-7 md:pt-0">{aside}</div>
        )}
      </div>
    </section>
  );
}

export function HeroField({ label, value, sub, warn }: HeroFieldProps) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/60">{label}</p>
      <p className={`mt-0.5 text-base font-bold tabular-nums sm:text-lg ${warn ? "text-rose-100" : ""}`}>
        {warn && <span className="mr-1 inline-block h-1.5 w-1.5 -translate-y-0.5 rounded-full bg-rose-200" />}
        {value}
      </p>
      {sub && <p className="truncate text-[11px] text-white/60">{sub}</p>}
    </div>
  );
}

/** A translucent chip for use on a hero. */
export function HeroChip({ children }: { children: ReactNode }) {
  return <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-semibold">{children}</span>;
}

/** A white progress bar for use on a hero. */
export function HeroProgress({ pct, danger = false }: { pct: number; danger?: boolean }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-white/20">
      <div
        className={`h-full rounded-full transition-[width] duration-700 ${danger ? "bg-rose-200" : "bg-white"}`}
        style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
      />
    </div>
  );
}
