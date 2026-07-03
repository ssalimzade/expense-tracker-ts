import { SUBCATEGORIES, RENT_SUBCATEGORIES } from "../../types/categories";
import Select, { type SelectOption } from "../Select";

interface Props {
  value: string;
  onChange: (value: string) => void;
}

const ALL_SUBCATEGORIES = [...SUBCATEGORIES, ...RENT_SUBCATEGORIES] as readonly string[];

// Always include Uncategorized first so a categorized row can be cleared back.
// Rent & Utilities sub-categories are grouped at the end with a "· " prefix.
const OPTIONS: SelectOption[] = [
  { value: "", label: "Uncategorized" },
  ...SUBCATEGORIES.map((s) => ({ value: s, label: s })),
  ...RENT_SUBCATEGORIES.map((s) => ({ value: s, label: `· ${s}` })),
];

export default function CategoryDropdown({ value, onChange }: Props) {
  const known = ALL_SUBCATEGORIES.includes(value);
  return (
    <Select
      value={known ? value : ""}
      onChange={onChange}
      options={OPTIONS}
      className="w-full rounded-lg border border-gray-200 bg-transparent px-2 py-1 text-sm dark:border-gray-700"
    />
  );
}
