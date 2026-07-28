/**
 * Utilities for displaying variant selections in cart, checkout, and order history.
 *
 * Supports both:
 * - New format: string[] of option IDs → look up from product.variants.variant_groups
 * - New format with snapshot: {option_ids, snapshot:[{label, name, price}]} → use snapshot directly
 * - Old format: Record<string, string> (color/pot_type/size slugs) → kept for backward compat
 */

import type { SelectedOptions } from '@/types';

export interface DisplayOption {
  label: string;
  name: string;
}

/**
 * Resolve selected_options into human-readable {label, name} pairs for display.
 * Works for all formats.
 */
export function resolveSelectedOptions(
  selectedOptions: SelectedOptions,
  productVariants: any,
): DisplayOption[] {
  if (!selectedOptions) return [];

  // Format: {option_ids, snapshot} — use denormalized snapshot directly (order history)
  if (
    typeof selectedOptions === 'object' &&
    !Array.isArray(selectedOptions) &&
    'snapshot' in selectedOptions &&
    Array.isArray((selectedOptions as any).snapshot)
  ) {
    return (selectedOptions as any).snapshot.map((s: any) => ({
      label: s.label || '',
      name: s.name || '',
    }));
  }

  // New format: string[] of option IDs
  if (Array.isArray(selectedOptions)) {
    const groups: any[] = productVariants?.variant_groups ?? [];
    const results: DisplayOption[] = [];
    for (const group of groups) {
      for (const opt of group.options ?? []) {
        if (selectedOptions.includes(opt.id)) {
          results.push({ label: group.label, name: opt.name });
        }
      }
    }
    return results;
  }

  // Old format: Record<string, string> — color/pot_type/size slugs
  if (typeof selectedOptions === 'object') {
    const opts = selectedOptions as Record<string, string>;
    const results: DisplayOption[] = [];
    if (opts.color) results.push({ label: 'Colour', name: opts.color });
    if (opts.pot_type) results.push({ label: 'Pot', name: opts.pot_type });
    if (opts.size) results.push({ label: 'Size', name: opts.size });
    return results;
  }

  return [];
}

/**
 * Format resolved options as a single compact string.
 * e.g. "Select Size: 4 Inch · Select Colour: Terracotta"
 */
export function formatSelectedOptions(
  selectedOptions: SelectedOptions,
  productVariants: any,
): string {
  const resolved = resolveSelectedOptions(selectedOptions, productVariants);
  if (!resolved.length) return '';
  return resolved.map((o) => `${o.label}: ${o.name}`).join(' · ');
}
