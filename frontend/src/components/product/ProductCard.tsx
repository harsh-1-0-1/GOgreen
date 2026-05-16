import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useCartStore } from '@/store/cartStore';
import ProductTagBadges from '@/components/product/ProductTagBadges';
import type { Product } from '@/types';

export default function ProductCard({ product }: { product: Product }) {
  const addItem = useCartStore((s) => s.addItem);

  const discount =
    product.original_price && product.original_price > product.price
      ? Math.round(((product.original_price - product.price) / product.original_price) * 100)
      : null;

  async function handleAdd(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
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
      className="group bg-white rounded-xl sm:rounded-2xl border border-gray-100 overflow-hidden hover:shadow-lg transition-shadow duration-300 flex flex-col h-full"
    >
      <div className="relative aspect-[4/3] sm:aspect-square overflow-hidden bg-gray-50">
        <img
          src={product.images?.[0] || 'https://placehold.co/400x400?text=Plant'}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />
        {discount && (
          <span className="absolute top-2 left-2 sm:top-3 sm:left-3 bg-accent text-white text-[10px] sm:text-xs font-bold px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full">
            {discount}% OFF
          </span>
        )}
        {product.badge && (
          <span className="absolute top-2 right-2 sm:top-3 sm:right-3 bg-primary text-white text-[10px] sm:text-xs font-medium px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full">
            {product.badge}
          </span>
        )}
      </div>

      <div className="p-2.5 sm:p-4 flex-1 flex flex-col">
        <h3 className="text-xs sm:text-sm font-medium line-clamp-1 group-hover:text-primary transition-colors">
          {product.name}
        </h3>

        <ProductTagBadges tags={product.tags} maxTags={2} size="sm" className="mt-1.5 sm:mt-2" />

        <div className="flex items-baseline gap-1.5 sm:gap-2 mt-1.5 sm:mt-2">
          <span className="text-primary font-bold text-sm sm:text-base">₹{product.price}</span>
          {product.original_price && product.original_price > product.price && (
            <span className="text-[10px] sm:text-xs text-gray-400 line-through">
              ₹{product.original_price}
            </span>
          )}
        </div>

        {product.stock_qty <= 5 && product.stock_qty > 0 && (
          <p className="text-[10px] sm:text-xs text-red-500 mt-0.5 sm:mt-1">Only {product.stock_qty} left!</p>
        )}
        {product.stock_qty === 0 && (
          <p className="text-[10px] sm:text-xs text-red-500 mt-0.5 sm:mt-1 font-medium">Out of Stock</p>
        )}

        <div className="mt-auto pt-3">
          <button
            onClick={handleAdd}
            className="w-full py-2.5 rounded-lg text-sm font-semibold text-white transition active:scale-[0.98] hover:opacity-90"
            style={{ backgroundColor: '#16A34A' }}
          >
            Add to cart
          </button>
        </div>
      </div>
    </Link>
  );
}
