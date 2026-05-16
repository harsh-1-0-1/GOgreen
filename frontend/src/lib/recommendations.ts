import type { Product, CartItem } from '@/types';

/**
 * Cross-sell tag map: if the added product has any of these tags,
 * products with the paired complement tags are boosted.
 */
const CROSS_SELL_MAP: Record<string, string[]> = {
  // Plants → care accessories
  'indoor':          ['easy-care', 'air-purifying', 'low-maintenance'],
  'outdoor':         ['flowering', 'tropical'],
  'air-purifying':   ['easy-care', 'low-maintenance', 'indoor'],
  'vastu-friendly':  ['lucky', 'indoor', 'flowering'],
  'easy-care':       ['beginner-friendly', 'low-maintenance', 'indoor'],
  'flowering':       ['fragrant', 'tropical', 'outdoor'],
  'tropical':        ['outdoor', 'flowering'],
  'succulent':       ['low-maintenance', 'beginner-friendly'],
  'rare':            ['fragrant', 'flowering'],
  'beginner-friendly': ['easy-care', 'low-maintenance'],
  'low-maintenance': ['beginner-friendly', 'easy-care'],
  'pet-friendly':    ['easy-care', 'indoor'],
  'lucky':           ['vastu-friendly', 'indoor'],
  'fragrant':        ['flowering', 'rare'],
  'modern-decor':    ['indoor', 'air-purifying'],
};

/**
 * Returns up to `maxCount` recommended products given the last-added product
 * and the current cart items, sourced from the full product list.
 */
export function getRecommendedProducts(
  lastAdded: Product,
  allProducts: Product[],
  cartItems: CartItem[],
  maxCount = 4,
): Product[] {
  const cartProductIds = new Set(cartItems.map((i) => i.product_id));

  // Collect complementary tags to target
  const targetTags = new Set<string>();
  for (const tag of lastAdded.tags ?? []) {
    const complements = CROSS_SELL_MAP[tag] ?? [];
    complements.forEach((t) => targetTags.add(t));
  }

  // Score each candidate
  const scored = allProducts
    .filter((p) => p.id !== lastAdded.id && !cartProductIds.has(p.id) && p.is_active)
    .map((p) => {
      const tagOverlap = (p.tags ?? []).filter((t) => targetTags.has(t)).length;
      // Bonus for same category
      const sameCategory = p.category_id === lastAdded.category_id ? 0.5 : 0;
      return { product: p, score: tagOverlap + sameCategory };
    })
    .filter((s) => s.score > 0);

  // Sort by score desc, then fall back to all active products if nothing scored
  const sorted = scored.sort((a, b) => b.score - a.score).map((s) => s.product);

  if (sorted.length >= maxCount) return sorted.slice(0, maxCount);

  // Pad with popular products (same category, not already picked)
  const pickedIds = new Set([lastAdded.id, ...sorted.map((p) => p.id), ...cartProductIds]);
  const fallbacks = allProducts
    .filter((p) => p.is_active && !pickedIds.has(p.id) && p.category_id === lastAdded.category_id)
    .slice(0, maxCount - sorted.length);

  return [...sorted, ...fallbacks].slice(0, maxCount);
}
