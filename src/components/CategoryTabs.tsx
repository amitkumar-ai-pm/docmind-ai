'use client';

import { DOCUMENT_CATEGORIES } from '@/lib/constants';
import { CategoryCount } from '@/types/app';

interface CategoryTabsProps {
  active: string;
  counts: CategoryCount[];
  totalCount: number;
  onChange: (category: string) => void;
}

export default function CategoryTabs({ active, counts, totalCount, onChange }: CategoryTabsProps) {
  const countMap = new Map(counts.map((c) => [c.category, c._count.id]));

  return (
    <div className="scrollbar-thin flex gap-2 overflow-x-auto pb-1">
      {DOCUMENT_CATEGORIES.map((cat) => {
        const count = cat.id === 'all' ? totalCount : countMap.get(cat.id) ?? 0;
        const isActive = active === cat.id;

        return (
          <button
            key={cat.id}
            onClick={() => onChange(cat.id)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium ring-1 transition ${
              isActive
                ? 'bg-brand-600 text-white ring-brand-600 shadow-sm'
                : `${cat.color} ring-transparent hover:ring-slate-200`
            }`}
          >
            {cat.label}
            <span className={`ml-1.5 ${isActive ? 'text-brand-100' : 'opacity-60'}`}>
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
