import { useEffect, useRef, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronUp, Droplets, Minus, Plus, ShoppingCart, Sun, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { useProduct, useProducts } from '@/hooks/useProducts';
import { useCategories } from '@/hooks/useCategories';
import { useProductReviews } from '@/hooks/useReviews';
import { useCartStore } from '@/store/cartStore';
import { useAuthStore } from '@/store/authStore';
import ProductCard from '@/components/product/ProductCard';
import ProductTagBadges from '@/components/product/ProductTagBadges';
import ProductReviews, { ProductRatingInline } from '@/components/product/ProductReviews';
import PlantogaPromise from '@/components/product/PlantogaPromise';
import HowToGuide from '@/components/product/HowToGuide';
import ProductSpecification from '@/components/product/ProductSpecification';
import WhyPlantoga from '@/components/product/WhyPlantoga';
import HappyPlanters from '@/components/product/HappyPlanters';
import ProductFaq from '@/components/product/ProductFaq';
import { STORE_LEGAL } from '@/lib/branding';
import Spinner from '@/components/ui/Spinner';
import ErrorBoundary from '@/components/ui/ErrorBoundary';
import type { Category } from '@/types';


function findCategoryName(categories: Category[] | undefined, categoryId: number): string {
  if (!categories?.length) return 'PLANTS';

  const search = (list: Category[]): string | null => {
    for (const cat of list) {
      if (cat.id === categoryId) return cat.name;
      if (cat.children?.length) {
        const match = search(cat.children);
        if (match) return match;
      }
    }
    return null;
  };

  return (search(categories) || 'Plants').toUpperCase();
}

function MobileGallery({
  images,
  activeIndex,
  onActiveChange,
}: {
  images: string[];
  activeIndex: number;
  onActiveChange: (i: number) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const list = images.length ? images : ['https://placehold.co/600x600?text=Plant'];

  // Scroll to active slide whenever activeIndex changes from outside
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ left: activeIndex * el.clientWidth, behavior: 'smooth' });
  }, [activeIndex]);

  function handleScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    onActiveChange(idx);
  }

  function scrollPrev() {
    if (activeIndex > 0) onActiveChange(activeIndex - 1);
  }

  function scrollNext() {
    if (activeIndex < list.length - 1) onActiveChange(activeIndex + 1);
  }

  return (
    <div className="relative px-4">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex overflow-x-auto snap-x-mandatory scrollbar-hide gap-4"
      >
        {list.map((img, i) => (
          <img
            key={i}
            src={img}
            alt={`Product ${i + 1}`}
            className="w-full shrink-0 snap-center aspect-square object-cover rounded-2xl"
            loading="lazy"
          />
        ))}
      </div>
      
      {list.length > 1 && (
        <button 
          onClick={scrollPrev}
          disabled={activeIndex === 0}
          className={`absolute top-1/2 -translate-y-1/2 left-0 w-10 h-10 bg-white rounded-full shadow-md flex items-center justify-center -ml-2 z-10 touch-target text-gray-800 transition-opacity ${
            activeIndex === 0 ? 'opacity-40 cursor-not-allowed' : 'opacity-100 hover:bg-gray-50'
          }`}
        >
          <ChevronLeft size={20} />
        </button>
      )}
      
      {list.length > 1 && (
        <button 
          onClick={scrollNext}
          disabled={activeIndex === list.length - 1}
          className={`absolute top-1/2 -translate-y-1/2 right-0 w-10 h-10 bg-white rounded-full shadow-md flex items-center justify-center -mr-2 z-10 touch-target text-gray-800 transition-opacity ${
            activeIndex === list.length - 1 ? 'opacity-40 cursor-not-allowed' : 'opacity-100 hover:bg-gray-50'
          }`}
        >
          <ChevronRight size={20} />
        </button>
      )}
    </div>
  );
}

