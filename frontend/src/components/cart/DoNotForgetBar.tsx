import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCartStore } from '@/store/cartStore';
import { useDoNotForgetProducts } from '@/hooks/useDoNotForget';
import { getApiErrorDetail } from '@/lib/apiError';
import type { CartItem } from '@/types';

interface DoNotForgetBarProps {
  cartItems: CartItem[];
}

export default function DoNotForgetBar({ cartItems }: DoNotForgetBarProps) {
  const addItem = useCartStore((s) => s.addItem);
  const navigate = useNavigate();
  const [addingId, setAddingId] = useState<number | null>(null);

  const { data: doNotForgetData } = useDoNotForgetProducts();
  const products = doNotForgetData?.items || [];

  if (products.length === 0) return null;

  async function handleQuickAdd(e: React.MouseEvent, productId: number, productName: string) {
    e.preventDefault();
    e.stopPropagation();

    // Find the full product data
    const doNotForgetItem = products.find((item) => item.product_id === productId);
    if (!doNotForgetItem) return;

    const product = doNotForgetItem.product;

    setAddingId(productId);
    try {
      // Create a full Product object from the do-not-forget product
      const fullProduct = {
        id: product.id,
        name: product.name,
        slug: product.slug,
        price: product.price,
        original_price: product.original_price,
        images: product.images,
        stock_qty: product.stock_qty,
        category_id: 0,
        description: null,
        tags: [],
        care_tips: [],
        how_to_guide: null,
        sunlight: null,
        watering: null,
        badge: null,
        display_section: null,
        is_active: true,
        created_at: new Date().toISOString(),
        variants: null,
      };

      await addItem(productId, 1, fullProduct);
      toast.success(`${productName} added!`);
    } catch (err) {
      toast.error(getApiErrorDetail(err, 'Failed to add'));
    } finally {
      setAddingId(null);
    }
  }

  return (
    <div className="px-1 py-3 border-t border-dashed border-gray-200 bg-gradient-to-b from-amber-50/60 to-white">
      {/* Heading */}
      <div className="flex items-center gap-1.5 mb-2.5 px-1">
        <AlertCircle size={13} className="text-amber-600" />
        <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500">
          Don't forget to buy
        </p>
      </div>

      {/* Horizontal scroll strip */}
      <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-none snap-x snap-mandatory">
        {products.map((item) => (
          <Link
            key={item.id}
            to={`/products/${item.product.slug}`}
            className="group shrink-0 snap-start w-[115px] bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-md hover:border-amber-200 transition-all duration-200 flex flex-col"
          >
            {/* Image */}
            <div className="relative w-full aspect-square overflow-hidden bg-gray-50">
              <img
                src={item.product.images?.[0] || 'https://placehold.co/120x120?text=Plant'}
                alt={item.product.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
              />
              {item.product.original_price && item.product.original_price > item.product.price && (
                <span className="absolute top-1 left-1 text-[9px] font-bold bg-red-500 text-white px-1.5 py-0.5 rounded-full leading-none">
                  {Math.round(
                    ((item.product.original_price - item.product.price) / item.product.original_price) * 100
                  )}% OFF
                </span>
              )}
            </div>

            {/* Info */}
            <div className="p-2 flex flex-col flex-1">
              <p className="text-[11px] font-medium text-gray-800 line-clamp-2 leading-tight mb-1">
                {item.product.name}
              </p>
              <p className="text-[11px] font-bold text-amber-600 mb-2">₹{item.product.price}</p>

              {/* Quick Add button */}
              <button
                onClick={(e) => handleQuickAdd(e, item.product.id, item.product.name)}
                disabled={addingId === item.product.id}
                className="mt-auto flex items-center justify-center gap-1 w-full py-1.5 rounded-lg text-[11px] font-semibold text-white transition-all active:scale-95 disabled:opacity-60"
                style={{ backgroundColor: '#D97706' }}
                aria-label={`Add ${item.product.name} to cart`}
              >
                {addingId === item.product.id ? (
                  <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Plus size={11} strokeWidth={2.5} />
                    Add
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
