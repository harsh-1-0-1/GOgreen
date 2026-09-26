import { useState } from 'react';
import type { VariantGroup } from '@/types';
import { COMBO_KEY_SEP } from '@/lib/potPrice';
import api from '@/lib/api';
import { getApiErrorDetail } from '@/lib/apiError';

export interface PotPriceConflict {
  key: string;
  label: string;
  values: number[];
}

export interface PotPriceDraft {
  group_ids: string[];
  independent_group_ids: string[];
  map: Record<string, number>;
}

interface Props {
  /** Product being edited — the projection endpoint is per-product (it reads stored data). */
  productId?: number | null;
  groups: VariantGroup[];
  draft: PotPriceDraft | null;
  onChange: (next: PotPriceDraft | null) => void;
  /** Full-combo price_map, offered as a migration source (18 keys → 6 cells). */
  existingPriceMap?: Record<string, number> | null;
  /** True once the product has a populated price_map, which shadows the grid entirely. */
  priceMapActive: boolean;
}

function groupOptions(g: VariantGroup) {
  return (g.options ?? []).filter((o) => o.id && o.name?.trim());
}

function axisOrder(groups: VariantGroup[], selected: string[]): string[] {
  // Canonical key order follows the PRODUCT's group order, never the admin's click order.
  // Reordering the pickers must not rewrite every key in the map.
  const wanted = new Set(selected);
  return groups.filter((g) => wanted.has(g.id)).map((g) => g.id);
}

function labelFor(groups: VariantGroup[], id: string): string {
  return groups.find((g) => g.id === id)?.label ?? id;
}

/** "Small / Grow" for a subset key, so a conflict reads like a cell rather than a hash. */
function cellLabel(groups: VariantGroup[], axes: string[], key: string): string {
  return key
    .split(COMBO_KEY_SEP)
    .map((id, i) => {
      const opts = groups.find((g) => g.id === axes[i])?.options ?? [];
      return opts.find((o) => o.id === id)?.name ?? id;
    })
    .join(' / ');
}

interface ProjectionResponse {
  group_ids: string[];
  map: Record<string, number>;
}

/** The 422 body: the cells the backend refused to guess at. */
interface ProjectionConflictDetail {
  message?: string;
  conflicts: { key: string; values: number[] }[];
}

