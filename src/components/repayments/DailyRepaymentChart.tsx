import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine,
} from "recharts";
import type { Repayment } from "../../types/repayment";
import { dailyUpcoming, dailyUpcomingCats, repaymentsOnDate } from "../../lib/repayments";
import { tooltipStyle, cursorStyle, tooltipItemStyle, tooltipLabelStyle } from "../../lib/chart";
import { gbp } from "../../lib/format";
import { Card } from "../common";

const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

const PALETTE = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#a855f7", "#f43f5e", "#14b8a6", "#fb923c"];

interface TooltipPayloadItem {
  name: string;
  value: number;
  color: string;
}

function CategoryTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const items = payload.filter((p) => p.value > 0);
  if (items.length === 0) return null;
  const total = items.reduce((s, p) => s + p.value, 0);

  return (
    <div style={tooltipStyle()} className="px-2.5 py-2">
      <p style={tooltipLabelStyle} className="mb-1">{label ? fmtDate(label) : ""}</p>
      {items.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5" style={tooltipItemStyle}>
            <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
            {p.name}
          </span>
          <span style={tooltipItemStyle} className="tabular-nums">{gbp(p.value)}</span>
        </div>
      ))}
      <div className="mt-1 flex items-center justify-between gap-4 border-t border-gray-200 pt-1 dark:border-gray-700">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Total</span>
        <span className="font-bold tabular-nums">{gbp(total)}</span>
      </div>
    </div>
  );
}

interface Props {
  repayments: Repayment[];
  visibleMonths: string[];
}

export default function DailyRepaymentChart({ repayments, visibleMonths }: Props) {
  const raw = dailyUpcoming(repayments, visibleMonths);
  const cats = dailyUpcomingCats(repayments, visibleMonths);
  const today = new Date().toISOString().slice(0, 10);

  const [selected, setSelected] = useState<string | null>(null);
  const dueItems = selected ? repaymentsOnDate(repayments, selected) : [];
  const dueTotal = dueItems.reduce((s, i) => s + i.amount, 0);

  // Ephemeral "ticked" rows in the popup — visual scratchpad, not persisted.
  const [tickedItems, setTickedItems] = useState<Set<string>>(new Set());
  const toggleItem = (key: string) =>
    setTickedItems((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  if (raw.length === 0) {
    return (
      <Card>
        <p className="py-6 text-center text-sm text-gray-400">No upcoming repayments in this period</p>
      </Card>
    );
  }

  const data = raw.map((d) => ({ date: d.date, ...d.byCategory }));
  const grandTotal = raw.reduce((s, d) => s + d.total, 0);

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Upcoming Repayments
          </h2>
          <p className="mt-0.5 text-xs text-gray-400">Click a day to see what's due</p>
        </div>
        <span className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
          {gbp(grandTotal)}
        </span>
      </div>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 4, right: 8, bottom: 4, left: 0 }}
            onClick={(state) => {
              const label = state?.activeLabel;
              if (label) setSelected(String(label));
            }}
            className="cursor-pointer"
          >
            <CartesianGrid vertical={false} stroke="rgba(0,0,0,0.05)" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: "#9ca3af" }}
              tickFormatter={(d: string) => {
                const [y, m, day] = d.split("-").map(Number);
                return new Date(y, m - 1, day).toLocaleString("en-GB", { day: "numeric", month: "short" });
              }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#9ca3af" }}
              width={44}
              tickFormatter={(v) => `£${v}`}
              axisLine={false}
              tickLine={false}
              domain={[0, "auto"]}
            />
            <Tooltip content={<CategoryTooltip />} cursor={cursorStyle()} />
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "12px" }} />
            {cats.map((cat, i) => (
              <Bar
                key={cat}
                dataKey={cat}
                stackId="a"
                fill={PALETTE[i % PALETTE.length]}
                radius={i === cats.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
              />
            ))}
            <ReferenceLine
              x={today}
              stroke="#9ca3af"
              strokeDasharray="4 2"
              label={{ value: "today", position: "top", fontSize: 9, fill: "#9ca3af" }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl dark:bg-gray-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                  Due {fmtDate(selected)}
                </h3>
                <p className="text-xs text-gray-400">{dueItems.length} repayment{dueItems.length !== 1 ? "s" : ""}</p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800"
                aria-label="Close"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                  <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                </svg>
              </button>
            </div>

            <ul className="max-h-80 divide-y divide-gray-50 overflow-y-auto dark:divide-gray-800/60">
              {dueItems.map((item, i) => {
                const key = `${item.id}-${i}`;
                const isTicked = tickedItems.has(key);
                return (
                  <li
                    key={key}
                    className={`flex items-center gap-3 rounded-lg px-2 py-2.5 ${
                      isTicked ? "bg-emerald-50 dark:bg-emerald-950/40" : ""
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleItem(key)}
                      title={isTicked ? "Untick" : "Tick"}
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors ${
                        isTicked
                          ? "border-emerald-500 bg-emerald-500 text-white"
                          : "border-gray-300 text-transparent hover:border-emerald-400 dark:border-gray-600"
                      }`}
                    >
                      <svg viewBox="0 0 12 12" fill="none" className="h-2.5 w-2.5">
                        <path d="M2.5 6.2 4.7 8.5 9.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-200">{item.description}</p>
                      <p className="text-xs text-gray-400">{item.category}</p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-gray-900 dark:text-white">
                      {gbp(item.amount)}
                    </span>
                  </li>
                );
              })}
            </ul>

            <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3 dark:border-gray-800">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Total</span>
              <span className="text-base font-bold tabular-nums text-indigo-600 dark:text-indigo-400">{gbp(dueTotal)}</span>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
