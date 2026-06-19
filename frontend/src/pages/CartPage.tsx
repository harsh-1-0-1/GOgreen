import { Link } from 'react-router-dom';
import { ArrowRight, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCartStore } from '@/store/cartStore';
import { useAuthStore } from '@/store/authStore';
import RecommendationBar from '@/components/cart/RecommendationBar';

function optionSummary(item: ReturnType<typeof useCartStore.getState>['items'][number]) {
  if (!item.selected_options) return null;
  const color = item.product.variants?.colors?.find((c) => c.slug === item.selected_options?.color)?.name
    || item.selected_options.color;
  const pot = item.product.variants?.pot_types?.find((p) => p.slug === item.selected_options?.pot_type)?.name
    || item.selected_options.pot_type;
  return [color && `Color: ${color}`, pot && `Pot: ${pot}`].filter(Boolean).join(' · ');
}

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
      <div className="max-w-4xl mx-auto px-4 py-12 sm:py-16 flex flex-col items-center">
        {/* Empty State Header */}
        <div className="flex flex-col items-center text-center max-w-md mx-auto mb-10 sm:mb-12">
          <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center text-primary mb-4 shadow-inner">
            <ShoppingBag size={28} className="text-emerald-700" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-800">Your cart is currently empty</h2>
          <p className="text-sm text-gray-500 mt-2">
            Before you head to check out, take a look at some of our favorite collections to kickstart your green space!
          </p>
        </div>

        {/* Suggestion Section */}
        <div className="w-full">
          <h3 className="text-base sm:text-lg font-bold text-gray-800 mb-6 text-center sm:text-left">
            Shop Popular Collections
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
            {[
              {
                title: 'Price Drop',
                subtitle: 'Up to 50% OFF',
                image: 'https://images.unsplash.com/photo-1501004318641-b39e6451bec6?w=500&q=80',
                link: '/products?tags=offers',
                color: 'text-amber-600',
              },
              {
                title: 'XL Plants',
                subtitle: 'Grow Big & Bold',
                image: 'https://images.unsplash.com/photo-1614594975525-e45190c55d0b?w=500&q=80',
                link: '/products?category=xl-plants',
                color: 'text-emerald-700',
              },
              {
                title: 'Plant Care',
                subtitle: 'Thrive Guarantee',
                image: 'https://images.unsplash.com/photo-1584132967334-10e028bd69f7?w=500&q=80',
                link: '/products?category=plant-care',
                color: 'text-emerald-700',
              },
              {
                title: 'Fertilizers',
                subtitle: '100% Organic Nutrition',
                image: 'https://images.unsplash.com/photo-1599599810769-bcde5a160d32?w=500&q=80',
                link: '/products?category=potting-mix-fertilizers',
                color: 'text-emerald-700',
              },
              {
                title: 'Pots & Planters',
                subtitle: 'Premium Ceramic Pots',
                image: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=500&q=80',
                link: '/products?category=pots-planters',
                color: 'text-emerald-700',
              },
              {
                title: 'Plant Stands',
                subtitle: 'Elevate Your Plants',
                image: 'https://images.unsplash.com/photo-1592150621744-aca64f48394a?w=500&q=80',
                link: '/products?category=plant-stands',
                color: 'text-emerald-700',
              },
            ].map((col) => (
              <Link
                key={col.title}
                to={col.link}
                className="group flex flex-col bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md transition active:scale-[0.99]"
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
                <div className="p-3.5 flex flex-col flex-1">
                  <h4 className="text-sm sm:text-base font-bold text-gray-800 line-clamp-1 leading-snug">
                    {col.title}
                  </h4>
                  <p className={`text-[10px] sm:text-xs font-semibold mt-1 leading-none ${col.color}`}>
                    {col.subtitle}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Return to Shop Button */}
        <div className="mt-12 sm:mt-16 w-full flex justify-center">
          <Link
            to="/products"
            className="px-8 py-3.5 bg-primary hover:bg-primary/95 text-white font-bold rounded-full shadow-md hover:shadow-lg transition active:scale-[0.98] text-sm tracking-wide"
          >
            Return to Shop
          </Link>
        </div>
      </div>
    );
  }

  const shipping = total >= 499 ? 0 : 49;
  const grandTotal = total + shipping;

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
      <h1 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-8">Shopping Cart ({itemCount} items)</h1>

      <div className="grid lg:grid-cols-3 gap-6 sm:gap-8">
        {/* Items */}
        <div className="lg:col-span-2 space-y-3 sm:space-y-4">
          {items.map((item) => (
            <div key={item.id} className="flex gap-3 sm:gap-4 p-3 sm:p-4 bg-white rounded-xl sm:rounded-2xl border border-gray-100">
              <Link to={`/products/${item.product.slug}`} className="shrink-0">
                <img
                  src={item.resolved_image_url || item.product.images?.[0] || 'https://placehold.co/120x120?text=Plant'}
                  alt={item.product.name}
                  className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 rounded-lg sm:rounded-xl object-cover"
                  loading="lazy"
                />
              </Link>
              <div className="flex-1 min-w-0">
                <Link to={`/products/${item.product.slug}`} className="text-sm sm:text-base font-medium hover:text-primary transition line-clamp-1">
                  {item.product.name}
                </Link>
                {optionSummary(item) && (
                  <p className="text-xs text-gray-500 mt-0.5">{optionSummary(item)}</p>
                )}
                <p className="text-primary font-bold text-sm sm:text-base mt-0.5 sm:mt-1">₹{item.unit_price}</p>
                {item.product.original_price && item.product.original_price > item.product.price && (
                  <p className="text-xs text-gray-400 line-through">₹{item.product.original_price}</p>
                )}
                {item.stock_warning && (
                  <p className="text-xs text-red-500 mt-1">
                    Only {item.available_stock} units available in stock. Please adjust quantity.
                  </p>
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
            <Link to="/checkout" className="block w-full text-center py-3.5 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition">
              Proceed to Checkout <ArrowRight size={18} className="inline ml-1" />
            </Link>
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
          {/* Checkout button — inline below total */}
          <Link to="/checkout" className="block w-full text-center py-3.5 bg-primary text-white rounded-xl font-semibold text-sm hover:bg-primary/90 transition mt-1">
            Proceed to Checkout — ₹{grandTotal.toFixed(0)}
          </Link>
        </div>
      </div>
    </div>
  );
}
