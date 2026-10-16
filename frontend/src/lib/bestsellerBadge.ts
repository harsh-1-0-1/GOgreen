import type { CategoryBadgeConfig, Product } from '@/types';

/**
 * The wording used when a category has never customised the bestseller badge.
 * Must stay in sync with `DEFAULT_CONFIG` in the backend badge config service.
 */
const BESTSELLER_FALLBACK_LABEL = 'BESTSELLER';

/**
 * Decide the bestseller badge for one product: `null` means "draw nothing".
 *
 * This is the single place the rule lives — the card grid, the homepage display
 * sections, the product tile AND the admin form's live preview all resolve
 * through it, so a second copy could only ever disagree with this one.
 *
 * The order is deliberate:
 *
 * 1. `is_bestseller` is the master switch. Off means off, whatever else is set.
 * 2. A per-product override WINS — including over the category's `enabled`
 *    switch. An admin who wrote a name and a colour for this one product has
 *    decided about this product, and a category-wide switch should not silently
 *    undo it. The admin form warns when this is in play so it never comes as a
 *    surprise.
 * 3. Otherwise the category decides, exactly as it always has.
 *
 * Each half of an override falls back independently, so a rename-only override
 * keeps the category's colour and can never render an empty badge.
 */
export function resolveBestsellerBadge(
  product: Pick<
    Product,
    'is_bestseller' | 'bestseller_label_override' | 'bestseller_color_override'
  >,
  categoryConfig: CategoryBadgeConfig
): { text: string; color: string } | null {
  if (!product.is_bestseller) return null;

  const labelOverride = product.bestseller_label_override?.trim();
  const colorOverride = product.bestseller_color_override?.trim();

  if (labelOverride || colorOverride) {
    return {
      text: labelOverride || categoryConfig.bestseller.label || BESTSELLER_FALLBACK_LABEL,
      color: colorOverride || categoryConfig.bestseller.color,
    };
  }

  if (!categoryConfig.bestseller.enabled) return null;

  return {
    text: categoryConfig.bestseller.label || BESTSELLER_FALLBACK_LABEL,
    color: categoryConfig.bestseller.color,
  };
}
