import { Link } from 'react-router-dom';
import { ShoppingCart } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCartStore } from '@/store/cartStore';
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
      await addItem(product.id);
      toast.success(`${product.name} added to cart`);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to add');
    }
  }

  return (
    <Link
      to={`/products/${product.slug}`}
      className="group bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-lg transition-shadow duration-300"
    >
      <div className="relative aspect-square overflow-hidden bg-gray-50">
        <img
          src={product.images?.[0] || 'https://placehold.co/400x400?text=Plant'}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />
        {discount && (
          <span className="absolute top-3 left-3 bg-accent text-white text-xs font-bold px-2.5 py-1 rounded-full">
            {discount}% OFF
          </span>
        )}
        {product.badge && (
          <span className="absolute top-3 right-3 bg-primary text-white text-xs font-medium px-2.5 py-1 rounded-full">
            {product.badge}
          </span>
        )}
        <button
          onClick={handleAdd}
          className="absolute bottom-3 right-3 w-10 h-10 bg-white rounded-full shadow-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-primary hover:text-white"
          aria-label="Add to cart"
        >
          <ShoppingCart size={16} />
        </button>
      </div>
      <div className="p-4">
        <h3 className="text-sm font-medium line-clamp-1 group-hover:text-primary transition-colors">
          {product.name}
        </h3>
        {product.tags?.length > 0 && (
          <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">
            {product.tags.slice(0, 3).join(' · ')}
          </p>
        )}
        <div className="flex items-baseline gap-2 mt-2">
          <span className="text-primary font-bold">₹{product.price}</span>
          {product.original_price && product.original_price > product.price && (
            <span className="text-xs text-gray-400 line-through">
              ₹{product.original_price}
            </span>
          )}
        </div>
        {product.stock_qty <= 5 && product.stock_qty > 0 && (
          <p className="text-xs text-red-500 mt-1">Only {product.stock_qty} left!</p>
        )}
        {product.stock_qty === 0 && (
          <p className="text-xs text-red-500 mt-1 font-medium">Out of Stock</p>
        )}
      </div>
    </Link>
  );
}
