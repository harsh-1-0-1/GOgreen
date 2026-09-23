import { useState } from 'react';

import type { Category } from '@/types';

interface CategoryOption {
  value: string;
  label: string;
}

function flattenCategoryOptions(categories: Category[] | undefined): CategoryOption[] {
  const options: CategoryOption[] = [];
  const walk = (cat: Category, depth: number) => {
    options.push({
      value: cat.slug,
      label: `${'— '.repeat(depth)}${cat.name} (/products?category=${cat.slug})`,
    });
    (cat.children ?? []).forEach((child) => walk(child, depth + 1));
  };
  (categories ?? []).forEach((cat) => walk(cat, 0));
  return options;
}

interface CategoryLinkPickerProps {
  categories: Category[] | undefined;
  onPick: (link: string) => void;
  label?: string;
}

export default function CategoryLinkPicker({
  categories,
  onPick,
  label = 'Or pick a category link:',
}: CategoryLinkPickerProps) {
  const [value, setValue] = useState('');
  const options = flattenCategoryOptions(categories);

  return (
    <div className="mt-1.5 flex items-center gap-2">
      <span className="text-[10px] font-semibold text-gray-500 whitespace-nowrap">{label}</span>
      <select
        value={value}
        onChange={(e) => {
          if (e.target.value) {
            onPick(`/products?category=${e.target.value}`);
            setValue('');
          }
        }}
        className="flex-1 min-w-0 px-2 py-1.5 border rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-primary/50"
      >
        <option value="">— pick a category —</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}