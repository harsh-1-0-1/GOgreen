import type { SyntheticEvent } from 'react';
import type { ImageVariantSet } from '@/types';

/**
 * Index product image variant sets by their original URL so a gallery that
 * mixes product images with variant-option images can look up variants by URL.
 */
export function variantLookup(
  sets?: ImageVariantSet[],
): Record<string, ImageVariantSet> {
  const map: Record<string, ImageVariantSet> = {};
  for (const set of sets ?? []) {
    if (set?.original) map[set.original] = set;
  }
  return map;
}

/** `srcset` for the card/detail widths. Undefined when no variants exist. */
export function srcSetFor(set?: ImageVariantSet): string | undefined {
  if (!set) return undefined;
  return `${set.thumb} 400w, ${set.card} 800w, ${set.detail} 1600w`;
}

/** Intrinsic widths for the `{variant: url}` maps (categories, banners). */
const WIDTH_HINTS: Record<string, number> = {
  thumb: 400,
  card: 800,
  detail: 1600,
  w1600: 1600,
  w1920: 1920,
};

/**
 * `srcset` from a `{variant: url}` map (categories/banners). Returns undefined
 * when there is nothing worth choosing between — e.g. external Unsplash URLs,
 * where every variant resolves to the original, so a srcset would be noise.
 */
export function srcSetFromMap(
  sets?: Record<string, string>,
): string | undefined {
  if (!sets) return undefined;
  const parts: string[] = [];
  const urls = new Set<string>();
  for (const [name, url] of Object.entries(sets)) {
    if (name === 'original' || !url) continue;
    const width = WIDTH_HINTS[name];
    if (!width) continue;
    parts.push(`${url} ${width}w`);
    urls.add(url);
  }
  if (parts.length === 0 || urls.size < 2) return undefined;
  return parts.join(', ');
}

/**
 * Swap a broken optimised image back to its original exactly once.
 *
 * When `srcset` is present the browser ignores a changed `src`, so it must be
 * removed first; the `dataset.fellBack` flag stops the error handler from
 * looping if the original is missing too.
 */
export function fallbackOnError(original?: string) {
  return (e: SyntheticEvent<HTMLImageElement>) => {
    const el = e.currentTarget;
    if (!original || el.dataset.fellBack) return;
    el.dataset.fellBack = '1';
    el.removeAttribute('srcset');
    el.src = original;
  };
}
