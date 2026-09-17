import { useId, type ReactNode } from "react";
import { useTouchDismiss } from "../hooks/useTouchDismiss";
import { Area, Bar, BarChart, Cell, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

/**
 * Minimal charts for the gradient headers: white marks, no axes, grid or
 * legend — just the shape, first and last labels underneath, and a small
 * tooltip with the figure. See "Header charts" in STYLING_GUIDELINES.md.
 */

type Row = Record<string, string | number | null | undefined>;

export interface HeroSeries {
  key: string;
  label: string;
  kind: "area" | "line" | "dashed";
}

/** Title row shared by every header chart. */
export function HeroChartHeader({ title, note, right }: { title: string; note?: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/70">{title}</p>
        {note && <p className="mt-0.5 truncate text-sm font-semibold">{note}</p>}
      </div>
      {right}
    </div>
  );
}

function Tip({
  title,
  lines,
}: {
  title: ReactNode;
  lines: { label: string; value: string }[];
}) {
  return (
    <div className="rounded-xl bg-gray-950/85 px-3 py-2 text-xs text-white shadow-lg ring-1 ring-white/10 backdrop-blur">
      <p className="mb-0.5 text-white/60">{title}</p>
      {lines.map((l) => (
        <p key={l.label} className="flex justify-between gap-4 tabular-nums">
          <span className="text-white/70">{l.label}</span>
          <span className="font-semibold">{l.value}</span>
        </p>
      ))}
    </div>
  );
}

/** First and last labels under the chart, so the time span reads without an axis. */
function Ends({ first, last }: { first?: ReactNode; last?: ReactNode }) {
  return (
    <div className="mt-1 flex justify-between text-[11px] text-white/60">
      <span>{first}</span>
      <span>{last}</span>
    </div>
  );
}

export function HeroLineChart({
  data,
  labelKey,
  tipTitleKey = labelKey,
  series,
  format,
  className = "h-28",
}: {
  data: Row[];
  labelKey: string;
  /** Row field shown as the tooltip heading (e.g. a longer date). */
  tipTitleKey?: string;
  series: HeroSeries[];
  format: (v: number) => string;
  className?: string;
}) {
  // Unique per instance: the same chart can be mounted twice (phone and wide layouts).
  const id = `hero-fill-${useId().replace(/:/g, "")}`;
  // A tap elsewhere on the page closes the tooltip, as a tap outside a menu would.
  const { ref, dismissed } = useTouchDismiss<HTMLDivElement>();
  return (
    <div ref={ref}>
      <div className={className}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 6, right: 6, bottom: 2, left: 6 }}>
            <defs>
              <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ffffff" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#ffffff" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey={labelKey} hide />
            <YAxis hide domain={["dataMin", "dataMax"]} />
            <Tooltip
              {...(dismissed ? { active: false } : {})}
              cursor={{ stroke: "rgba(255,255,255,0.35)" }}
              content={({ active, payload }) => {
                const row = payload?.[0]?.payload as Row | undefined;
                if (!active || !row) return null;
                const lines = series
                  .filter((s) => typeof row[s.key] === "number")
                  .map((s) => ({ label: s.label, value: format(row[s.key] as number) }));
                return lines.length ? <Tip title={String(row[tipTitleKey] ?? "")} lines={lines} /> : null;
              }}
            />
            {series.map((s) =>
              s.kind === "area" ? (
                <Area
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  stroke="#ffffff"
                  strokeWidth={2.5}
                  fill={`url(#${id})`}
                  dot={false}
                  activeDot={{ r: 4, fill: "#ffffff", strokeWidth: 0 }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              ) : (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  stroke={s.kind === "dashed" ? "rgba(255,255,255,0.5)" : "#ffffff"}
                  strokeWidth={s.kind === "dashed" ? 1.5 : 2.5}
                  strokeDasharray={s.kind === "dashed" ? "4 4" : undefined}
                  dot={false}
                  activeDot={s.kind === "dashed" ? false : { r: 4, fill: "#ffffff", strokeWidth: 0 }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              ),
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <Ends first={data[0]?.[labelKey]} last={data[data.length - 1]?.[labelKey]} />
    </div>
  );
}

export function HeroBarChart({
  data,
  format,
  valueLabel,
  className = "h-28",
}: {
  data: { label: string; title: string; value: number; faded?: boolean }[];
  format: (v: number) => string;
  valueLabel: string;
  className?: string;
}) {
  const hasNegative = data.some((d) => d.value < 0);
  const { ref, dismissed } = useTouchDismiss<HTMLDivElement>();
  return (
    <div ref={ref}>
      <div className={className}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 2, bottom: 0, left: 2 }} barCategoryGap="22%">
            <XAxis dataKey="label" hide />
            <YAxis hide />
            <Tooltip
              {...(dismissed ? { active: false } : {})}
              cursor={{ fill: "rgba(255,255,255,0.08)" }}
              content={({ active, payload }) => {
                const row = payload?.[0]?.payload as (typeof data)[number] | undefined;
                if (!active || !row) return null;
                return <Tip title={row.title} lines={[{ label: valueLabel, value: format(row.value) }]} />;
              }}
            />
            {hasNegative && <ReferenceLine y={0} stroke="rgba(255,255,255,0.35)" />}
            <Bar dataKey="value" radius={[4, 4, 4, 4]} isAnimationActive={false}>
              {data.map((d) => (
                <Cell key={d.title} fill="#ffffff" fillOpacity={d.value < 0 ? 0.35 : d.faded ? 0.4 : 0.85} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <Ends first={data[0]?.label} last={data[data.length - 1]?.label} />
    </div>
  );
}
