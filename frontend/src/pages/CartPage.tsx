import { Link } from 'react-router-dom';
import { ArrowRight, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCartStore } from '@/store/cartStore';
import { useAuthStore } from '@/store/authStore';
import RecommendationBar from '@/components/cart/RecommendationBar';

export default function CartPage() {
  const { items, total, itemCount, updateItem, removeItem, lastAddedProduct } = useCartStore();
  const { user, openAuthModal } = useAuthStore();

  async function handleUpdate(itemId: number, qty: number) {
    try {
      if (qty <= 0) await removeItem(itemId);
      else await updateItem(itemId, qty);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Update failed');
    }
  }

  async function handleRemove(itemId: number) {
    try {
      await removeItem(itemId);
      toast.success('Removed from cart');
    } catch {
      toast.error('Remove failed');
    }
  }

  if (items.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 sm:py-20 flex flex-col items-center gap-4 text-gray-400">
        <ShoppingBag size={48} strokeWidth={1} />
        <h2 className="text-lg sm:text-xl font-semibold text-gray-600">Your cart is empty</h2>
        <p className="text-sm">Add some plants to make your home greener!</p>
        <Link to="/products" className="mt-2 px-6 py-3 bg-primary text-white rounded-full font-medium hover:bg-primary/90 transition">
          Browse Plants
        </Link>
      </div>
    );
  }

  const shipping = total >= 499 ? 0 : 49;
  const grandTotal = total + shipping;

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-8 pb-24 lg:pb-8">
      <h1 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-8">Shopping Cart ({itemCount} items)</h1>

      <div className="grid lg:grid-cols-3 gap-6 sm:gap-8">
        {/* Items */}
        <div className="lg:col-span-2 space-y-3 sm:space-y-4">
          {items.map((item) => (
            <div key={item.id} className="flex gap-3 sm:gap-4 p-3 sm:p-4 bg-white rounded-xl sm:rounded-2xl border border-gray-100">
              <Link to={`/products/${item.product.slug}`} className="shrink-0">
                <img
                  src={item.product.images?.[0] || 'https://placehold.co/120x120?text=Plant'}
                  alt={item.product.name}
                  className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 rounded-lg sm:rounded-xl object-cover"
                  loading="lazy"
                />
              </Link>
              <div className="flex-1 min-w-0">
                <Link to={`/products/${item.product.slug}`} className="text-sm sm:text-base font-medium hover:text-primary transition line-clamp-1">
                  {item.product.name}
                </Link>
                <p className="text-primary font-bold text-sm sm:text-base mt-0.5 sm:mt-1">₹{item.product.price}</p>
                {item.product.original_price && item.product.original_price > item.product.price && (
                  <p className="text-xs text-gray-400 line-through">₹{item.product.original_price}</p>
                )}
                <div className="flex items-center gap-2 sm:gap-3 mt-2 sm:mt-3">
                  <div className="flex items-center border rounded-lg">
                    <button onClick={() => handleUpdate(item.id, item.quantity - 1)} className="p-2 hover:bg-gray-50 touch-target">
                      <Minus size={14} />
                    </button>
                    <span className="px-2 sm:px-3 text-sm font-medium">{item.quantity}</span>
                    <button onClick={() => handleUpdate(item.id, item.quantity + 1)} className="p-2 hover:bg-gray-50 touch-target">
                      <Plus size={14} />
                    </button>
                  </div>
                  <button onClick={() => handleRemove(item.id)} className="text-red-400 hover:text-red-600 text-sm flex items-center gap-1 touch-target">
                    <Trash2 size={14} /> <span className="hidden sm:inline">Remove</span>
                  </button>
                </div>
              </div>
              <p className="font-bold text-sm sm:text-lg shrink-0">₹{item.line_total.toFixed(0)}</p>
            </div>
          ))}
        </div>

        {/* Smart cross-sell recommendations */}
        {lastAddedProduct && (
          <div className="lg:col-span-2">
            <RecommendationBar lastAddedProduct={lastAddedProduct} cartItems={items} />
          </div>
        )}

        {/* Order summary — desktop: sticky sidebar, mobile: stacked below */}
        <div className="lg:col-span-1 hidden lg:block">
          <div className="bg-white rounded-2xl border p-6 space-y-4 sticky top-24">
            <h3 className="font-bold text-lg">Order Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Subtotal</span>
                <span className="font-medium">₹{total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Shipping</span>
                <span className="font-medium text-green-600">{shipping === 0 ? 'Free' : `₹${shipping}`}</span>
              </div>
            </div>
            <div className="border-t pt-3">
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span className="text-primary">₹{grandTotal.toFixed(2)}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <input type="text" placeholder="Promo code" className="flex-1 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-light" />
              <button className="px-4 py-2 text-sm bg-gray-100 rounded-lg font-medium hover:bg-gray-200 transition">Apply</button>
            </div>
            {user ? (
              <Link to="/checkout" className="block w-full text-center py-3.5 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition">
                Proceed to Checkout <ArrowRight size={18} className="inline ml-1" />
              </Link>
            ) : (
              <button onClick={openAuthModal} className="w-full py-3.5 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition">
                Login to Checkout
              </button>
            )}
          </div>
        </div>

        {/* Mobile order summary (inline) */}
        <div className="lg:hidden bg-white rounded-xl border p-4 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Subtotal</span>
            <span className="font-medium">₹{total.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Shipping</span>
            <span className="font-medium text-green-600">{shipping === 0 ? 'Free' : `₹${shipping}`}</span>
          </div>
          <div className="border-t pt-2 flex justify-between font-bold text-base">
            <span>Total</span>
            <span className="text-primary">₹{grandTotal.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Mobile fixed checkout button */}
      <div className="lg:hidden fixed bottom-14 left-0 right-0 z-30 bg-white border-t px-3 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.08)] safe-bottom">
        {user ? (
          <Link to="/checkout" className="block w-full text-center py-3 bg-primary text-white rounded-xl font-semibold text-sm">
            Proceed to Checkout — ₹{grandTotal.toFixed(0)}
          </Link>
        ) : (
          <button onClick={openAuthModal} className="w-full py-3 bg-primary text-white rounded-xl font-semibold text-sm">
            Login to Checkout
          </button>
        )}
      </div>
    </div>
  );
}
