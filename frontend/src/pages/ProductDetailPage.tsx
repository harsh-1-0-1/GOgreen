import { useEffect, useRef, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronUp, Droplets, Minus, Plus, ShoppingCart, Sun } from 'lucide-react';
import toast from 'react-hot-toast';
import { useProduct, useProducts } from '@/hooks/useProducts';
import { useProductReviews } from '@/hooks/useReviews';
import { useCartStore } from '@/store/cartStore';
import { useAuthStore } from '@/store/authStore';
import ProductCard from '@/components/product/ProductCard';
import ProductTagBadges from '@/components/product/ProductTagBadges';
import ProductReviews, { ProductRatingInline } from '@/components/product/ProductReviews';
import Spinner from '@/components/ui/Spinner';
import ErrorBoundary from '@/components/ui/ErrorBoundary';
import { saveDirectCheckoutSession } from '@/lib/directCheckout';


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
  const { user, openAuthModal } = useAuthStore();
  const navigate = useNavigate();
  const [qty, setQty] = useState(1);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedPot, setSelectedPot] = useState<string | null>(null);

  const { data: similar } = useProducts({ limit: 5 });
  const { data: reviewPreview } = useProductReviews(product?.id, { limit: 1 });

  useEffect(() => {
    if (!product?.variants) return;
    const colors = product.variants.colors || [];
    const pots = product.variants.pot_types || [];
    if (!selectedColor && colors.length) setSelectedColor(colors[0].slug);
    if (!selectedPot && pots.length) setSelectedPot(pots[0].slug);
  }, [product, selectedColor, selectedPot]);

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

  const variants = product.variants;
  const hasVariants = Boolean(variants?.colors?.length && variants?.pot_types?.length);
  const comboKey = selectedColor && selectedPot ? `${selectedColor}__${selectedPot}` : '';
  const selectedPotType = variants?.pot_types?.find((p) => p.slug === selectedPot);
  const selectedStock = hasVariants ? Number(variants?.stock?.[comboKey] ?? 0) : product.stock_qty;
  const displayPrice = product.price + (selectedPotType?.price_modifier || 0);
  const displayImage = hasVariants
    ? variants?.image_map?.[comboKey] || variants?.default_image || product.images?.[0]
    : product.images?.[0];
  const galleryImages = displayImage
    ? [displayImage, ...(product.images || []).filter((img) => img !== displayImage)]
    : product.images || [];
  const selectedOptions = hasVariants && selectedColor && selectedPot
    ? { color: selectedColor, pot_type: selectedPot }
    : null;
  const selectionIncomplete = hasVariants && (!selectedColor || !selectedPot);
  const isUnavailable = selectionIncomplete || selectedStock <= 0;

  async function handleAddToCart() {
    try {
      await addItem(product!.id, qty, product!, selectedOptions);
      toast.success(`${product!.name} added to cart`);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to add');
    }
  }

  async function handleBuyNow() {
    try {
      saveDirectCheckoutSession({
        mode: 'buy-now',
        created_at: Date.now(),
        items: [{
          product_id: product!.id,
          quantity: qty,
          selected_options: selectedOptions,
          product: product!,
          unit_price: displayPrice,
          line_total: displayPrice * qty,
          resolved_image_url: displayImage || product!.images?.[0] || 'https://placehold.co/600x600?text=Plant',
        }],
      });
      navigate('/checkout?mode=buy-now');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to process');
    }
  }

  const similarProducts = similar?.items.filter((p) => p.id !== product.id).slice(0, 4) ?? [];

  return (
    <div className="pb-20 md:pb-0">
      {/* Mobile image gallery */}
      <div className="md:hidden">
        <MobileGallery images={galleryImages} />
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
            <DesktopGallery images={galleryImages} />
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

            <ProductRatingInline summary={reviewPreview?.summary} />

            <div className="flex items-baseline gap-2 sm:gap-3">
              <span className="text-2xl sm:text-3xl font-bold text-primary">₹{displayPrice}</span>
              {product.original_price && product.original_price > product.price && (
                <>
                  <span className="text-base sm:text-lg text-gray-400 line-through">₹{product.original_price}</span>
                  <span className="text-xs sm:text-sm font-semibold text-accent bg-accent/10 px-2 py-0.5 rounded">
                    {discount}% OFF
                  </span>
                </>
              )}
            </div>

            {selectedStock > 0 ? (
              <p className="text-sm text-green-600 font-medium">
                In Stock {selectedStock <= 5 && `(Only ${selectedStock} left)`}
              </p>
            ) : (
              <p className="text-sm text-red-500 font-medium">Out of Stock</p>
            )}

            {hasVariants && variants && (
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Color</p>
                  <div className="flex flex-wrap gap-2">
                    {variants.colors.map((color) => {
                      const disabled = selectedPot ? Number(variants.stock?.[`${color.slug}__${selectedPot}`] ?? 0) <= 0 : false;
                      return (
                        <button
                          key={color.slug}
                          type="button"
                          disabled={disabled}
                          onClick={() => setSelectedColor(color.slug)}
                          className={`w-9 h-9 rounded-full border-2 transition disabled:opacity-30 disabled:cursor-not-allowed ${
                            selectedColor === color.slug ? 'border-primary ring-2 ring-primary/20' : 'border-gray-200'
                          }`}
                          title={color.name}
                          aria-label={color.name}
                          style={{ backgroundColor: color.hex }}
                        />
                      );
                    })}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Pot Type</p>
                  <div className="flex flex-wrap gap-2">
                    {variants.pot_types.map((pot) => {
                      const disabled = selectedColor ? Number(variants.stock?.[`${selectedColor}__${pot.slug}`] ?? 0) <= 0 : false;
                      return (
                        <button
                          key={pot.slug}
                          type="button"
                          disabled={disabled}
                          onClick={() => setSelectedPot(pot.slug)}
                          className={`px-4 py-2 rounded-full border text-sm font-medium transition disabled:opacity-40 disabled:cursor-not-allowed ${
                            selectedPot === pot.slug ? 'border-primary bg-primary/5 text-primary' : 'border-gray-200 hover:border-primary/40'
                          }`}
                        >
                          {pot.name}{pot.price_modifier > 0 ? ` (+₹${pot.price_modifier})` : ''}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
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
            {!isUnavailable && (
              <div className="hidden md:flex items-center gap-4">
                <div className="flex items-center border rounded-xl">
                  <button onClick={() => setQty(Math.max(1, qty - 1))} className="p-3 hover:bg-gray-50 transition touch-target">
                    <Minus size={16} />
                  </button>
                  <span className="px-4 font-medium">{qty}</span>
                  <button onClick={() => setQty(Math.min(selectedStock, qty + 1))} className="p-3 hover:bg-gray-50 transition touch-target">
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

            {!isUnavailable && (
              <div className="md:hidden space-y-3 pt-1">
                <div className="inline-flex items-center border border-gray-200 rounded-none bg-white">
                  <button onClick={() => setQty(Math.max(1, qty - 1))} className="px-4 py-3 touch-target">
                    <Minus size={14} />
                  </button>
                  <span className="min-w-10 px-3 text-center text-sm font-medium">{qty}</span>
                  <button onClick={() => setQty(Math.min(selectedStock, qty + 1))} className="px-4 py-3 touch-target">
                    <Plus size={14} />
                  </button>
                </div>
                <button
                  onClick={handleAddToCart}
                  className="w-full py-3 rounded text-sm font-semibold uppercase tracking-wide text-white transition active:scale-[0.99] hover:opacity-90 flex items-center justify-center gap-2"
                  style={{ backgroundColor: '#16A34A' }}
                >
                  Add to Cart
                </button>
                <button
                  onClick={handleBuyNow}
                  className="w-full py-3 border border-primary text-primary bg-white rounded text-sm font-semibold uppercase tracking-wide flex items-center justify-center gap-2 active:scale-[0.99] transition hover:bg-primary/5"
                >
                  Buy It Now
                </button>
              </div>
            )}

            <CareTips tips={product.care_tips || []} />
          </div>
        </div>

        <ProductReviews productId={product.id} />

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

    </div>
  );
}
