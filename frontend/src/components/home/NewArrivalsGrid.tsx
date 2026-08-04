import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

import { useProducts } from '@/hooks/useProducts';
import { useCartStore } from '@/store/cartStore';
import ProductTagBadges from '@/components/product/ProductTagBadges';
import { getApiErrorDetail } from '@/lib/apiError';
import type { Product } from '@/types';

const SECONDARY = '#16A34A';

function ProductTile({ product }: { product: Product }) {
  const addItem = useCartStore((s) => s.addItem);
  const navigate = useNavigate();
  const hasVariants = Boolean(
    (product.variants?.variant_groups?.length ?? 0) > 0,
  );

  const discount =
    product.original_price && product.original_price > product.price
      ? Math.round(
          ((product.original_price - product.price) / product.original_price) *
            100,
        )
      : null;

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
        <img
          src={
            product.images?.[0] ||
            'https://placehold.co/400x400?text=Plant'
          }
          alt={product.name}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        {discount !== null && discount > 0 && (
          <span className="absolute top-0 left-0 bg-[#1B4332] text-white text-[9px] sm:text-[10px] font-bold px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-br-xl shadow-sm whitespace-nowrap leading-none flex items-center justify-center z-10">
            {discount}% OFF
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
            {hasVariants && <span className="text-xs font-normal text-gray-500 mr-0.5">from</span>}
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

function GridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col bg-white rounded-2xl border border-gray-100 overflow-hidden"
        >
          <div className="aspect-square bg-gray-100 animate-pulse" />
          <div className="px-3 sm:px-4 pt-3 pb-3 sm:pb-4 space-y-2">
            <div className="h-4 w-3/4 bg-gray-100 rounded animate-pulse" />
            <div className="h-4 w-1/3 bg-gray-100 rounded animate-pulse" />
            <div className="h-9 w-full bg-gray-100 rounded-lg animate-pulse mt-2" />
          </div>
        </div>
      ))}
    </>
  );
}

export default function NewArrivalsGrid({
  title = 'New Arrivals',
  subtitle,
  limit = 15,
}: {
  title?: string;
  subtitle?: string;
  limit?: number;
}) {
  const [showAll, setShowAll] = useState(false);
  const { data, isLoading } = useProducts({ limit, sort_by: 'newest' });
  const products = data?.items ?? [];

  if (!isLoading && products.length === 0) return null;

  const visibleProducts = showAll ? products : products.slice(0, 6);

  return (
    <section className="w-full py-8 sm:py-10 bg-white">
      <div className="mx-auto px-4 sm:px-6 lg:px-10 xl:px-16 max-w-7xl">
        <div className="mb-5 sm:mb-6">
          <h2
            className="text-xl sm:text-2xl lg:text-3xl font-bold"
            style={{ color: '#000000' }}
          >
            {title}
          </h2>
          {subtitle && (
            <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
          {isLoading ? (
            <GridSkeleton count={6} />
          ) : (
            visibleProducts.map((p) => <ProductTile key={p.id} product={p} />)
          )}
        </div>

        {!isLoading && products.length > 6 && !showAll && (
          <div className="mt-8 flex justify-center">
            <button
              onClick={() => setShowAll(true)}
              className="px-6 py-2.5 rounded-lg text-sm font-semibold border-2 transition-colors hover:text-white"
              style={{ borderColor: SECONDARY, color: SECONDARY }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = SECONDARY; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
            >
              View all new arrivals
            </button>
          </div>
        )}
        {(!isLoading && (products.length <= 6 || showAll)) && (
          <div className="mt-8 flex justify-center">
            <Link
              to={`/products?sort_by=newest&collection_title=${encodeURIComponent(title)}`}
              className="px-6 py-2.5 rounded-lg text-sm font-semibold border-2 transition-colors hover:text-white"
              style={{ borderColor: SECONDARY, color: SECONDARY }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = SECONDARY; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
            >
              View all {title} →
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
