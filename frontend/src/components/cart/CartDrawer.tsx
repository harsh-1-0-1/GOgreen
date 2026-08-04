import { Link } from 'react-router-dom';
import { Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCartStore } from '@/store/cartStore';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import RecommendationBar from './RecommendationBar';
import { formatSelectedOptions } from '@/lib/variantDisplay';
import { getApiErrorDetail } from '@/lib/apiError';
import { useSuggestionTiles } from '@/hooks/useSuggestionTiles';

function optionSummary(item: ReturnType<typeof useCartStore.getState>['items'][number]) {
  if (!item.selected_options) return null;
  return formatSelectedOptions(item.selected_options, item.product.variants) || null;
}

export default function CartDrawer() {
  const { isDrawerOpen, closeDrawer, items, total, itemCount, updateItem, removeItem, lastAddedProduct } =
    useCartStore();
  const suggestionTiles = useSuggestionTiles(4);

  useBodyScrollLock(isDrawerOpen);

  if (!isDrawerOpen) return null;

  async function handleUpdate(itemId: number, qty: number) {
    try {
      if (qty <= 0) await removeItem(itemId);
      else await updateItem(itemId, qty);
    } catch (err) {
      toast.error(getApiErrorDetail(err, 'Failed to update cart'));
    }
  }

  async function handleRemove(itemId: number) {
    try {
      await removeItem(itemId);
      toast.success('Removed from cart');
    } catch {
      toast.error('Failed to remove item');
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={closeDrawer} />
      {/* Full-screen on mobile, 400px drawer on desktop */}
      <div className="fixed inset-0 md:inset-auto md:top-0 md:right-0 md:h-full md:w-[400px] bg-white z-50 md:shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b shrink-0">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <ShoppingBag size={20} className="text-primary" />
            Cart ({itemCount})
          </h2>
          <button onClick={closeDrawer} className="p-2 hover:bg-gray-100 rounded-lg touch-target">
            <X size={20} />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 sm:space-y-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center py-6 animate-fade-in h-full">
              {/* Empty Header */}
              <div className="flex flex-col items-center text-center max-w-[280px] mb-8">
                <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center text-primary mb-3 shadow-inner">
                  <ShoppingBag size={24} className="text-emerald-700" />
                </div>
                <h3 className="text-base font-bold text-gray-800">Your cart is empty</h3>
                <p className="text-xs text-gray-400 mt-1">
                  Add some live greens to kickstart your green space!
                </p>
                <button
                  onClick={closeDrawer}
                  className="mt-4 px-6 py-2 bg-primary hover:bg-primary/95 text-white font-bold rounded-full text-xs shadow-sm hover:shadow transition active:scale-[0.98]"
                >
                  Continue Shopping
                </button>
              </div>

              {/* Suggestions Grid */}
              <div className="w-full mt-2 border-t pt-6">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
                  Shop Popular Collections
                </h4>
                <div className="grid grid-cols-2 gap-3.5">
                  {suggestionTiles.map((col) => (
                    <Link
                      key={col.title}
                      to={col.link}
                      onClick={closeDrawer}
                      className="group flex flex-col bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm hover:shadow transition active:scale-[0.99]"
                    >
                      <div className="relative aspect-[4/3] overflow-hidden bg-gray-50 shrink-0">
                        <img
                          src={col.image}
                          alt={col.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-black/5 group-hover:bg-black/0 transition-colors" />
                      </div>
                      <div className="p-2.5 flex flex-col flex-1">
                        <h5 className="text-xs font-bold text-gray-800 line-clamp-1 leading-snug">
                          {col.title}
                        </h5>
                        <p className={`text-[9px] font-semibold mt-0.5 leading-none ${col.color}`}>
                          {col.subtitle}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.id} className="flex gap-3 p-3 bg-gray-50 rounded-xl">
                <img
                  src={item.resolved_image_url || item.product.images?.[0] || 'https://placehold.co/80x80?text=Plant'}
                  alt={item.product.name}
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg object-cover shrink-0"
                  loading="lazy"
                />
                <div className="flex-1 min-w-0">
                  <Link
                    to={`/products/${item.product.slug}`}
                    className="text-sm font-medium line-clamp-1 hover:text-primary"
                    onClick={closeDrawer}
                  >
                    {item.product.name}
                  </Link>
                  {optionSummary(item) && (
                    <p className="text-[11px] text-gray-500 mt-0.5">{optionSummary(item)}</p>
                  )}
                  <p className="text-primary font-semibold text-sm mt-0.5">₹{item.unit_price}</p>
                  {item.stock_warning && (
                    <p className="text-[11px] text-red-500 mt-1">
                      Only {item.available_stock} units available. Please adjust quantity.
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex items-center border rounded-lg">
                      <button onClick={() => handleUpdate(item.id, item.quantity - 1)} className="p-1.5 hover:bg-gray-100 touch-target">
                        <Minus size={14} />
                      </button>
                      <span className="px-2.5 text-sm font-medium">{item.quantity}</span>
                      <button
                        onClick={() => handleUpdate(item.id, item.quantity + 1)}
                        disabled={item.quantity >= item.available_stock}
                        className="p-1.5 hover:bg-gray-100 touch-target disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    <button onClick={() => handleRemove(item.id)} className="p-1.5 text-red-400 hover:text-red-600 ml-auto touch-target">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
                <p className="text-sm font-semibold shrink-0">₹{item.line_total}</p>
              </div>
            ))
          )}

          {/* Smart recommendations — show after add */}
          {lastAddedProduct && items.length > 0 && (
            <RecommendationBar lastAddedProduct={lastAddedProduct} cartItems={items} />
          )}
        </div>

        {/* Sticky footer */}
        {items.length > 0 && (
          <div className="border-t p-4 space-y-3 shrink-0 safe-bottom">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Subtotal</span>
              <span className="font-bold text-lg">₹{total.toFixed(2)}</span>
            </div>
            <Link
              to="/cart"
              onClick={closeDrawer}
              className="block w-full text-center py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition"
            >
              View Cart & Checkout
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
