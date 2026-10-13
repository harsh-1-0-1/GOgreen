import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useCartStore } from '@/store/cartStore';
import ProductTagBadges from '@/components/product/ProductTagBadges';
import ProductImageBadges from '@/components/product/ProductImageBadges';
import { getApiErrorDetail } from '@/lib/apiError';
import type { Product } from '@/types';

const SECONDARY = '#16A34A';

export default function ProductCard({ product }: { product: Product }) {
  const addItem = useCartStore((s) => s.addItem);
  const navigate = useNavigate();
  const hasVariants = Boolean(
    (product.variants?.variant_groups?.length ?? 0) > 0,
  );
  // For stock-display purposes the meaningful distinction is whether there are
  // multiple variant groups. With 0 or 1 group, stock_qty is exact:
  //   0 groups → simple product, stock_qty is the literal count.
  //   1 group  → min([sum of that group]) = sum = total units across all options,
  //              still an exact count for the product (e.g. "12 plants total across sizes").
  // With 2+ groups, stock_qty = min(group sums) — a transportation-problem ceiling
  // that can diverge from any individual combo's real availability, so showing
  // the number as a per-item count would be misleading.
  const variantGroupCount: number = product.variants?.variant_groups?.length ?? 0;
  const stockQtyIsExact = variantGroupCount <= 1;

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
      className="group flex flex-col h-full bg-white rounded-2xl sm:rounded-2xl border border-gray-100 overflow-hidden hover:shadow-lg sm:hover:shadow-lg transition-shadow duration-300"
    >
      {/* ── Image ─────────────────────────────────────────────────────────── */}
      {/*
        Mobile  → aspect-square  (matches TrendingNow ProductTile)
        Desktop → aspect-square  (already square on sm+)
      */}
      <div className="relative aspect-square overflow-hidden bg-gray-50">
        {product.images?.[0] ? (
          <img
            src={product.images?.[0]}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-gray-100" />
        )}

        <ProductImageBadges product={product} />
      </div>

      {/* ── Content ───────────────────────────────────────────────────────── */}
      {/*
        Mobile padding  → px-3 pt-3 pb-3  (matches ProductTile)
        Desktop padding → p-4
      */}
      <div className="flex flex-col flex-1 px-3 pt-2 pb-3 sm:px-4 sm:pt-3 sm:pb-4 gap-1">

        {/* Product name — no forced min-height so name flows naturally */}
        <h3 className="text-sm font-medium leading-snug text-gray-800 line-clamp-2 group-hover:text-primary transition-colors">
          {product.name}
        </h3>

        {/* Price row */}
        <div className="flex items-baseline gap-1.5 sm:gap-2">
          <span
            className="font-semibold sm:font-bold text-base sm:text-lg"
            style={{ color: SECONDARY }}
          >
            {hasVariants && <span className="text-xs font-normal text-gray-500 mr-0.5">from</span>}
            ₹{product.price}
          </span>
          {product.original_price && product.original_price > product.price && (
            <span className="text-xs text-gray-400 line-through">
              ₹{product.original_price}
            </span>
          )}
        </div>

        {/* Low-stock / out-of-stock notice */}
        {product.stock_qty <= 5 && product.stock_qty > 0 && stockQtyIsExact && (
          <p className="text-xs text-red-500">Only {product.stock_qty} left!</p>
        )}
        {product.stock_qty <= 5 && product.stock_qty > 0 && !stockQtyIsExact && (
          <p className="text-xs text-amber-600">Low stock</p>
        )}
        {product.stock_qty === 0 && (
          <p className="text-xs text-red-500 font-medium">Out of Stock</p>
        )}

        {/* Spacer to push tags and button to bottom */}
        <div className="flex-1" />

        {/* Tag badges — always visible, directly above the button */}
        <ProductTagBadges tags={product.tags} maxTags={2} size="sm" />

        {/* Add-to-cart / Out-of-stock button */}
        {product.stock_qty === 0 ? (
          <button
            type="button"
            disabled
            className="w-full py-2.5 rounded-lg text-sm font-semibold bg-gray-100 text-gray-400 cursor-not-allowed"
          >
            Out of Stock
          </button>
        ) : (
          <button
            type="button"
            onClick={handleAdd}
            className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition active:scale-[0.98] hover:opacity-90"
            style={{ backgroundColor: SECONDARY }}
          >
            {hasVariants ? 'Choose options' : 'Add to cart'}
          </button>
        )}
      </div>
    </Link>
  );
}
