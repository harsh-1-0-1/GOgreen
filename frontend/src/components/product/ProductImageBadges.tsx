import { resolveCategoryBadgeConfig, useBadgeConfigs } from '@/hooks/useBadgeConfigs';
import type { Product } from '@/types';

interface ProductImageBadgesProps {
  product: Product;
}

/**
 * The badges drawn on top of a product image: discount (auto), bestseller
 * (opt-in per product) and rating (auto).
 *
 * Which badges appear and what they look like is configured per category in the
 * admin — this component only resolves the config for the product's primary
 * category and draws it. Kept in one place because the card grid, the homepage
 * display sections and the product tile all need identical badges.
 */
export default function ProductImageBadges({ product }: ProductImageBadgesProps) {
  const { data } = useBadgeConfigs();
  const config = resolveCategoryBadgeConfig(data, product.category_id);

  const discount =
    product.original_price && product.original_price > product.price
      ? Math.round(((product.original_price - product.price) / product.original_price) * 100)
      : null;

  const showDiscount = config.discount.enabled && discount !== null && discount > 0;
  const showBestseller = config.bestseller.enabled && Boolean(product.is_bestseller);
  const showRating =
    config.rating.enabled && (product.review_count ?? 0) > 0 && product.avg_rating != null;

  if (!showDiscount && !showBestseller && !showRating) return null;

  return (
    <>
      {/* Discount badge — top-left */}
      {showDiscount && (
        <span
          className="absolute top-0 left-0 text-white text-[9px] sm:text-[10px] font-bold px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-br-xl shadow-sm whitespace-nowrap leading-none flex items-center justify-center z-10"
          style={{ backgroundColor: config.discount.color }}
        >
          {config.discount.label || `${discount}% OFF`}
        </span>
      )}

      {/* Bestseller badge — top-right (wording set per category) */}
      {showBestseller && (
        <span
          className="absolute top-0 right-0 text-white text-[9px] sm:text-[10px] font-bold px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-bl-xl shadow-sm whitespace-nowrap leading-none flex items-center justify-center z-10"
          style={{ backgroundColor: config.bestseller.color }}
        >
          {config.bestseller.label || 'BESTSELLER'}
        </span>
      )}

      {/* Rating badge — bottom-left (star + avg rating + review count) */}
      {showRating && (
        <span
          className="absolute bottom-0 left-0 text-white text-[9px] sm:text-[10px] font-bold px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-tr-xl shadow-sm leading-none flex items-center gap-1 z-10"
          style={{ backgroundColor: config.rating.color }}
        >
          {config.rating.label ? (
            config.rating.label
          ) : (
            <>
              <svg
                viewBox="0 0 20 20"
                fill="currentColor"
                className="w-2.5 h-2.5 sm:w-3 sm:h-3 shrink-0"
                aria-hidden="true"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              {product.avg_rating?.toFixed(1)}
              <span className="opacity-80">| {product.review_count}</span>
            </>
          )}
        </span>
      )}
    </>
  );
}