function DesktopGallery({
  images,
  activeIndex,
  onActiveChange,
}: {
  images: string[];
  activeIndex: number;
  onActiveChange: (i: number) => void;
}) {
  const list = images.length ? images : ['https://placehold.co/600x600?text=Plant'];

  return (
    <div className="space-y-3">
      <div className="aspect-square rounded-2xl overflow-hidden bg-gray-50">
        <img src={list[activeIndex]} alt="Product" className="w-full h-full object-cover" loading="lazy" />
      </div>
      {list.length > 1 && (
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {list.map((img, i) => (
            <button
              key={i}
              onClick={() => onActiveChange(i)}
              className={`shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition ${i === activeIndex ? 'border-primary' : 'border-transparent'}`}
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

const NO_POT_SLUG = 'no-pot';

export default function ProductDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: product, isLoading, isError } = useProduct(slug!);
  const { data: categories } = useCategories();
  const addItem = useCartStore((s) => s.addItem);
  const { user, openAuthModal } = useAuthStore();
  const navigate = useNavigate();
  const [qty, setQty] = useState(1);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedPot, setSelectedPot] = useState<string | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [galleryActive, setGalleryActive] = useState(0);

  const galleryRef = useRef<HTMLDivElement>(null);
  const isInitialized = useRef(false);

  const { data: similar } = useProducts({ limit: 5 });
  const { data: reviewPreview } = useProductReviews(product?.id, { limit: 1 });

  useEffect(() => {
    isInitialized.current = false;
  }, [slug]);

  useEffect(() => {
    if (!product) return;

    const colors = product.variants?.colors || [];
    const pots = product.variants?.pot_types || [];
    const sizes = product.variants?.sizes || [];

    const hasColors = colors.length > 0;
    const hasPots = pots.length > 0;
    const hasSizes = sizes.length > 0;

    const colorOk = !hasColors || selectedColor !== null;
    const potOk = !hasPots || selectedPot !== null;
    const sizeOk = !hasSizes || selectedSize !== null;

    if (colorOk && potOk && sizeOk) {
      if (!isInitialized.current) {
        isInitialized.current = true;
      } else {
        galleryRef.current?.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [selectedColor, selectedPot, selectedSize, product]);

  useEffect(() => {
    if (!product) return;
    if (!product.variants) {
      setSelectedColor(null);
      setSelectedPot(null);
      setSelectedSize(null);
      setQty(1);
      return;
    }
    const colors = product.variants.colors || [];
    const pots = product.variants.pot_types || [];
    const sizes = product.variants.sizes || [];
    const firstInStockKey = Object.entries(product.variants.stock || {})
      .find(([, stock]) => Number(stock) > 0)?.[0];
    const inStockParts = firstInStockKey?.split('__') || [];
    setSelectedColor(colors.length ? (inStockParts[0] || colors[0].slug) : null);
    // Always default to "no-pot" (just the plant) when pot types are available
    setSelectedPot(pots.length ? NO_POT_SLUG : null);
    setSelectedSize(sizes.length
      ? (colors.length && pots.length ? inStockParts[2] : inStockParts[0]) || sizes[0].slug
      : null);
    setQty(1);
  }, [product]);

  if (isLoading) return <Spinner className="py-32" />;
  if (isError || !product) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-gray-400">
        <p className="text-lg font-medium">Product not found</p>
        <Link to="/products" className="text-sm text-primary hover:underline mt-2">Back to Products</Link>
      </div>
    );
  }

  const variants = product.variants;
  const sizes = variants?.sizes || [];
  const hasColorPotVariants = Boolean(variants?.colors?.length && variants?.pot_types?.length);
  const isSizeOnly = Boolean(sizes.length && !variants?.colors?.length && !variants?.pot_types?.length);
  const hasVariants = hasColorPotVariants || isSizeOnly;

  // Build combo key depending on variant mode
  let comboKey = '';
  if (hasColorPotVariants && sizes.length) {
    if (selectedColor && selectedPot && selectedSize) comboKey = `${selectedColor}__${selectedPot}__${selectedSize}`;
  } else if (hasColorPotVariants) {
    if (selectedColor && selectedPot) comboKey = `${selectedColor}__${selectedPot}`;
  } else if (isSizeOnly) {
    if (selectedSize) comboKey = selectedSize;
  }

  const selectedColorType = variants?.colors?.find((c) => c.slug === selectedColor);
  const selectedPotType = variants?.pot_types?.find((p) => p.slug === selectedPot);
  const selectedSizeType = sizes.find((s) => s.slug === selectedSize);
  // "no-pot" is a synthetic option — stock comes directly from product.stock_qty
  const selectedStock = selectedPot === NO_POT_SLUG
    ? product.stock_qty
    : (hasVariants ? Number(variants?.stock?.[comboKey] ?? 0) : product.stock_qty);
  const selectedPriceModifier =
    (selectedPotType?.price_modifier || 0) + (selectedSizeType?.price_modifier || 0);
  const displayPrice = product.price + selectedPriceModifier;
  const displayOriginalPrice = product.original_price
    ? product.original_price + selectedPriceModifier
    : null;
  const discount =
    displayOriginalPrice && displayOriginalPrice > displayPrice
      ? Math.round(((displayOriginalPrice - displayPrice) / displayOriginalPrice) * 100)
      : null;
<<<<<<< HEAD
  const displayImage = hasVariants
    ? (Array.isArray(variants?.image_map?.[comboKey]) ? (variants.image_map[comboKey] as string[])[0] : variants?.image_map?.[comboKey] as string | undefined) || selectedColorType?.image_url || selectedPotType?.image_url || variants?.default_image || product.images?.[0]
    : product.images?.[0];
  const galleryImages = displayImage
    ? [displayImage, ...(product.images || []).filter((img) => img !== displayImage)]
    : product.images || [];
=======
  // Derive gallery images
  let galleryImages: string[] = [];
  if (hasVariants) {
    const comboImages = variants?.image_map?.[comboKey];
    if (Array.isArray(comboImages) && comboImages.length > 0) {
      galleryImages = comboImages;
    } else if (selectedPotType?.image_url) {
      galleryImages = [selectedPotType.image_url];
    } else if (variants?.default_image) {
      galleryImages = [variants.default_image];
    }
  }
>>>>>>> 0bfe9e339bf614d54a734258043183951e460a52

  if (galleryImages.length === 0) {
    galleryImages = product.images || [];
  }

  const displayImage = galleryImages[0] || product.images?.[0] || '';

  // Reset gallery to first image whenever the selected comboKey changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setGalleryActive(0); }, [comboKey]);

  // Build selectedOptions for cart
  let selectedOptions: Record<string, string> | null = null;
  if (hasColorPotVariants && selectedColor && selectedPot) {
    selectedOptions = { color: selectedColor, pot_type: selectedPot };
    if (sizes.length && selectedSize) selectedOptions.size = selectedSize;
  } else if (isSizeOnly && selectedSize) {
    selectedOptions = { size: selectedSize };
  }

  const selectionIncomplete =
    (hasColorPotVariants && (!selectedColor || !selectedPot || (sizes.length > 0 && !selectedSize)))
    || (isSizeOnly && !selectedSize);
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
      await addItem(product!.id, 1, product!, selectedOptions);
      useCartStore.getState().closeDrawer();
      navigate('/cart');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to process');
    }
  }

  const similarProducts = similar?.items.filter((p) => p.id !== product.id).slice(0, 4) ?? [];
  const mrp = displayOriginalPrice ?? displayPrice;
  const productSpecs = [
    { label: 'Name', value: product.name },
    { label: 'Category', value: findCategoryName(categories, product.category_id) },
    { label: 'Country of Origin', value: STORE_LEGAL.countryOfOrigin },
    { label: 'Marketed by', value: STORE_LEGAL.marketedBy },
    { label: 'MRP', value: `₹${mrp.toFixed(2)} (Incl. of all taxes)` },
    { label: 'Net Quantity', value: '1' },
    { label: 'Manufactured by', value: STORE_LEGAL.manufacturedBy },
  ];

  return (
    <div ref={galleryRef} className="pb-20 md:pb-0 scroll-mt-[100px] sm:scroll-mt-[110px] lg:scroll-mt-[120px]">
      {/* Mobile image gallery */}
      <div className="md:hidden">
        <MobileGallery images={galleryImages} activeIndex={galleryActive} onActiveChange={setGalleryActive} />
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
            <DesktopGallery images={galleryImages} activeIndex={galleryActive} onActiveChange={setGalleryActive} />
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
              {displayOriginalPrice && displayOriginalPrice > displayPrice && (
                <>
                  <span className="text-base sm:text-lg text-gray-400 line-through">₹{displayOriginalPrice}</span>
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
                {/* Plant Size Selector */}
                {sizes.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        Select Plant Size
                        {selectedSizeType?.description && (
                          <span className="ml-2 text-primary normal-case font-normal">— {selectedSizeType.description}</span>
                        )}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {sizes.map((size) => {
                        const sizeCombo = isSizeOnly
                          ? size.slug
                          : (selectedColor && selectedPot ? `${selectedColor}__${selectedPot}__${size.slug}` : '');
                        const stockForSize = sizeCombo ? Number(variants?.stock?.[sizeCombo] ?? 0) : 0;
                        const disabled = isSizeOnly
                          ? stockForSize <= 0
                          : (selectedColor && selectedPot ? stockForSize <= 0 : false);
                        const isActive = selectedSize === size.slug;
                        return (
                          <button
                            key={size.slug}
                            type="button"
                            disabled={disabled}
                            onClick={() => {
                              setSelectedSize(size.slug);
                              setQty(1);
                            }}
                            className={`px-5 py-2 rounded-full border-2 text-sm font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed ${
                              isActive
                                ? 'bg-primary border-primary text-white shadow-sm'
                                : 'border-gray-300 text-gray-700 hover:border-primary hover:text-primary bg-white'
                            }`}
                          >
                            {size.name}
                            {size.price_modifier > 0 && (
                              <span className={`ml-1 text-xs ${isActive ? 'text-white/80' : 'text-gray-400'}`}>
                                +₹{size.price_modifier}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Color Selector */}
                {hasColorPotVariants && (
                  <>
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Color</p>
                      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                        {variants!.colors.map((color) => {
                          const colorCombo = selectedPot
                            ? `${color.slug}__${selectedPot}${sizes.length && selectedSize ? `__${selectedSize}` : ''}`
                            : '';
                          const disabled = colorCombo ? Number(variants?.stock?.[colorCombo] ?? 0) <= 0 : false;
                          return (
                            <button
                              key={color.slug}
                              type="button"
                              disabled={disabled}
                              onClick={() => {
                                setSelectedColor(color.slug);
                                setGalleryActive(0);
                                setQty(1);
                              }}
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
                        {/* ── No Pot (synthetic default option) ── */}
                        <button
                          type="button"
                          onClick={() => { setSelectedPot(NO_POT_SLUG); setQty(1); }}
                          className={`w-24 min-h-24 shrink-0 px-2 py-2 rounded-xl border text-xs font-medium transition ${
                            selectedPot === NO_POT_SLUG
                              ? 'border-primary bg-primary text-white shadow-sm'
                              : 'border-gray-200 bg-white hover:border-primary/40'
                          }`}
                        >
                          <span className="flex h-11 items-center justify-center mb-1">
                            <span className={`text-3xl ${selectedPot === NO_POT_SLUG ? 'opacity-90' : 'opacity-30'}`}>🌿</span>
                          </span>
                          <span className="block truncate">No Pot</span>
                          <span className={`block mt-0.5 ${selectedPot === NO_POT_SLUG ? 'text-white/80' : 'text-gray-500'}`}>
                            Included
                          </span>
                        </button>

                        {/* ── Actual pot type options ── */}
                        {variants!.pot_types.map((pot) => {
                          const potCombo = selectedColor
                            ? `${selectedColor}__${pot.slug}${sizes.length && selectedSize ? `__${selectedSize}` : ''}`
                            : '';
                          const disabled = potCombo ? Number(variants?.stock?.[potCombo] ?? 0) <= 0 : false;
                          return (
                            <button
                              key={pot.slug}
                              type="button"
                              disabled={disabled}
                              onClick={() => {
                                setSelectedPot(pot.slug);
                                setQty(1);
                              }}
                              className={`w-24 min-h-24 shrink-0 px-2 py-2 rounded-xl border text-xs font-medium transition disabled:opacity-40 disabled:cursor-not-allowed ${
                                selectedPot === pot.slug ? 'border-primary bg-primary text-white shadow-sm' : 'border-gray-200 bg-white hover:border-primary/40'
                              }`}
                            >
                              <span className="flex h-11 items-center justify-center mb-1">
                                {pot.image_url ? (
                                  <img src={pot.image_url} alt="" className="h-11 w-14 object-contain" loading="lazy" />
                                ) : (
                                  <span className={`text-2xl ${selectedPot === pot.slug ? 'text-white/70' : 'text-gray-300'}`}>♧</span>
                                )}
                              </span>
                              <span className="block truncate">{pot.name}</span>
                              <span className={`block mt-0.5 ${selectedPot === pot.slug ? 'text-white/80' : 'text-gray-500'}`}>
                                {pot.price_modifier > 0 ? `+₹${pot.price_modifier}` : 'Included'}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
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

        <PlantogaPromise />

        <HowToGuide product={product} />

        <ProductSpecification specs={productSpecs} />

        <WhyPlantoga />

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

        <HappyPlanters fallbackImages={galleryImages} />

        <ProductReviews productId={product.id} />

        <ProductFaq />
      </div>

    </div>
  );
}
