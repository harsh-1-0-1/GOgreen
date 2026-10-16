/**
 * Pot/component price grid resolution.
 *
 * N-axis by construction: nothing here knows how many groups there are, or what they are
 * called. `groupIds` is the admin-selected axis list and the map keys are one option id per
 * entry, so a two-axis size × pot grid and a three-axis grid run the same code.
 *
 * This is the client half of a rule that also exists in
 * `backend/app/utils/variant_pricing.py::resolve_pot_price`. The two must stay equivalent —
 * they are two hand-written implementations of one spec with no shared test, so a divergence
 * means the storefront advertises one price and checkout charges another. Any change here
 * needs the same change there (phase 4 asserts they agree).
 */

import type { PotPrice } from '../types';

/** Joiner for every variant key space. Matches the backend constant. */
export const COMBO_KEY_SEP = '__';

/** A resolved grid cell: `exact` means min === max, so render one number. */
export interface PotPriceResolution {
  min: number;
  max: number;
  exact: boolean;
}

export type SelectedOptions = Record<string, string>;

function isFiniteNumber(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

/**
 * Build the canonical grid key for a selection over `groupIds`.
 * Returns null if any axis is unselected — a partial selection has no single correct key.
 */
export function buildPotPriceKey(
  groupIds: string[],
  selected: SelectedOptions,
): string | null {
  if (groupIds.length === 0) return null;
  const parts: string[] = [];
  for (const gid of groupIds) {
    const optId = selected[gid];
    if (!optId) return null;
    parts.push(optId);
  }
  return parts.join(COMBO_KEY_SEP);
}

/**
 * Resolve the grid to a single value or a range.
 *
 * Scans every cell consistent with whatever IS selected, so fewer than N selections yields
 * the range of what the customer could pay rather than a guess. Returns null when nothing
 * matches (empty grid, or a selection inconsistent with every cell) — callers must treat
 * that as "unknown" and fall through, never as zero.
 */
export function resolvePotPrice(
  groupIds: string[],
  map: Record<string, number> | null | undefined,
  selected: SelectedOptions,
): PotPriceResolution | null {
  if (groupIds.length === 0 || !map) return null;

  const activeIdx: number[] = [];
  for (let i = 0; i < groupIds.length; i++) {
    if (selected[groupIds[i]]) activeIdx.push(i);
  }
  if (activeIdx.length === 0) return null;

  let min = Infinity;
  let max = -Infinity;
  for (const [key, raw] of Object.entries(map)) {
    const parts = key.split(COMBO_KEY_SEP);
    // Defensive: a full-combo key from price_map/stock_map can never resolve here. Silently
    // ignoring is correct — those keys mean something else entirely.
    if (parts.length !== groupIds.length) continue;
    if (!activeIdx.every((i) => parts[i] === selected[groupIds[i]])) continue;
    const n = Number(raw);
    if (!isFiniteNumber(n)) continue;
    if (n < min) min = n;
    if (n > max) max = n;
  }
  return min === Infinity ? null : { min, max, exact: min === max };
}

/** The resolved value for one specific option of one specific grid group, holding the other
 *  axes at their current selection. This is what a single card needs to display. */
export function potPriceForOption(
  groupIds: string[],
  map: Record<string, number> | null | undefined,
  selected: SelectedOptions,
  groupId: string,
  optionId: string,
): PotPriceResolution | null {
  if (!groupIds.includes(groupId)) return null;
  return resolvePotPrice(groupIds, map, { ...selected, [groupId]: optionId });
}

/** Format a resolution for display. `+₹X` when exact, `+₹min–₹max` when ranged — the `+`
 *  is load-bearing: it marks a component, so a bare `₹200` can't be misread as the total. */
export function formatPotPrice(r: PotPriceResolution | null): string | null {
  if (!r) return null;
  if (r.exact) return `+₹${r.min}`;
  return `+₹${r.min}–₹${r.max}`;
}

/** The resolved pot amount as a number, or null when it is not exactly determined.
 *  Under `additive` a ranged value must never be charged, so callers that need a number
 *  (not a label) must use this and handle null by falling through. */
export function exactPotPrice(
  groupIds: string[],
  map: Record<string, number> | null | undefined,
  selected: SelectedOptions,
): number | null {
  const r = resolvePotPrice(groupIds, map, selected);
  if (!r || !r.exact) return null;
  return r.min;
}

/** The groups whose `options[].price` deltas this grid already prices, and which are
 *  therefore EXCLUDED from the additive sum. */
export function gridGroupIds(potPrice: PotPrice | null | undefined): string[] {
  return potPrice?.group_ids ?? [];
}
