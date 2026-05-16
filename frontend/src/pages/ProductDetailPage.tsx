import { useRef, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronUp, Droplets, Minus, Plus, ShoppingCart, Sun } from 'lucide-react';
import toast from 'react-hot-toast';
import { useProduct, useProducts } from '@/hooks/useProducts';
import { useCartStore } from '@/store/cartStore';
import ProductCard from '@/components/product/ProductCard';
import ProductTagBadges from '@/components/product/ProductTagBadges';
import Spinner from '@/components/ui/Spinner';
import ErrorBoundary from '@/components/ui/ErrorBoundary';


function MobileGallery({ images }: { images: string[] }) {
  const [active, setActive] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const list = images.length ? images : ['https://placehold.co/600x600?text=Plant'];

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    setActive(idx);
  }

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex overflow-x-auto snap-x-mandatory scrollbar-hide"
      >
        {list.map((img, i) => (
          <img
            key={i}
            src={img}
            alt={`Product ${i + 1}`}
            className="w-full shrink-0 snap-start aspect-square object-cover"
            loading="lazy"
          />
        ))}
      </div>
      {list.length > 1 && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
          {list.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${i === active ? 'bg-primary' : 'bg-white/70'}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DesktopGallery({ images }: { images: string[] }) {
  const [active, setActive] = useState(0);
  const list = images.length ? images : ['https://placehold.co/600x600?text=Plant'];

  return (
    <div className="space-y-3">
      <div className="aspect-square rounded-2xl overflow-hidden bg-gray-50">
        <img src={list[active]} alt="Product" className="w-full h-full object-cover" loading="lazy" />
      </div>
      {list.length > 1 && (
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {list.map((img, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={`shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition ${i === active ? 'border-primary' : 'border-transparent'}`}
            >
              <img src={img} alt="" className="w-full h-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CareTips({ tips }: { tips: string[] }) {
  const [open, setOpen] = useState(false);
  if (!tips?.length) return null;

  return (
    <div className="border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 text-sm font-semibold hover:bg-gray-50 transition touch-target"
      >
        Plant Care Tips
        {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>
      {open && (
        <div className="px-4 pb-4">
          <ul className="space-y-2">
            {tips.map((tip, i) => (
              <li key={i} className="text-sm text-gray-600 flex gap-2">
                <span className="text-primary-light mt-0.5">•</span>{tip}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function ProductDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: product, isLoading, isError } = useProduct(slug!);
  const addItem = useCartStore((s) => s.addItem);
  const navigate = useNavigate();
  const [qty, setQty] = useState(1);

  const { data: similar } = useProducts({ limit: 5 });

  if (isLoading) return <Spinner className="py-32" />;
  if (isError || !product) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-gray-400">
        <p className="text-lg font-medium">Product not found</p>
        <Link to="/products" className="text-sm text-primary hover:underline mt-2">Back to Products</Link>
      </div>
    );
  }

  const discount =
    product.original_price && product.original_price > product.price
      ? Math.round(((product.original_price - product.price) / product.original_price) * 100)
      : null;

  async function handleAddToCart() {
    try {
      await addItem(product!.id, qty, product!);
      toast.success(`${product!.name} added to cart`);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to add');
    }
  }

  async function handleBuyNow() {
    try {
      await addItem(product!.id, qty, product!);
      navigate('/checkout');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to process');
    }
  }

  const similarProducts = similar?.items.filter((p) => p.id !== product.id).slice(0, 4) ?? [];

  return (
    <div className="pb-20 md:pb-0">
      {/* Mobile image gallery */}
      <div className="md:hidden">
        <MobileGallery images={product.images || []} />
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        {/* Breadcrumb */}
        <nav className="text-xs sm:text-sm text-gray-400 mb-4 sm:mb-6 flex items-center gap-1.5">
          <Link to="/" className="hover:text-primary">Home</Link>
          <span>/</span>
          <Link to="/products" className="hover:text-primary">Products</Link>
          <span>/</span>
          <span className="text-gray-600 line-clamp-1">{product.name}</span>
        </nav>

        <div className="grid md:grid-cols-2 gap-6 lg:gap-10">
          {/* Desktop gallery */}
          <div className="hidden md:block">
            <DesktopGallery images={product.images || []} />
          </div>

          <div className="space-y-4 sm:space-y-6">
            {product.badge && (
              <span className="inline-block bg-primary text-white text-xs font-medium px-3 py-1 rounded-full">
                {product.badge}
              </span>
            )}
            <h1 className="text-2xl sm:text-3xl font-bold">{product.name}</h1>

            <ProductTagBadges
              tags={product.tags}
              size="md"
              asLinks
              className="mt-1"
            />

            <div className="flex items-baseline gap-2 sm:gap-3">
              <span className="text-2xl sm:text-3xl font-bold text-primary">₹{product.price}</span>
              {product.original_price && product.original_price > product.price && (
                <>
                  <span className="text-base sm:text-lg text-gray-400 line-through">₹{product.original_price}</span>
                  <span className="text-xs sm:text-sm font-semibold text-accent bg-accent/10 px-2 py-0.5 rounded">
                    {discount}% OFF
                  </span>
                </>
              )}
            </div>

            {product.stock_qty > 0 ? (
              <p className="text-sm text-green-600 font-medium">
                ✓ In Stock {product.stock_qty <= 5 && `(Only ${product.stock_qty} left)`}
              </p>
            ) : (
              <p className="text-sm text-red-500 font-medium">Out of Stock</p>
            )}

            {product.description && (
              <p className="text-sm sm:text-base text-gray-600 leading-relaxed">{product.description}</p>
            )}

            <div className="flex gap-4 sm:gap-6">
              {product.sunlight && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Sun size={18} className="text-accent" />{product.sunlight}
                </div>
              )}
              {product.watering && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Droplets size={18} className="text-blue-400" />{product.watering}
                </div>
              )}
            </div>

            {/* Desktop add to cart */}
            {product.stock_qty > 0 && (
              <div className="hidden md:flex items-center gap-4">
                <div className="flex items-center border rounded-xl">
                  <button onClick={() => setQty(Math.max(1, qty - 1))} className="p-3 hover:bg-gray-50 transition touch-target">
                    <Minus size={16} />
                  </button>
                  <span className="px-4 font-medium">{qty}</span>
                  <button onClick={() => setQty(Math.min(product.stock_qty, qty + 1))} className="p-3 hover:bg-gray-50 transition touch-target">
                    <Plus size={16} />
                  </button>
                </div>
                <button
                  onClick={handleAddToCart}
                  className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white transition active:scale-[0.98] hover:opacity-90 flex items-center justify-center gap-2"
                  style={{ backgroundColor: '#16A34A' }}
                >
                  <ShoppingCart size={18} />
                  Add to Cart
                </button>
                <button
                  onClick={handleBuyNow}
                  className="flex-1 py-3.5 border-2 border-primary text-primary bg-white rounded-xl font-semibold flex items-center justify-center gap-2 hover:bg-primary/5 transition"
                >
                  Buy It Now
                </button>
              </div>
            )}

            <CareTips tips={product.care_tips || []} />
          </div>
        </div>

        {/* Similar products */}
        {similarProducts.length > 0 && (
          <ErrorBoundary>
            <section className="mt-10 sm:mt-16">
              <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">You May Also Like</h2>
              <div className="flex gap-3 sm:gap-4 overflow-x-auto scrollbar-hide snap-x-mandatory pb-4 -mx-3 sm:-mx-4 px-3 sm:px-4 md:grid md:grid-cols-4 md:overflow-visible md:mx-0 md:px-0">
                {similarProducts.map((p) => (
                  <div key={p.id} className="shrink-0 w-[70vw] sm:w-56 md:w-auto snap-start">
                    <ProductCard product={p} />
                  </div>
                ))}
              </div>
            </section>
          </ErrorBoundary>
        )}
      </div>

      {/* Mobile fixed bottom add-to-cart bar */}
      {product.stock_qty > 0 && (
        <div className="md:hidden fixed bottom-14 left-0 right-0 z-30 bg-white border-t shadow-[0_-4px_12px_rgba(0,0,0,0.08)] px-3 py-3 safe-bottom">
          <div className="flex items-center gap-3">
            <div className="flex items-center border rounded-lg">
              <button onClick={() => setQty(Math.max(1, qty - 1))} className="p-2.5 touch-target">
                <Minus size={14} />
              </button>
              <span className="px-3 text-sm font-medium">{qty}</span>
              <button onClick={() => setQty(Math.min(product.stock_qty, qty + 1))} className="p-2.5 touch-target">
                <Plus size={14} />
              </button>
            </div>
            <button
              onClick={handleAddToCart}
              className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white transition active:scale-[0.98] hover:opacity-90 flex items-center justify-center gap-2"
              style={{ backgroundColor: '#16A34A' }}
            >
              <ShoppingCart size={16} />
              Add to Cart
            </button>
            <button
              onClick={handleBuyNow}
              className="flex-1 py-3 border-2 border-primary text-primary bg-white rounded-xl font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
            >
              Buy It Now
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
