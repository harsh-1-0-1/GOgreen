import { Droplets, Leaf, Sun, Wind, Thermometer, Sprout } from 'lucide-react';
import type { CareItem } from '@/types';

// Keyword → fallback Lucide icon when no custom icon is uploaded.
// Matched case-insensitively against the tile title.
const FALLBACK_ICON_MAP: Array<{ keywords: string[]; icon: React.ElementType; color: string }> = [
  { keywords: ['light', 'sun', 'sunlight'], icon: Sun,         color: 'text-amber-400' },
  { keywords: ['water', 'watering'],        icon: Droplets,    color: 'text-sky-400'   },
  { keywords: ['air', 'humidity', 'wind'],  icon: Wind,        color: 'text-teal-400'  },
  { keywords: ['temp', 'temperature'],      icon: Thermometer, color: 'text-orange-400'},
  { keywords: ['soil', 'fertiliz'],         icon: Sprout,      color: 'text-green-500' },
];

function getFallback(title: string): { icon: React.ElementType; color: string } {
  const lower = title.toLowerCase();
  for (const entry of FALLBACK_ICON_MAP) {
    if (entry.keywords.some((kw) => lower.includes(kw))) {
      return { icon: entry.icon, color: entry.color };
    }
  }
  return { icon: Leaf, color: 'text-primary' };
}

function CareTile({ icon, title, description }: CareItem) {
  const { icon: FallbackIcon, color } = getFallback(title);
  return (
    <div className="flex min-w-[100px] min-h-[128px] flex-col items-center justify-start gap-2 bg-[#F7F5EF] px-4 py-5 text-center">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#f5f5f0]">
        {icon ? (
          <img src={icon} alt={title} className="h-12 w-12 rounded-lg object-contain" loading="lazy" />
        ) : (
          <FallbackIcon size={36} className={color} strokeWidth={1.5} />
        )}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-bold text-gray-800 leading-tight">{title}</p>
        <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">{description}</p>
      </div>
    </div>
  );
}

interface PlantCareCardProps {
  items?: CareItem[] | null;
}

export default function PlantCareCard({ items }: PlantCareCardProps) {
  if (!items || items.length === 0) return null;

  return (
    <div
      className={`grid rounded-2xl border border-gray-100 overflow-x-auto ${
        items.length === 1 ? 'grid-cols-1' : 'grid-cols-2'
      }`}
      style={items.length > 2 ? { gridTemplateColumns: `repeat(${Math.min(items.length, 4)}, minmax(100px, 1fr))` } : undefined}
    >
      {items.map((item, i) => (
        <CareTile key={i} {...item} />
      ))}
    </div>
  );
}
