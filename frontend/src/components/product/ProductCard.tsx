import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useCartStore } from '@/store/cartStore';
import ProductTagBadges from '@/components/product/ProductTagBadges';
import type { Product } from '@/types';

const SECONDARY = '#16A34A';

export default function ProductCard({ product }: { product: Product }) {
  const addItem = useCartStore((s) => s.addItem);
  const navigate = useNavigate();
  const hasVariants = Boolean(
    (product.variants?.colors?.length && product.variants?.pot_types?.length)
    || product.variants?.sizes?.length,
  );

  const discount =
    product.original_price && product.original_price > product.price
      ? Math.round(((product.original_price - product.price) / product.original_price) * 100)
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
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to add');
    }
  }

  return (
    <Link
      to={`/products/${product.slug}`}
      className="group flex flex-col h-full bg-white rounded-2xl sm:rounded-2xl border border-gray-100 overflow-hidden hover:shadow-lg sm:hover:shadow-lg transition-shadow duration-300"
    >
      {/* ── Image ─────────────────────────────────────────────────────────── */}
      {/*
        Mobile  → aspect-square  (matches TrendingNow ProductTile)
        Desktop → aspect-square  (already square on sm+)
      */}
      <div className="relative aspect-square overflow-hidden bg-gray-50">
        <img
          src={product.images?.[0] || 'https://placehold.co/400x400?text=Plant'}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />

        {/* Discount badge — identical to ProductTile */}
        {discount !== null && discount > 0 && (
          <span className="absolute top-0 left-0 bg-[#1B4332] text-white text-[9px] sm:text-[10px] font-bold px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-br-xl shadow-sm whitespace-nowrap leading-none flex items-center justify-center z-10">
            {discount}% OFF
          </span>
        )}

        {/* Named badge — hidden on mobile to match TrendingNow, visible sm+ */}
        {product.badge && (
          <span className="hidden sm:inline-block absolute top-3 right-3 bg-primary text-white text-xs font-medium px-2.5 py-1 rounded-full">
            {product.badge}
          </span>
        )}
      </div>

      {/* ── Content ───────────────────────────────────────────────────────── */}
      {/*
        Mobile padding  → px-3 pt-3 pb-3  (matches ProductTile)
        Desktop padding → p-4
      */}
      <div className="flex flex-col flex-1 px-3 pt-3 pb-3 sm:p-4 gap-1.5">

        {/* Product name
            Mobile  → text-sm, line-clamp-2           (ProductTile)
            Desktop → text-sm, min-h for two lines
        */}
        <h3 className="text-sm font-medium leading-snug text-gray-800 line-clamp-2 sm:min-h-[2.5rem] group-hover:text-primary transition-colors">
          {product.name}
        </h3>

        {/* Tag badges */}
        <ProductTagBadges tags={product.tags} maxTags={2} size="sm" />

        {/* Price row
            Mobile  → text-base, font-semibold, color #16A34A  (ProductTile)
            Desktop → text-base, font-bold,      color primary
        */}
        <div className="flex items-baseline gap-1.5 sm:gap-2 mt-0.5">
          <span
            className="font-semibold sm:font-bold text-base sm:text-base"
            style={{ color: SECONDARY }}
          >
            ₹{product.price}
          </span>
          {product.original_price && product.original_price > product.price && (
            <span className="text-xs text-gray-400 line-through">
              ₹{product.original_price}
            </span>
          )}
        </div>

        {/* Low-stock / out-of-stock notice — hidden on mobile, shown sm+ */}
        {product.stock_qty <= 5 && product.stock_qty > 0 && (
          <p className="hidden sm:block text-xs text-red-500 mt-1">Only {product.stock_qty} left!</p>
        )}
        {product.stock_qty === 0 && (
          <p className="hidden sm:block text-xs text-red-500 mt-1 font-medium">Out of Stock</p>
        )}

        {/* Add-to-cart / Out-of-stock button — identical styling to ProductTile */}
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
            {hasVariants ? 'Choose options' : 'Add to cart'}
          </button>
        )}
      </div>
    </Link>
  );
}
