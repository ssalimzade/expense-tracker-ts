import { useEffect, useState } from "react";
import { useBalance, useSaveBalance } from "../../hooks/useBalance";
import MoneyInput from "../MoneyInput";
import { gbp0 } from "../../lib/format";
import type { BalanceValues } from "../../api/balance";

const ITEMS: { key: keyof BalanceValues; label: string }[] = [
  { key: "savings", label: "Savings" },
  { key: "monzo", label: "Monzo" },
  { key: "chase", label: "Chase" },
  { key: "barclays", label: "Barclays" },
  { key: "amex", label: "AMEX" },
  { key: "diff_in_bills", label: "Diff in bills" },
];

const DEFAULTS: BalanceValues = { savings: 0, monzo: 0, chase: 0, amex: 0, barclays: 0, diff_in_bills: 0 };

function cardStyle(v: number) {
  if (v > 0)
    return {
      text: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50/60 dark:bg-emerald-950/40",
      border: "border-emerald-100 dark:border-emerald-900",
    };
  if (v < 0)
    return {
      text: "text-red-600 dark:text-red-400",
      bg: "bg-red-50/60 dark:bg-red-950/40",
      border: "border-red-100 dark:border-red-900",
    };
  return {
    text: "text-gray-900 dark:text-white",
    bg: "bg-gray-50 dark:bg-gray-800/60",
    border: "border-gray-200 dark:border-gray-700",
  };
}

export default function BalanceSection({ month }: { month: string }) {
  const query = useBalance(month);
  const save = useSaveBalance(month);
  const [draft, setDraft] = useState<BalanceValues>(DEFAULTS);

  useEffect(() => {
    if (query.data) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { month: _m, ...vals } = query.data;
      setDraft(vals);
    }
  }, [query.data]);

  function commit(key: keyof BalanceValues, value: number) {
    const next = { ...draft, [key]: value };
    setDraft(next);
    save.mutate(next);
  }

  const totalBalance = ITEMS.reduce((sum, { key }) => sum + (draft[key] || 0), 0);
  const totalStyle = cardStyle(totalBalance);

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
        Balances
      </p>
      <div className="grid grid-cols-7 gap-3">
        {ITEMS.map(({ key, label }) => {
          const val = draft[key];
          const { text, bg, border } = cardStyle(val);
          return (
            <div
              key={key}
              className={`rounded-2xl border ${border} ${bg} px-4 py-4 text-center`}
            >
              <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
                {label}
              </p>
              <div className="mt-1.5 flex justify-center">
                <MoneyInput
                  value={val}
                  onCommit={(v) => commit(key, v)}
                  allowNegative
                  pound
                  className={`!w-full !text-2xl !font-bold !tracking-tight ${text}`}
                />
              </div>
            </div>
          );
        })}

        {/* Read-only sum of all balances above */}
        <div className={`rounded-2xl border ${totalStyle.border} ${totalStyle.bg} px-4 py-4 text-center`}>
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
            Total Balance
          </p>
          <p className={`mt-1.5 text-2xl font-bold tracking-tight ${totalStyle.text}`}>
            {gbp0(totalBalance)}
          </p>
        </div>
      </div>
    </div>
  );
}
