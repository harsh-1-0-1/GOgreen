import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import { useProducts } from '@/hooks/useProducts';
import { useCartStore } from '@/store/cartStore';
import ProductTagBadges from '@/components/product/ProductTagBadges';
import { getApiErrorDetail } from '@/lib/apiError';
import type { DisplaySection, Product } from '@/types';

const SECONDARY = '#16A34A';
const LIMIT = 8;

const DEFAULT_DISCOUNT_COLOR = '#1B4332';
const DEFAULT_BESTSELLER_COLOR = '#F59E0B';
const DEFAULT_RATING_COLOR = '#1B4332';

function ProductTile({ product }: { product: Product }) {
  const addItem = useCartStore((s) => s.addItem);
  const navigate = useNavigate();
  const hasVariants = Boolean(
    (product.variants?.variant_groups?.length ?? 0) > 0,
  );

  const discount =
    product.original_price && product.original_price > product.price
      ? Math.round(
          ((product.original_price - product.price) / product.original_price) * 100,
        )
      : null;

  const discountBadgeBg = product.discount_badge_color || DEFAULT_DISCOUNT_COLOR;
  const bestsellerBadgeBg = product.bestseller_badge_color || DEFAULT_BESTSELLER_COLOR;
  const ratingBadgeBg = product.rating_badge_color || DEFAULT_RATING_COLOR;
  const showRating = (product.review_count ?? 0) > 0 && product.avg_rating != null;

  async function handleAdd(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (hasVariants) {
      navigate(`/products/${product.slug}`);
      return;
    }
    try {
      await addItem(product.id, 1, product);
      toast.success(`${product.name} added to cart`);
    } catch (err) {
      toast.error(getApiErrorDetail(err, 'Failed to add'));
    }
  }

  return (
    <Link
      to={`/products/${product.slug}`}
      className="group flex flex-col h-full bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-md transition-shadow"
    >
      <div className="relative aspect-square overflow-hidden bg-gray-50">
        {product.images?.[0] ? (
          <img
            src={product.images?.[0]}
            alt={product.name}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full bg-gray-100" />
        )}

        {/* ── Image overlay badges ─────────────────────────────────────── */}

        {/* Discount badge — top-left */}
        {discount !== null && discount > 0 && (
          <span
            className="absolute top-0 left-0 text-white text-[9px] sm:text-[10px] font-bold px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-br-xl shadow-sm whitespace-nowrap leading-none flex items-center justify-center z-10"
            style={{ backgroundColor: discountBadgeBg }}
          >
            {discount}% OFF
          </span>
        )}

        {/* BESTSELLER badge — top-right */}
        {product.is_bestseller && (
          <span
            className="absolute top-0 right-0 text-white text-[9px] sm:text-[10px] font-bold px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-bl-xl shadow-sm whitespace-nowrap leading-none flex items-center justify-center z-10"
            style={{ backgroundColor: bestsellerBadgeBg }}
          >
            BESTSELLER
          </span>
        )}

        {/* Rating badge — bottom-left */}
        {showRating && (
          <span
            className="absolute bottom-0 left-0 text-white text-[9px] sm:text-[10px] font-bold px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-tr-xl shadow-sm leading-none flex items-center gap-1 z-10"
            style={{ backgroundColor: ratingBadgeBg }}
          >
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
          </span>
        )}
      </div>

      <div className="flex flex-col flex-1 px-3 sm:px-4 pt-3 pb-3 sm:pb-4 gap-1.5">
        <h3 className="text-sm sm:text-base font-medium text-gray-800 line-clamp-2 leading-snug">
          {product.name}
        </h3>

        <ProductTagBadges tags={product.tags} maxTags={2} size="sm" />

        <div className="flex items-baseline gap-2 mt-0.5">
          <span
            className="text-base sm:text-lg font-semibold"
            style={{ color: SECONDARY }}
          >
            {hasVariants && (
              <span className="text-xs font-normal text-gray-500 mr-0.5">from</span>
            )}
            ₹{product.price}
          </span>
          {product.original_price &&
            product.original_price > product.price && (
              <span className="text-xs sm:text-sm text-gray-400 line-through">
                ₹{product.original_price}
              </span>
            )}
        </div>

        {product.stock_qty === 0 ? (
          <button
            type="button"
            disabled
            className="mt-auto w-full py-2.5 rounded-lg text-sm font-semibold bg-gray-100 text-gray-400 cursor-not-allowed"
          >
            Out of Stock
          </button>
        ) : (
          <button
            type="button"
            onClick={handleAdd}
            className="mt-auto w-full py-2.5 rounded-lg text-sm font-semibold text-white transition active:scale-[0.98] hover:opacity-90"
            style={{ backgroundColor: SECONDARY }}
          >
            Add to cart
          </button>
        )}
      </div>
    </Link>
  );
}

function GridSkeleton({ count = LIMIT }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col bg-white rounded-2xl border border-gray-100 overflow-hidden"
        >
          <div className="aspect-square bg-gray-100 animate-pulse" />
          <div className="px-3 sm:px-4 py-3 sm:py-4 space-y-2">
            <div className="h-4 w-3/4 bg-gray-100 rounded animate-pulse" />
            <div className="h-4 w-1/3 bg-gray-100 rounded animate-pulse" />
            <div className="h-9 w-full bg-gray-100 rounded-lg animate-pulse" />
          </div>
        </div>
      ))}
    </>
  );
}

export default function DisplaySectionBlock({ section }: { section: DisplaySection }) {
  const { data, isLoading } = useProducts({
    display_section: section.key,
    limit: LIMIT,
  });
  const products = data?.items ?? [];

  if (!isLoading && products.length === 0) return null;

  const viewAllHref = `/products?display_section=${encodeURIComponent(section.key)}&collection_title=${encodeURIComponent(section.name)}`;

  return (
    <section className="w-full py-8 sm:py-10 bg-white">
      <div className="mx-auto px-4 sm:px-6 lg:px-10 xl:px-16 max-w-7xl">
        <div className="mb-5 sm:mb-6">
          <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-black">
            {section.name}
          </h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
          {isLoading ? (
            <GridSkeleton />
          ) : (
            products.map((p) => <ProductTile key={p.id} product={p} />)
          )}
        </div>

        <div className="mt-8 flex justify-center">
          <Link
            to={viewAllHref}
            className="px-6 py-2.5 rounded-lg text-sm font-semibold border-2 transition-colors hover:text-white"
            style={{ borderColor: SECONDARY, color: SECONDARY }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = SECONDARY;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
            }}
          >
            View all {section.name} →
          </Link>
        </div>
      </div>
    </section>
  );
}
