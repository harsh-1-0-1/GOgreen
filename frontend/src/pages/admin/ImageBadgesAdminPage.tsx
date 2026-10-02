import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RotateCcw, Save, Star } from 'lucide-react';
import toast from 'react-hot-toast';

import api from '@/lib/api';
import { useCategories } from '@/hooks/useCategories';
import {
  DEFAULT_BADGE_CONFIG,
  findInheritedFrom,
  notifyBadgeConfigsChanged,
  useBadgeConfigs,
} from '@/hooks/useBadgeConfigs';
import type { BadgeKind, BadgeStyle, CategoryBadgeConfig } from '@/types';

/** Per-badge counts of the products that would actually show each badge. */
interface BadgeEligibility {
  total: number;
  bestseller: number;
  discount: number;
  rating: number;
}

const inputClass =
  'w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors';

/**
 * What each badge is and what it falls back to when the name is left blank.
 * Blank is a real choice, not an oversight: it keeps the automatic wording.
 */
const BADGES: {
  kind: BadgeKind;
  name: string;
  corner: string;
  blurb: string;
  blankLabel: string;
}[] = [
  {
    kind: 'bestseller',
    name: 'Bestseller',
    corner: 'top-right',
    blurb: 'Only shown on products an admin has flagged as a bestseller.',
    blankLabel: 'BESTSELLER',
  },
  {
    kind: 'discount',
    name: 'Discount',
    corner: 'top-left',
    blurb: 'Appears on its own whenever the original price beats the selling price.',
    blankLabel: '40% OFF, worked out from the prices',
  },
  {
    kind: 'rating',
    name: 'Rating',
    corner: 'bottom-left',
    blurb: 'Appears on its own once the product has at least one review.',
    blankLabel: 'the star rating and review count',
  },
];

type Draft = Record<BadgeKind, BadgeStyle>;

function draftFrom(config: CategoryBadgeConfig): Draft {
  return {
    bestseller: { ...config.bestseller },
    discount: { ...config.discount },
    rating: { ...config.rating },
  };
}

function draftEquals(draft: Draft, config: CategoryBadgeConfig): boolean {
  return BADGES.every(({ kind }) => {
    const a = draft[kind];
    const b = config[kind];
    return a.enabled === b.enabled && a.label === b.label && a.color === b.color;
  });
}

function BadgeColorField({
  color,
  onChange,
  label,
}: {
  color: string;
  onChange: (next: string) => void;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-600 shrink-0 w-16">Colour</span>
      <label className="relative flex-1 h-9 rounded-lg border border-gray-200 overflow-hidden cursor-pointer">
        <span
          className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold text-white/90"
          style={{ backgroundColor: color, textShadow: '0 1px 2px rgba(0,0,0,0.35)' }}
        >
          {color}
        </span>
        <input
          type="color"
          value={color}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
        />
      </label>
    </div>
  );
}

/**
 * Editor for one category. Mounted with a `key` of the category id (plus whether
 * the config map has loaded), so switching category — or the saved values
 * arriving from the server — starts a fresh draft without an effect to reset it.
 */
