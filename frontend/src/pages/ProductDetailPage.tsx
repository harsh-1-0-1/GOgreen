import { useEffect, useRef, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronUp, Minus, Plus, ShoppingCart, ChevronLeft, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { useProduct, useProducts } from '@/hooks/useProducts';
import { useCategories } from '@/hooks/useCategories';
import { useProductReviews } from '@/hooks/useReviews';
import { useCartStore } from '@/store/cartStore';
import { useAuthStore } from '@/store/authStore';
import ProductCard from '@/components/product/ProductCard';
import ProductTagBadges from '@/components/product/ProductTagBadges';
import ProductReviews, { ProductRatingInline } from '@/components/product/ProductReviews';
import PlantCareCard from '@/components/product/PlantCareCard';
import PlantogaPromise from '@/components/product/PlantogaPromise';
import HowToGuide from '@/components/product/HowToGuide';
import ProductSpecification from '@/components/product/ProductSpecification';
import WhyPlantoga from '@/components/product/WhyPlantoga';
import HappyPlanters from '@/components/product/HappyPlanters';
import ProductFaq from '@/components/product/ProductFaq';
import { useBanners } from '@/hooks/useBanners';
import { STORE_LEGAL } from '@/lib/branding';
import Spinner from '@/components/ui/Spinner';
import ErrorBoundary from '@/components/ui/ErrorBoundary';
import type { Category } from '@/types';
import { useStories } from '@/hooks/useStories';
import { StoriesCarousel } from '@/components/stories/StoriesCarousel';


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
  const trackRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const list = images.length ? images : ['https://placehold.co/600x600?text=Plant'];

  const EASING = 'transform 380ms cubic-bezier(0.25, 0.46, 0.45, 0.94)';

  // Touch gesture state — all refs so touch handlers never close over stale values
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const touchDeltaX = useRef(0);
  // null = intent not yet determined, 'h' = horizontal (we own it), 'v' = vertical (pass through)
  const gestureIntent = useRef<'h' | 'v' | null>(null);
  // Velocity tracking: record last two move events to compute px/ms on touchend
  const lastMoveTime = useRef(0);
  const lastMoveX = useRef(0);
  const velocityX = useRef(0); // px/ms, positive = moving right

  // React's synthetic onTouchMove is passive by default (can't call preventDefault).
  // Attach the move listener manually as { passive: false } so we can block
  // page scroll when the gesture is determined to be horizontal.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const onMove = (e: TouchEvent) => {
      // Only block scroll if intent is confirmed horizontal
      if (gestureIntent.current === 'h') e.preventDefault();
    };
    track.addEventListener('touchmove', onMove, { passive: false });
    return () => track.removeEventListener('touchmove', onMove);
  }, []);

  function settle(toIndex: number) {
    // Re-enable transition, then let React re-render drive the transform.
    // For snap-back (toIndex === currentIndex), also force the pixel position
    // so the animation plays — React won't re-render since index didn't change.
    // We receive currentIndex as a parameter (not from closure) to avoid
    // stale-closure bugs if a re-render happens before transitionend fires.
    const currentIndex = activeIndex;
    if (!trackRef.current || !containerRef.current) return;
    const el = trackRef.current;
    el.style.transition = EASING;
    if (toIndex === currentIndex) {
      el.style.transform = `translateX(${-currentIndex * containerRef.current.offsetWidth}px)`;
      const onEnd = () => {
        el.style.transform = '';
        el.style.transition = '';
        el.removeEventListener('transitionend', onEnd);
      };
      el.addEventListener('transitionend', onEnd);
    } else {
      // React re-render will apply the correct percentage transform with transition
      el.style.transform = '';
      onActiveChange(toIndex);
    }
  }

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    touchDeltaX.current = 0;
    gestureIntent.current = null;
    lastMoveTime.current = e.timeStamp;
    lastMoveX.current = e.touches[0].clientX;
    velocityX.current = 0;
    // Disable transition so the track follows the finger with zero lag
    if (trackRef.current) trackRef.current.style.transition = 'none';
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!containerRef.current || !trackRef.current) return;

    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;

    // Determine gesture intent on the first few pixels of movement
    if (gestureIntent.current === null) {
      if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return; // not moved enough yet
      gestureIntent.current = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
    }

    // Vertical intent — do nothing, let the page scroll normally
    if (gestureIntent.current === 'v') return;

    // Horizontal intent — drive the track (preventDefault handled by the
    // non-passive native listener registered in useEffect)
    touchDeltaX.current = dx;

    // Velocity: px/ms over the last move interval
    const dt = e.timeStamp - lastMoveTime.current;
    if (dt > 0) velocityX.current = (e.touches[0].clientX - lastMoveX.current) / dt;
    lastMoveTime.current = e.timeStamp;
    lastMoveX.current = e.touches[0].clientX;

    const base = -activeIndex * containerRef.current.offsetWidth;
    trackRef.current.style.transform = `translateX(${base + dx}px)`;
  }

  function handleTouchEnd() {
    // If intent was vertical (or never determined), nothing to do
    if (gestureIntent.current !== 'h' || !containerRef.current) return;

    const width = containerRef.current.offsetWidth;
    const dist = touchDeltaX.current;
    const vel = velocityX.current; // px/ms

    // Advance if: fast flick (>0.3px/ms) OR dragged past 25% of width
    const isFlickLeft  = vel < -0.3 && activeIndex < list.length - 1;
    const isFlickRight = vel >  0.3 && activeIndex > 0;
    const isDragLeft   = dist < -width * 0.25 && activeIndex < list.length - 1;
    const isDragRight  = dist >  width * 0.25 && activeIndex > 0;

    if (isFlickLeft  || isDragLeft)  { settle(activeIndex + 1); return; }
    if (isFlickRight || isDragRight) { settle(activeIndex - 1); return; }
    settle(activeIndex); // snap back
  }

  function scrollPrev() {
    if (activeIndex > 0) onActiveChange(activeIndex - 1);
  }

  function scrollNext() {
    if (activeIndex < list.length - 1) onActiveChange(activeIndex + 1);
  }

  // Keyboard navigation for desktop / accessibility
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowLeft')  { e.preventDefault(); scrollPrev(); }
    if (e.key === 'ArrowRight') { e.preventDefault(); scrollNext(); }
  }

  return (
    // touch-action: pan-y tells the browser "I'm claiming horizontal gestures;
    // vertical scroll is yours." This is the CSS-level contract that backs up
    // the intent-detection logic above and prevents flicker on fast diagonals.
    <div
      className="relative overflow-hidden rounded-2xl"
      ref={containerRef}
      style={{ touchAction: 'pan-y' }}
      // aria: region label + roledescription so screen readers announce "Image carousel"
      role="region"
      aria-label={`Product images, ${list.length} total`}
      aria-roledescription="carousel"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {/* Track — slides side by side, driven by transform */}
      <div
        ref={trackRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="flex will-change-transform"
        style={{
          transform: `translateX(${-activeIndex * 100}%)`,
          transition: EASING,
        }}
      >
        {list.map((img, i) => (
          <div
            key={i}
            role="group"
            aria-roledescription="slide"
            aria-label={`Image ${i + 1} of ${list.length}`}
            aria-hidden={i !== activeIndex}
            className="w-full shrink-0"
          >
            <img
              src={img}
              alt={`Product image ${i + 1}`}
              className="w-full aspect-square object-cover"
              loading="lazy"
              draggable={false}
            />
          </div>
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

import type { Banner } from '@/types';

function InlineBanner({ banner: b, fallbackImg, hasCta }: {
  banner: Banner;
  fallbackImg: string;
  hasCta: boolean;
}) {
  return (
    <div
      className="mt-10 sm:mt-14 rounded-2xl overflow-hidden relative"
      style={{ backgroundColor: b.bg_color || '#1B4332' }}
    >
      <img src={fallbackImg} alt={b.title} className="w-full h-[280px] sm:h-[350px] object-cover" loading="lazy" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent flex items-center px-6 sm:px-10 gap-4">
        <div className="flex-1 min-w-0">
          <p
            className="text-lg sm:text-2xl font-bold leading-tight line-clamp-2"
            style={{ color: b.text_color || '#ffffff' }}
          >
            {b.title}
          </p>
          {b.subtitle && (
            <p className="text-white/80 text-xs sm:text-sm mt-1 line-clamp-1">{b.subtitle}</p>
          )}
        </div>
        {hasCta && b.cta_link && (
          <a
            href={b.cta_link}
            className="shrink-0 px-4 py-2 rounded-full text-xs sm:text-sm font-semibold bg-white text-gray-900 hover:bg-gray-100 transition whitespace-nowrap"
          >
            {b.cta_text}
          </a>
        )}
      </div>
    </div>
  );
}

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
  const { data: productDetailBanners = [] } = useBanners('product_detail');
  const { data: productSpecBanners = [] } = useBanners('product_spec');
  const { data: stories = [] } = useStories();

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

  // Reset gallery to slide 0 whenever the variant selection changes.
  // Deps are the raw state values (not the derived comboKey) so this hook
  // can live unconditionally above the early returns — comboKey only changes
  // when one of these three values changes, so behaviour is identical.
  useEffect(() => { setGalleryActive(0); }, [selectedColor, selectedPot, selectedSize]);

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
    // Default to the first actual pot type when pot types are available
    setSelectedPot(pots.length ? (inStockParts[1] || pots[0].slug) : null);
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
  const selectedStock = hasVariants ? Number(variants?.stock?.[comboKey] ?? 0) : product.stock_qty;
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
  // Derive gallery images.
  // If the selected combo has dedicated image(s), show them first so the
  // relevant pot/colour is immediately visible, then append the rest of
  // product.images (deduped) so the full gallery is always accessible.
  // If no combo image exists, show product.images as-is.
  const comboImages = variants?.image_map?.[comboKey];
  let galleryImages: string[];
  if (Array.isArray(comboImages) && comboImages.length > 0) {
    galleryImages = [
      ...comboImages,
      ...(product.images || []).filter((img) => !comboImages.includes(img)),
    ];
  } else {
    galleryImages = product.images || [];
  }

  const displayImage = galleryImages[0] || product.images?.[0] || '';

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

  // Shared renderer for product-page inline banners (spec + faq placements).
  // Returns null when no active banner exists so the space collapses cleanly.
  function renderInlineBanner(banners: typeof productDetailBanners, fallbackImg: string) {
    if (!banners.length) return null;
    const b = banners[0];
    const img = b.image_url || fallbackImg;
    const hasCta = b.cta_text && b.cta_link;
    return (
      <InlineBanner banner={b} fallbackImg={img} hasCta={!!hasCta} />
    );
  }

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

        <PlantCareCard items={product.care_items} />

        <PlantogaPromise />

        <HowToGuide product={product} />

        {renderInlineBanner(productSpecBanners, 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=1400&q=80')}

        <ProductSpecification specs={productSpecs} />

        <StoriesCarousel stories={stories} />

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

        {/* Product detail page ad banner — admin controlled via Banners › Product Detail Page Banner */}
        {renderInlineBanner(productDetailBanners, 'https://images.unsplash.com/photo-1463936575829-25148e1db1b8?w=1400&q=80')}

        <ProductFaq />
      </div>

    </div>
  );
}