export default function PotPriceEditor({
  productId,
  groups,
  draft,
  onChange,
  existingPriceMap,
  priceMapActive,
}: Props) {
  const [conflicts, setConflicts] = useState<PotPriceConflict[]>([]);
  const [resolutions, setResolutions] = useState<Record<string, number>>({});
  const [migrating, setMigrating] = useState(false);
  const [projectionError, setProjectionError] = useState<string | null>(null);

  const usable = groups.filter((g) => groupOptions(g).length > 0);
  const gridAxes = draft ? axisOrder(usable, draft.group_ids) : [];
  const axisCount = gridAxes.length;

  // Rows = first axis, Columns = remaining axes. Which axis is which does not change what
  // the customer sees, so this is purely presentational.
  const rowAxis = axisCount > 0 ? gridAxes[0] : null;
  const colAxes = gridAxes.slice(1);
  // Plain derivations, not useMemo: the admin form re-renders on every keystroke anyway and
  // each of these is a small O(groups × options) pass, so memoizing on a joined dep string
  // would add complexity without avoiding any real work.
  let colCombos: string[][] = [];
  if (colAxes.length > 0) {
    colCombos = [[]];
    for (const gid of colAxes) {
      const opts = groupOptions(usable.find((g) => g.id === gid)!);
      colCombos = colCombos.flatMap((c) => opts.map((o) => [...c, o.id]));
    }
  }

  const cellCount = rowAxis ? groupOptions(usable.find((g) => g.id === rowAxis)!).length * Math.max(1, colCombos.length) : 0;
  const hasNonZeroPrices = (g: VariantGroup) =>
    groupOptions(g).some((o) => Number(o.price ?? 0) !== 0);
  const outsidePriced = groups.filter((g) => g.id && !gridAxes.includes(g.id)).filter(hasNonZeroPrices);
  const gridPriced = groups.filter((g) => gridAxes.includes(g.id)).filter(hasNonZeroPrices);

  const blocking = gridPriced.length > 0 || outsidePriced.length > 0;
  const filled = draft ? Object.keys(draft.map).length : 0;

  function toggleAxis(gid: string) {
    const cur = draft ?? { group_ids: [], independent_group_ids: [], map: {} };
    const has = cur.group_ids.includes(gid);
    const group_ids = axisOrder(
      usable,
      has ? cur.group_ids.filter((x) => x !== gid) : [...cur.group_ids, gid],
    );
    // Changing the axis set changes every key. Carry values across only where a key still
    // resolves; the rest are dropped rather than silently reinterpreted.
    const nextAxisCount = group_ids.length;
    const map: Record<string, number> = {};
    for (const [k, v] of Object.entries(cur.map)) {
      if (k.split(COMBO_KEY_SEP).length === nextAxisCount) map[k] = v;
    }
    const independent_group_ids = cur.independent_group_ids.filter((x) => !group_ids.includes(x));
    onChange({ ...cur, group_ids, map, independent_group_ids });
    setConflicts([]);
  }

  function setCell(rowOptId: string, colIds: string[], raw: string) {
    if (!draft) return;
    const parts = [rowOptId, ...colIds];
    const key = parts.join(COMBO_KEY_SEP);
    const map = { ...draft.map };
    const n = Number(raw);
    if (raw === '' || !Number.isFinite(n) || n < 0) delete map[key];
    else map[key] = n;
    onChange({ ...draft, map });
  }

  // The backend owns the projection. A client-side copy would be a second implementation of
  // the same decision, and the two would drift — which is precisely how a card ends up
  // advertising one price while checkout charges another.
  async function runMigration() {
    if (!draft || !productId) return;
    setMigrating(true);
    setProjectionError(null);
    setConflicts([]);
    setResolutions({});
    try {
      const { data } = await api.post<ProjectionResponse>(
        `/products/${productId}/pot-price/projection`,
        { group_ids: gridAxes },
      );
      // Clean projection: every cell agreed, so the whole grid is filled in.
      onChange({ ...draft, map: { ...draft.map, ...data.map } });
    } catch (e) {
      // 422 carries the disagreeing cells so the merchant can choose. The clean cells are NOT
      // returned on a conflict, so nothing partial is applied — the grid keeps whatever it had.
      const detail = (e as { response?: { data?: { detail?: ProjectionConflictDetail } } })
        ?.response?.data?.detail;
      if (detail && Array.isArray(detail.conflicts)) {
        setConflicts(
          detail.conflicts.map((c) => ({
            key: c.key,
            label: cellLabel(usable, gridAxes, c.key),
            values: c.values,
          })),
        );
      } else {
        setProjectionError(
          getApiErrorDetail(e, 'Could not build the grid from the existing prices.'),
        );
      }
    } finally {
      setMigrating(false);
    }
  }

  // Conflicts are resolved in the UI, then the chosen values are written into the grid by
  // hand alongside the clean cells — the endpoint deliberately never picks for the merchant.
  function applyResolutions() {
    if (!draft) return;
    onChange({ ...draft, map: { ...draft.map, ...resolutions } });
    setConflicts([]);
    setResolutions({});
  }

  if (usable.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-500">
        Add variant groups first — this grid prices a combination of them.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Axis selection ─────────────────────────────────────────── */}
      <div>
        <p className="text-sm font-semibold text-gray-700">
          Variant types priced by this grid
          <span className="ml-2 font-normal text-gray-500">
            The pot price can depend on more than one choice. Tick every group whose effect
            this grid already covers.
          </span>
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {usable.map((g) => {
            const on = gridAxes.includes(g.id);
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => toggleAxis(g.id)}
                aria-pressed={on}
                className={`rounded-full border-2 px-3 py-1.5 text-xs font-semibold transition ${
                  on
                    ? 'border-primary bg-primary text-white'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-primary/50'
                }`}
              >
                {g.label}
              </button>
            );
          })}
        </div>
        {axisCount === 0 && (
          <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
            No groups selected, so this grid has no effect. Tick at least one.
          </p>
        )}
        {axisCount === 1 && (
          <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
            One group selected. That works, but a grid normally needs two or more — with one,
            a single price box per option is simpler and clearer.
          </p>
        )}
      </div>

      {/* ── The §5.5a gate, surfaced client-side ───────────────────── */}
      {blocking && (
        <div className="rounded-lg border-2 border-red-300 bg-red-50 p-3 text-xs text-red-800 space-y-2">
          <p className="font-semibold">This grid would give a wrong total. Fix it before saving.</p>
          {gridPriced.map((g) => (
            <p key={g.id}>
              <strong>{g.label}</strong> has its own price, but this grid already prices it, so
              that amount is <em>not</em> being charged. Move it into the grid, or set those
              option prices to 0.
            </p>
          ))}
          {outsidePriced.map((g) => (
            <div key={g.id}>
              <p>
                <strong>{g.label}</strong> has its own price and is not in this grid. Confirm it
                is a separate charge:
              </p>
              <label className="mt-1 inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!!draft?.independent_group_ids.includes(g.id)}
                  onChange={(e) => {
                    if (!draft) return;
                    onChange({
                      ...draft,
                      independent_group_ids: e.target.checked
                        ? [...draft.independent_group_ids, g.id]
                        : draft.independent_group_ids.filter((x) => x !== g.id),
                    });
                  }}
                />
                <span>
                  Yes — charge it separately (₹
                  {groupOptions(g).reduce((s, o) => s + Number(o.price ?? 0), 0)} added on top)
                </span>
              </label>
            </div>
          ))}
        </div>
      )}

      {/* ── The matrix ─────────────────────────────────────────────── */}
      {rowAxis && colCombos.length > 0 && (
        <div className="overflow-x-auto border rounded-lg">
          <table className="w-full text-xs text-left">
            <thead className="bg-gray-100 text-gray-600 border-b">
              <tr>
                <th className="p-2 font-medium">
                  {labelFor(usable, rowAxis)} \ {colAxes.map((g) => labelFor(usable, g)).join(' / ')}
                </th>
                {colCombos.map((combo) => (
                  <th key={combo.join('|')} className="p-2 font-medium whitespace-nowrap">
                    {combo
                      .map((id, k) => groupOptions(usable.find((g) => g.id === colAxes[k])!).find((o) => o.id === id)?.name ?? id)
                      .join(' / ')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groupOptions(usable.find((g) => g.id === rowAxis)!).map((rowOpt) => (
                <tr key={rowOpt.id} className="border-b last:border-0 bg-white">
                  <td className="p-2 font-semibold text-gray-800 whitespace-nowrap">{rowOpt.name}</td>
                  {colCombos.map((combo) => {
                    const key = [rowOpt.id, ...combo].join(COMBO_KEY_SEP);
                    return (
                      <td key={key} className="p-2">
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={draft?.map[key] ?? ''}
                          placeholder="—"
                          onChange={(e) => setCell(rowOpt.id, combo, e.target.value)}
                          className="w-20 rounded border border-gray-300 px-2 py-1 text-gray-800 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30"
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-gray-500">
        {axisCount > 0 && (
          <>
            {filled} of {cellCount} cells filled. A blank cell is treated as unknown and falls
            back to today's price — it is never read as free. If a pot costs the same at every
            size, type it in each cell.
          </>
        )}
      </p>

      {/* ── Migration from price_map ───────────────────────────────── */}
      {existingPriceMap && Object.keys(existingPriceMap).length > 0 && axisCount > 0 && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900 space-y-2">
          <p>
            This product already has a per-combination price table with{' '}
            {Object.keys(existingPriceMap).length} values. Those can be projected onto this grid
            automatically — no retyping.
          </p>
          <button
            type="button"
            onClick={runMigration}
            disabled={migrating}
            className="rounded-lg bg-blue-600 px-3 py-1.5 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {migrating ? 'Building…' : 'Build grid from existing prices'}
          </button>
          {projectionError && (
            <p className="rounded border border-red-300 bg-red-50 px-2 py-1.5 font-semibold text-red-800">
              {projectionError}
            </p>
          )}
        </div>
      )}

      {conflicts.length > 0 && (
        <div className="rounded-lg border-2 border-amber-400 bg-amber-50 p-3 text-xs text-amber-900 space-y-2">
          <p className="font-semibold">
            {conflicts.length} cell{conflicts.length > 1 ? 's' : ''} disagree, so nothing was
            filled in automatically.
          </p>
          <p>The same selection has different values in the existing table. Choose which to keep:</p>
          {conflicts.map((c) => (
            <div key={c.key} className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{c.label}</span>
              {c.values.map((v) => (
                <label key={v} className="inline-flex items-center gap-1">
                  <input
                    type="radio"
                    name={`resolve-${c.key}`}
                    checked={resolutions[c.key] === v}
                    onChange={() => setResolutions((p) => ({ ...p, [c.key]: v }))}
                  />
                  <span>₹{v}</span>
                </label>
              ))}
            </div>
          ))}
          <button
            type="button"
            disabled={Object.keys(resolutions).length !== conflicts.length}
            onClick={applyResolutions}
            className="rounded-lg bg-amber-600 px-3 py-1.5 font-semibold text-white hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Apply choices
          </button>
        </div>
      )}

      {/* ── price_map shadowing ────────────────────────────────────── */}
      {priceMapActive && (
        <div className="rounded-lg border-2 border-amber-400 bg-amber-50 p-3 text-xs text-amber-900 space-y-1">
          <p className="font-semibold">
            This product still has an old per-combination price table, which overrides this grid.
          </p>
          <p>
            Saving clears that table for good, so the grid becomes the only thing setting the
            price. If you have not moved its values into the grid yet, build it from the
            existing prices first — otherwise those combinations will drop to the base price.
          </p>
        </div>
      )}
    </div>
  );
}