function BadgeEditor({
  categoryId,
  categoryName,
  hasOwnConfig,
  baseline,
  sourceNote,
  resetLabel,
  eligibility,
  statsLoaded,
}: {
  categoryId: number;
  categoryName: string;
  hasOwnConfig: boolean;
  /** What this category actually renders with, inheritance already applied. */
  baseline: CategoryBadgeConfig;
  sourceNote: string;
  resetLabel: string;
  eligibility: BadgeEligibility | null;
  statsLoaded: boolean;
}) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Draft>(() => draftFrom(baseline));

  const saveMutation = useMutation({
    mutationFn: async (config: Draft) => {
      const { data } = await api.put(`/badge-configs/${categoryId}`, config);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['badge-configs'] });
      // Any other open tab (the storefront, a second admin tab) repaints at once
      // rather than waiting for its cache to lapse.
      notifyBadgeConfigsChanged();
      toast.success(`Badge settings saved for ${categoryName}`);
    },
    onError: () => toast.error('Could not save badge settings'),
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/badge-configs/${categoryId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['badge-configs'] });
      // Any other open tab (the storefront, a second admin tab) repaints at once
      // rather than waiting for its cache to lapse.
      notifyBadgeConfigsChanged();
      toast.success(`${categoryName} now follows the inherited settings`);
    },
    onError: () => toast.error('Could not reset badge settings'),
  });

  const isDirty = !draftEquals(draft, baseline);

  function updateBadge(kind: BadgeKind, patch: Partial<BadgeStyle>) {
    setDraft((prev) => ({ ...prev, [kind]: { ...prev[kind], ...patch } }));
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="font-bold text-gray-900">{categoryName}</h2>
          <p className="text-xs text-gray-500 mt-0.5">{sourceNote}</p>
        </div>
        <div className="flex items-center gap-2">
          {hasOwnConfig && (
            <button
              onClick={() => resetMutation.mutate()}
              disabled={resetMutation.isPending || saveMutation.isPending}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              <RotateCcw size={13} /> {resetLabel}
            </button>
          )}
          <button
            onClick={() => saveMutation.mutate(draft)}
            disabled={!isDirty || saveMutation.isPending}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-lg bg-primary text-white hover:bg-primary/95 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Save size={13} /> Save
          </button>
        </div>
      </div>

      {/* Live preview */}
      <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-4">
        <p className="text-[11px] font-semibold text-gray-500 mb-2 uppercase tracking-wider">
          Preview
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {BADGES.filter((b) => draft[b.kind].enabled).map((b) => (
            <span
              key={b.kind}
              className="text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg shadow-sm whitespace-nowrap leading-none"
              style={{ backgroundColor: draft[b.kind].color }}
            >
              {draft[b.kind].label || `‹${b.blankLabel}›`}
            </span>
          ))}
          {BADGES.every((b) => !draft[b.kind].enabled) && (
            <p className="text-xs text-gray-400">No badges show for this category.</p>
          )}
        </div>
      </div>

      {BADGES.map((badge) => {
        const style = draft[badge.kind];
        const isOff = !style.enabled;
        return (
          <div
            key={badge.kind}
            className={`rounded-xl border p-4 space-y-3 ${
              isOff ? 'border-gray-200 bg-gray-50/40' : 'border-gray-200'
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-gray-800">
                  {badge.kind === 'rating' && (
                    <Star size={13} className="inline mr-1 -mt-0.5" />
                  )}
                  {badge.name} badge
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {badge.corner} corner · {badge.blurb}
                </p>
                {/* A badge can be enabled and still never appear: it only draws on
                    products that qualify. Saying so beats an admin wondering why
                    the colour they saved is nowhere to be seen. */}
                {eligibility && (
                  <p
                    className={`text-[11px] mt-1 ${
                      eligibility[badge.kind] === 0
                        ? 'text-amber-600 font-medium'
                        : 'text-gray-400'
                    }`}
                  >
                    {eligibility[badge.kind] === 0
                      ? `Shown on no products${statsLoaded ? ' in this category' : ''} — this badge will not appear`
                      : `Shown on ${eligibility[badge.kind]} of ${eligibility.total} product${
                          eligibility.total === 1 ? '' : 's'
                        }`}
                  </p>
                )}
              </div>
              <label className="flex items-center gap-2 cursor-pointer select-none shrink-0">
                <span className="text-[11px] text-gray-500">{style.enabled ? 'On' : 'Off'}</span>
                <input
                  type="checkbox"
                  checked={style.enabled}
                  onChange={(e) => updateBadge(badge.kind, { enabled: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
              </label>
            </div>

            {style.enabled && (
              <>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-600 shrink-0 w-16">Name</span>
                  <input
                    value={style.label}
                    onChange={(e) => updateBadge(badge.kind, { label: e.target.value })}
                    placeholder={`Leave blank — shows ${badge.blankLabel}`}
                    maxLength={50}
                    className={inputClass}
                  />
                </div>
                <BadgeColorField
                  color={style.color}
                  onChange={(next) => updateBadge(badge.kind, { color: next })}
                  label={`${badge.name} badge colour`}
                />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function ImageBadgesAdminPage() {
  const { data: categories } = useCategories();
  const { data: badgeMap, isFetched } = useBadgeConfigs();
  const [selectedId, setSelectedId] = useState<number | null>(null);

  // Flattened so a subcategory can be configured on its own.
  const categoryRows = useMemo(() => {
    const rows: { id: number; name: string; depth: number }[] = [];
    (categories ?? []).forEach((parent) => {
      rows.push({ id: parent.id, name: parent.name, depth: 0 });
      (parent.children ?? []).forEach((child) =>
        rows.push({ id: child.id, name: child.name, depth: 1 }),
      );
    });
    return rows;
  }, [categories]);

  // Parent lookup so the editor can say which ancestor a category inherits from.
  const parentOf = useMemo(() => {
    const map: Record<number, number | null> = {};
    (categories ?? []).forEach((parent) => {
      map[parent.id] = null;
      (parent.children ?? []).forEach((child) => {
        map[child.id] = parent.id;
      });
    });
    return map;
  }, [categories]);
  const nameById = useMemo(() => {
    const map = new Map<number, string>();
    categoryRows.forEach((r) => map.set(r.id, r.name));
    return map;
  }, [categoryRows]);

  // Derived, not stored: until the admin picks one, edit the first category.
  const activeId = selectedId ?? categoryRows[0]?.id ?? null;
  const activeRow = categoryRows.find((r) => r.id === activeId) ?? null;

  // Per-badge product counts, so the editor can say whether a badge will show at
  // all in this category.
  const { data: eligibility, isFetched: statsLoaded } = useQuery({
    queryKey: ['badge-config-stats', activeId],
    queryFn: async () => {
      const { data } = await api.get<BadgeEligibility>(`/badge-configs/${activeId}/stats`);
      return data;
    },
    enabled: activeId != null,
    staleTime: 60 * 1000,
  });

  const activeHasOwnConfig =
    activeId != null ? !!badgeMap?.by_category?.[String(activeId)] : false;
  const activeBaseline: CategoryBadgeConfig =
    (activeId != null ? badgeMap?.effective_by_category?.[String(activeId)] : undefined) ??
    DEFAULT_BADGE_CONFIG;
  const inheritedFromId =
    activeId != null ? findInheritedFrom(badgeMap, activeId, parentOf) : null;
  const sourceNote = activeHasOwnConfig
    ? 'Using its own settings.'
    : inheritedFromId != null
      ? `Inherited from ${nameById.get(inheritedFromId) ?? 'its parent category'} — change anything below to override just this one.`
      : 'Inherits the store defaults — change anything below to customise this category.';
  const resetLabel = inheritedFromId != null ? 'Use inherited' : 'Reset to defaults';

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Image Badges</h1>
        <p className="text-sm text-gray-500 mt-1">
          The badges drawn on top of product images. Wording and colour are set per category, so
          renaming &ldquo;Bestseller&rdquo; to &ldquo;Hot Seller&rdquo; is one edit for every product
          in that category.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5 items-start">
        {/* Category picker */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 text-xs font-bold uppercase tracking-wider text-gray-500">
            Categories
          </div>
          <div className="max-h-[60vh] overflow-y-auto p-1.5">
            {categoryRows.length === 0 && (
              <p className="px-3 py-4 text-xs text-gray-400">No categories yet.</p>
            )}
            {categoryRows.map((row) => {
              const isSelected = row.id === activeId;
              const isCustomised = !!badgeMap?.by_category[String(row.id)];
              return (
                <button
                  key={row.id}
                  onClick={() => setSelectedId(row.id)}
                  className={`w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${
                    isSelected
                      ? 'bg-primary/10 font-medium text-primary'
                      : 'hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <span className={row.depth === 1 ? 'pl-3' : ''}>{row.name}</span>
                  {isCustomised && (
                    <span
                      title="This category has its own badge settings"
                      aria-label="Customised"
                      className="w-1.5 h-1.5 rounded-full bg-primary shrink-0"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Editor */}
        {!activeRow ? (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-sm text-gray-400">Pick a category to configure its badges.</p>
          </div>
        ) : (
          // The `isFetched` term remounts the editor once the saved values land,
          // so the draft starts from the category's real settings, not defaults.
          <BadgeEditor
            key={`${activeRow.id}:${isFetched}`}
            categoryId={activeRow.id}
            categoryName={activeRow.name}
            hasOwnConfig={activeHasOwnConfig}
            baseline={activeBaseline}
            sourceNote={sourceNote}
            resetLabel={resetLabel}
            eligibility={eligibility ?? null}
            statsLoaded={statsLoaded}
          />
        )}
      </div>
    </div>
  );
}