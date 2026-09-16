import { useState } from "react";

export interface PhoneSection<T extends string> {
  value: T;
  label: string;
}

/**
 * Which section a tab shows on phones (or everywhere, with allWidths), remembered
 * per tab. By default wider screens show every section at once.
 */
export function usePhoneSection<T extends string>(
  storageKey: string,
  sections: readonly PhoneSection<T>[],
  /** Switch sections at every width, not just on phones. */
  allWidths = false,
) {
  const [value, setValue] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      const match = sections.find((s) => s.value === saved);
      if (match) return match.value;
    } catch {
      // Storage blocked — fall back to the first section.
    }
    return sections[0].value;
  });
  const change = (v: T) => {
    setValue(v);
    try {
      localStorage.setItem(storageKey, v);
    } catch {
      // Not remembered, but the switch still works.
    }
  };
  /** Class for a block that belongs to `section`: hidden on phones unless it's the active one. */
  const show = (section: T) => (section === value ? "" : allWidths ? "hidden" : "max-lg:hidden");
  return { value, change, show };
}

/** The phone-only segmented control, styled like Travel's Journal / Plan / Summary. */
export default function PhoneSectionTabs<T extends string>({
  sections,
  value,
  onChange,
  allWidths = false,
}: {
  sections: readonly PhoneSection<T>[];
  value: T;
  onChange: (v: T) => void;
  /** Keep the switch on wide screens too (then it sizes to its content). */
  allWidths?: boolean;
}) {
  return (
    <div
      className={`flex w-full gap-1 rounded-2xl bg-gray-100 p-1 dark:bg-gray-800/70 ${allWidths ? "sm:w-fit" : "lg:hidden"}`}
      role="tablist"
    >
      {sections.map((s) => {
        const active = s.value === value;
        return (
          <button
            key={s.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(s.value)}
            className={`flex-auto whitespace-nowrap rounded-xl px-2 py-1.5 text-sm sm:px-4 font-semibold transition ${
              active
                ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
            }`}
          >
            {s.label}
          </button>
        );
      })}
    </div>
  );
}
