import { Link } from 'react-router-dom';
import { Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCartStore } from '@/store/cartStore';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';

export default function CartDrawer() {
  const { isDrawerOpen, closeDrawer, items, total, itemCount, updateItem, removeItem } =
    useCartStore();

  useBodyScrollLock(isDrawerOpen);

  if (!isDrawerOpen) return null;

  async function handleUpdate(itemId: number, qty: number) {
    try {
      if (qty <= 0) await removeItem(itemId);
      else await updateItem(itemId, qty);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to update cart');
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
            <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3">
              <ShoppingBag size={48} strokeWidth={1} />
              <p className="text-sm">Your cart is empty</p>
              <button onClick={closeDrawer} className="text-sm text-primary font-medium hover:underline">
                Continue Shopping
              </button>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.id} className="flex gap-3 p-3 bg-gray-50 rounded-xl">
                <img
                  src={item.product.images?.[0] || 'https://placehold.co/80x80?text=Plant'}
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
                  <p className="text-primary font-semibold text-sm mt-0.5">₹{item.product.price}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex items-center border rounded-lg">
                      <button onClick={() => handleUpdate(item.id, item.quantity - 1)} className="p-1.5 hover:bg-gray-100 touch-target">
                        <Minus size={14} />
                      </button>
                      <span className="px-2.5 text-sm font-medium">{item.quantity}</span>
                      <button onClick={() => handleUpdate(item.id, item.quantity + 1)} className="p-1.5 hover:bg-gray-100 touch-target">
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
