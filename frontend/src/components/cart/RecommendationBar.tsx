import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { useProducts } from '@/hooks/useProducts';
import { useCartStore } from '@/store/cartStore';
import { getRecommendedProducts } from '@/lib/recommendations';
import type { Product, CartItem } from '@/types';

interface RecommendationBarProps {
  lastAddedProduct: Product;
  cartItems: CartItem[];
}

export default function RecommendationBar({ lastAddedProduct, cartItems }: RecommendationBarProps) {
  const addItem = useCartStore((s) => s.addItem);
  const navigate = useNavigate();
  const [addingId, setAddingId] = useState<number | null>(null);

  // Fetch a broad pool — same category, limit 20
  const { data } = useProducts({
    limit: 20,
    category_slug: undefined, // fetch broadly to have enough candidates
  });

  const recommendations = data?.items
    ? getRecommendedProducts(lastAddedProduct, data.items, cartItems, 4)
    : [];

  if (recommendations.length === 0) return null;

  async function handleQuickAdd(e: React.MouseEvent, product: Product) {
    e.preventDefault();
    e.stopPropagation();
    if (product.variants?.colors?.length && product.variants?.pot_types?.length) {
      navigate(`/products/${product.slug}`);
      return;
    }
    setAddingId(product.id);
    try {
      await addItem(product.id, 1, product);
      toast.success(`${product.name} added!`);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to add');
    } finally {
      setAddingId(null);
    }
  }

  return (
    <div className="px-1 py-3 border-t border-dashed border-gray-200 bg-gradient-to-b from-[#f0fdf4]/60 to-white">
      {/* Heading */}
      <div className="flex items-center gap-1.5 mb-2.5 px-1">
        <Sparkles size={13} className="text-[#16A34A]" />
        <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500">
          Complete your green space
        </p>
      </div>

      {/* Horizontal scroll strip */}
      <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-none snap-x snap-mandatory">
        {recommendations.map((product) => (
          <Link
            key={product.id}
            to={`/products/${product.slug}`}
            className="group shrink-0 snap-start w-[115px] bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-md hover:border-green-200 transition-all duration-200 flex flex-col"
          >
            {/* Image */}
            <div className="relative w-full aspect-square overflow-hidden bg-gray-50">
              <img
                src={product.images?.[0] || 'https://placehold.co/120x120?text=Plant'}
                alt={product.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
              />
              {product.original_price && product.original_price > product.price && (
                <span className="absolute top-1 left-1 text-[9px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded-full leading-none">
                  {Math.round(((product.original_price - product.price) / product.original_price) * 100)}% OFF
                </span>
              )}
            </div>

            {/* Info */}
            <div className="p-2 flex flex-col flex-1">
              <p className="text-[11px] font-medium text-gray-800 line-clamp-2 leading-tight mb-1">
                {product.name}
              </p>
              <p className="text-[11px] font-bold text-[#16A34A] mb-2">₹{product.price}</p>

              {/* Quick Add button */}
              <button
                onClick={(e) => handleQuickAdd(e, product)}
                disabled={addingId === product.id}
                className="mt-auto flex items-center justify-center gap-1 w-full py-1.5 rounded-lg text-[11px] font-semibold text-white transition-all active:scale-95 disabled:opacity-60"
                style={{ backgroundColor: '#16A34A' }}
                aria-label={`Add ${product.name} to cart`}
              >
                {addingId === product.id ? (
                  <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Plus size={11} strokeWidth={2.5} />
                    {product.variants?.colors?.length && product.variants?.pot_types?.length ? 'Options' : 'Add'}
                  </>
                )}
              </button>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
