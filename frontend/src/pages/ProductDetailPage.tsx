import { useEffect, useRef, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronUp, Minus, Plus, ShoppingCart, ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useProduct, useProducts } from '@/hooks/useProducts';
import { useCategories } from '@/hooks/useCategories';
import { useProductReviews } from '@/hooks/useReviews';
import { useCartStore } from '@/store/cartStore';
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
import type { Banner, Category, VariantGroup, VariantOption } from '@/types';
import { useStories } from '@/hooks/useStories';
import { StoriesCarousel } from '@/components/stories/StoriesCarousel';
import { getApiErrorDetail } from '@/lib/apiError';


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

// Full cartesian product of variant groups → combo rows (cap guards pathological products,
// matching the admin combos table cap). Each row carries the per-group option map so
// visibility/auto-select can be computed without re-walking the matrix.
function buildComboRows(
  groups: VariantGroup[],
  cap = 50,
): { key: string; groupOption: Record<string, string> }[] {
  let rows: { key: string; groupOption: Record<string, string> }[] = [{ key: '', groupOption: {} }];
  outer: for (const group of groups) {
    const options = group?.options ?? [];
    const next: { key: string; groupOption: Record<string, string> }[] = [];
    for (const row of rows) {
      for (const opt of options) {
        if (next.length >= cap) break outer;
        next.push({
          key: row.key ? `${row.key}__${opt.id}` : opt.id,
          groupOption: { ...row.groupOption, [group.id]: opt.id },
        });
      }
    }
    rows = next;
  }
  return rows;
}

function findCategoryTrail(categories: Category[] | undefined, categoryId: number): Category[] {
  if (!categories?.length) return [];

  const search = (list: Category[], trail: Category[]): Category[] | null => {
    for (const cat of list) {
      const nextTrail = [...trail, cat];
      if (cat.id === categoryId) return nextTrail;
      if (cat.children?.length) {
        const match = search(cat.children, nextTrail);
        if (match) return match;
      }
    }
    return null;
  };

  return search(categories, []) ?? [];
}

function normalizeBannerTarget(value: string | number | null | undefined): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/^\/+/, '')
    .replace(/^products\?category=/, '')
    .replace(/^products\//, '')
    .replace(/^category\//, '')
    .replace(/^(product_detail|category|type):/, '')
    .replace(/\s+/g, '-');
}

function selectProductTypeBanner(
  banners: Banner[],
  categories: Category[] | undefined,
  categoryId: number,
): Banner | null {
  if (!banners.length) return null;

  const trail = findCategoryTrail(categories, categoryId);
  const currentCategory = trail.at(-1);
  const rootCategory = trail[0];
  const currentTargets = currentCategory
    ? [
        normalizeBannerTarget(currentCategory.id),
        normalizeBannerTarget(currentCategory.slug),
        normalizeBannerTarget(currentCategory.name),
      ]
    : [];
  const rootTargets = rootCategory
    ? [
        normalizeBannerTarget(rootCategory.id),
        normalizeBannerTarget(rootCategory.slug),
        normalizeBannerTarget(rootCategory.name),
      ]
    : [];

  const findByTargets = (targets: string[]) =>
    banners.find((banner) => targets.includes(normalizeBannerTarget(banner.target_path)));

  return (
    findByTargets(currentTargets) ||
    findByTargets(rootTargets) ||
    banners.find((banner) => {
      const target = normalizeBannerTarget(banner.target_path);
      return !target || target === '*';
    }) ||
    null
  );
}

function ProductDescription({ description }: { description: string | null }) {
  if (!description?.trim()) return null;

  const blocks: Array<{ type: 'paragraph'; text: string } | { type: 'list'; items: string[] }> = [];
  let paragraphLines: string[] = [];
  let bulletItems: string[] = [];

  const flushParagraph = () => {
    if (!paragraphLines.length) return;
    blocks.push({ type: 'paragraph', text: paragraphLines.join(' ') });
    paragraphLines = [];
  };

  const flushList = () => {
    if (!bulletItems.length) return;
    blocks.push({ type: 'list', items: bulletItems });
    bulletItems = [];
  };

  description.split(/\r?\n/).forEach((rawLine) => {
    const line = rawLine.trim();
    const bulletMatch = line.match(/^(?:[-*•])\s+(.+)$/);

    if (!line) {
      flushParagraph();
      flushList();
      return;
    }

    if (bulletMatch) {
      flushParagraph();
      bulletItems.push(bulletMatch[1].trim());
      return;
    }

    flushList();
    paragraphLines.push(line);
  });

  flushParagraph();
  flushList();

  return (
    <div className="space-y-3 text-sm sm:text-base text-gray-600 leading-relaxed">
      {blocks.map((block, index) => {
        if (block.type === 'list') {
          return (
            <ul key={index} className="list-disc pl-5 space-y-1 marker:text-primary">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{item}</li>
              ))}
            </ul>
          );
        }

        return <p key={index}>{block.text}</p>;
      })}
    </div>
  );
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

function InlineBanner({ banner: b, fallbackImg, naturalSize = false }: {
  banner: Banner;
  fallbackImg: string;
  naturalSize?: boolean;
}) {
  const inner = (
    <>
      <img
        src={fallbackImg}
        alt=""
        className={
          naturalSize
            ? 'block mx-auto max-w-full h-auto'
            : 'block w-full aspect-square object-cover'
        }
        loading="lazy"
      />
    </>
  );

  if (b.cta_link) {
    return (
      <Link
        to={b.cta_link}
        className="mt-10 sm:mt-14 rounded-2xl overflow-hidden relative block"
        style={{ backgroundColor: b.bg_color || '#1B4332' }}
      >
        {inner}
      </Link>
    );
  }

  return (
    <div
      className="mt-10 sm:mt-14 rounded-2xl overflow-hidden relative"
      style={{ backgroundColor: b.bg_color || '#1B4332' }}
    >
      {inner}
    </div>
  );
}

export default function ProductDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: product, isLoading, isError } = useProduct(slug!);
  const { data: categories } = useCategories();
  const addItem = useCartStore((s) => s.addItem);
  const navigate = useNavigate();
  const [qty, setQty] = useState(1);
  // New: selectedOptions maps groupId → optionId for the new flexible variant system
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
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

  // Auto-select the first in-stock combo row when the product loads (per-combination stock).
  // The row's combo_key dictates each group's selection, so groups are always consistent
  // with a purchasable combination. Run during render (guarded by product id) instead of an
  // effect to avoid the set-state-in-effect hook violation.
  const [lastAutoSelectedProductId, setLastAutoSelectedProductId] = useState<number | null>(
    product?.id ?? null,
  );
  if (product && lastAutoSelectedProductId !== product.id) {
    const groups = product.variants?.variant_groups;
    if (!Array.isArray(groups) || groups.length === 0) {
      setLastAutoSelectedProductId(product.id);
      setSelectedOptions({});
      setQty(1);
    } else {
      const stockMap = product.variants?.stock_map ?? null;
      const rows = buildComboRows(groups);
      const firstInStock = stockMap
        ? rows.find((r) => Number(stockMap[r.key] ?? 0) > 0)
        : undefined;
      const chosen = firstInStock ?? rows[0];
      if (chosen) {
        setLastAutoSelectedProductId(product.id);
        setSelectedOptions(chosen.groupOption);
        setQty(1);
      }
    }
  }

  // Reset gallery when selection changes (guarded render-time adjustment).
  const [lastSelectedOptions, setLastSelectedOptions] = useState(selectedOptions);
  if (lastSelectedOptions !== selectedOptions) {
    setLastSelectedOptions(selectedOptions);
    setGalleryActive(0);
  }

  if (isLoading) return <Spinner className="py-32" />;
  if (isError || !product) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-gray-400">
        <p className="text-lg font-medium">Product not found</p>
        <Link to="/products" className="text-sm text-primary hover:underline mt-2">Back to Products</Link>
      </div>
    );
  }

  const variantGroups = product.variants?.variant_groups ?? [];
  const hasGroups = variantGroups.length > 0;

  // Build option lookup: optionId → option data
  const optionById: Record<string, VariantOption> = {};
  for (const group of variantGroups) {
    for (const opt of group.options ?? []) {
      optionById[opt.id] = opt;
    }
  }

  // Price: sum of selected option prices (absolute, not deltas over product.price).
  // Falls back to product.price only when no group has a selection yet — which can
  // happen briefly on first render before the auto-select effect fires, or if all
  // groups are optional and nothing has been picked.
  // NOTE: do NOT use `> 0` as the guard — a legitimately free option (price=0) would
  // incorrectly fall through to product.price.
  const hasAnySelection = Object.keys(selectedOptions).length > 0;
  const selectedOptionsPrice = Object.values(selectedOptions).reduce((sum, optId) => {
    return sum + Number(optionById[optId]?.price ?? 0);
  }, 0);
  const displayPrice = hasGroups && hasAnySelection ? selectedOptionsPrice : product.price;
  const basePrice = Number(product.price ?? 0);
  const baseOriginalPrice = Number(product.original_price ?? 0);
  const scaledVariantOriginalPrice = hasGroups && basePrice > 0 && baseOriginalPrice > basePrice
    ? Math.round(displayPrice * (baseOriginalPrice / basePrice))
    : null;
  const displayOriginalPrice = baseOriginalPrice > displayPrice
    ? baseOriginalPrice
    : scaledVariantOriginalPrice && scaledVariantOriginalPrice > displayPrice
      ? scaledVariantOriginalPrice
      : null;
  const discount = displayOriginalPrice && displayOriginalPrice > displayPrice
    ? Math.round(((displayOriginalPrice - displayPrice) / displayOriginalPrice) * 100)
    : null;

  // Per-combination stock: dense stock_map keyed by combo_key (option IDs joined by "__").
  // Source of truth for availability. Old-format products have no variant_groups / stock_map.
  const stockMap: Record<string, number> | null = hasGroups
    ? product.variants?.stock_map ?? null
    : null;
  const missingStockMap = hasGroups && !stockMap;
  // Combo rows (with per-group option maps + stock) — used for per-combo visibility.
  const comboRows = buildComboRows(variantGroups).map((row) => ({
    ...row,
    stock: Number(stockMap?.[row.key] ?? 0),
  }));

  // Option visibility: an option is visible if some combo row containing it — consistent
  // with the other groups' current selections — has stock > 0. Recomputed on every render.
  // Groups flagged `always_show_options` always render every defined option regardless of
  // stock (e.g. Small/Medium/Large always visible).
  function isOptionVisible(group: VariantGroup, opt: VariantOption): boolean {
    if (group.always_show_options) return true;
    if (!stockMap) return true;
    return comboRows.some((row) => {
      if (row.groupOption[group.id] !== opt.id) return false;
      if (row.stock <= 0) return false;
      for (const g of variantGroups) {
        if (g.id === group.id) continue;
        const sel = selectedOptions[g.id];
        if (sel && row.groupOption[g.id] !== sel) return false;
      }
      return true;
    });
  }

  // Image swapping — mirrors old image_map[comboKey] system, adapted for new opt-ID keys.
  //
  // Priority chain:
  //   1. image_map[optId1__optId2__...] — exact combo match (set in admin combinations table)
  //   2. Colour option's per-option images — fallback when only colour distinguishes the photo
  //   3. default_image — catch-all variant fallback
  //   4. product.images — plain product gallery
  //
  // Combo key = selected optionIds joined by '__' in variant_group order.
  // Only generated when ALL groups have a selection — prevents partial keys (e.g. "opt1")
  // from incorrectly matching image_map entries meant for full combinations ("opt1__opt2").
  const allGroupsHaveSelection = variantGroups.every((g) => selectedOptions[g.id]);
  const comboKey = allGroupsHaveSelection
    ? variantGroups
        .map((g) => selectedOptions[g.id])
        .filter(Boolean)
        .join('__')
    : '';

  // Stock: per-combination — the matched combo row's stock (no per-option min).
  // Old-format products fall back to the product-level stock_qty.
  const effectiveStock = hasGroups
    ? Number(stockMap?.[comboKey] ?? 0)
    : product.stock_qty;

  const imageMap: Record<string, string[]> = product.variants?.image_map ?? {};
  const comboImages: string[] = (imageMap[comboKey] ?? []).filter(Boolean);

  // Colour fallback: images on any selected option that belongs to a colour group
  const colourFallbackImages: string[] = variantGroups
    .filter((g) => /colou?r/i.test(g.label))
    .flatMap((g) => {
      const optId = selectedOptions[g.id];
      return optId ? (optionById[optId]?.images ?? []).filter(Boolean) : [];
    });

  const defaultVariantImage: string = product.variants?.default_image ?? '';

  let galleryImages: string[];
  if (comboImages.length > 0) {
    // Combo image(s) first, rest of product gallery appended (deduped)
    galleryImages = [
      ...comboImages,
      ...(product.images ?? []).filter((img) => !comboImages.includes(img)),
    ];
  } else if (colourFallbackImages.length > 0) {
    galleryImages = [
      ...colourFallbackImages,
      ...(product.images ?? []).filter((img) => !colourFallbackImages.includes(img)),
    ];
  } else if (defaultVariantImage) {
    galleryImages = [defaultVariantImage, ...(product.images ?? [])];
  } else {
    galleryImages = product.images ?? [];
  }

  // Disable Add to Cart: requires a selection for EVERY group — per-combination stock
  // needs a full combo key, so an unselected group (even a legacy `required: false`
  // one) leaves the configuration incomplete. Zero groups = simple product = enabled.
  const allGroupsSelected = hasGroups
    ? variantGroups.every((g) => selectedOptions[g.id])
    : true;
  const isUnavailable = (hasGroups && !allGroupsSelected) || missingStockMap || effectiveStock <= 0;

  // Cart options: flat array of selected option IDs (Task 6)
  const cartSelectedOptions: string[] = Object.values(selectedOptions);

  function selectOption(groupId: string, optionId: string) {
    const clickedGroup = variantGroups.find((g) => g.id === groupId);

    // Stale-selection guard for always-show groups: a picked option (e.g. a size) may
    // have no in-stock combo with the customer's currently-selected options in other
    // groups. Re-derive those groups from the first in-stock combo that preserves as
    // many of their current picks as possible, so we never strand them on a hidden
    // colour / dead "Out of Stock" state. If nothing is in stock for this pick at all,
    // keep the plain selection and let effectiveStock <= 0 show "Out of Stock" honestly.
    if (clickedGroup?.always_show_options && stockMap) {
      const candidates = comboRows.filter(
        (row) =>
          row.groupOption[groupId] === optionId &&
          Number(stockMap[row.key] ?? 0) > 0,
      );
      if (candidates.length > 0) {
        let best = candidates[0];
        let bestScore = -1;
        for (const row of candidates) {
          let score = 0;
          for (const g of variantGroups) {
            if (g.id === groupId) continue;
            const sel = selectedOptions[g.id];
            if (sel && row.groupOption[g.id] === sel) score++;
          }
          // Strict > over comboRows' cartesian (admin-defined) order → tie-break is
          // "first in defined order", matching auto-select and the admin combos table.
          if (score > bestScore) {
            bestScore = score;
            best = row;
          }
        }
        setSelectedOptions(best.groupOption);
        setQty(1);
        if (window.innerWidth < 768) {
          galleryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        return;
      }
    }

    setSelectedOptions((prev) => ({ ...prev, [groupId]: optionId }));
    setQty(1);
    // On mobile the gallery sits above the variant selector and scrolls out of view.
    // Scroll back to the top of the page (galleryRef) so the image update is visible.
    // Skip on md+ breakpoints where the gallery is always in the left column.
    if (window.innerWidth < 768) {
      galleryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  async function handleAddToCart() {
    try {
      await addItem(product!.id, qty, product!, cartSelectedOptions.length ? cartSelectedOptions : null);
      toast.success(`${product!.name} added to cart`);
    } catch (err) {
      toast.error(getApiErrorDetail(err, 'Failed to add'));
    }
  }

  async function handleBuyNow() {
    try {
      await addItem(product!.id, 1, product!, cartSelectedOptions.length ? cartSelectedOptions : null);
      useCartStore.getState().closeDrawer();
      navigate('/cart');
    } catch (err) {
      toast.error(getApiErrorDetail(err, 'Failed to process'));
    }
  }

  const similarProducts = similar?.items.filter((p) => p.id !== product.id).slice(0, 4) ?? [];
  const productDetailBanner = selectProductTypeBanner(productDetailBanners, categories, product.category_id);
  const productSpecBanner = selectProductTypeBanner(productSpecBanners, categories, product.category_id);
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

  function renderInlineBannerItem(banner: Banner | null, fallbackImg: string) {
    if (!banner) return null;
    const img = banner.image_url || fallbackImg;
    return <InlineBanner banner={banner} fallbackImg={img} naturalSize />;
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
                  <span className="text-base sm:text-lg text-red-500 line-through">₹{displayOriginalPrice}</span>
                  <span className="text-xs sm:text-sm font-semibold text-accent bg-accent/10 px-2 py-0.5 rounded">
                    {discount}% OFF
                  </span>
                </>
              )}
            </div>

            {missingStockMap ? (
              <p className="text-sm text-amber-600 font-medium">
                This product isn&apos;t configured correctly (missing stock information).
              </p>
            ) : effectiveStock > 0 ? (
              <p className="text-sm text-green-600 font-medium">
                In Stock {effectiveStock <= 5 && `(Only ${effectiveStock} left)`}
              </p>
            ) : (
              <p className="text-sm text-red-500 font-medium">Out of Stock</p>
            )}

            {/* Flexible Variant Picker — smart rendering per group type */}
            {hasGroups && (
              missingStockMap ? (
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 flex gap-2 items-start text-xs text-amber-800">
                  <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                  <span>
                    Variant options are temporarily unavailable for this product. Please check back later.
                  </span>
                </div>
              ) : (
              <div className="space-y-4">
                {/* Always-show groups (e.g. Select Size) render on top of colours/pots,
                    regardless of their admin-defined order. Stable sort preserves relative
                    order within each bucket; combo keys keep using variantGroups order. */}
                {[...variantGroups]
                  .sort((a, b) => Number(Boolean(b.always_show_options)) - Number(Boolean(a.always_show_options)))
                  .map((group) => {
                  const isColourGroup = /colou?r/i.test(group.label);
                  // Only options with at least one in-stock combo — consistent with the other
                  // groups' current selections — are rendered.
                  const visibleOptions = (group.options ?? []).filter((o) => isOptionVisible(group, o));
                  const hasOptionImages = visibleOptions.some((o) => o.images?.[0]);
                  // Render mode: colour → circular swatches; has images → image cards; else → pill chips
                  const renderMode: 'colour' | 'image-card' | 'pill' =
                    isColourGroup ? 'colour' : hasOptionImages ? 'image-card' : 'pill';

                  // Group has no purchasable options — hide it entirely.
                  if (visibleOptions.length === 0) return null;

                  return (
                    <div key={group.id}>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                        {group.label}
                      </p>

                      {/* ── Colour swatches ─────────────────────────────── */}
                      {renderMode === 'colour' && (
                        <div className="flex flex-wrap gap-2.5">
                          {visibleOptions.map((opt) => {
                            const isSelected = selectedOptions[group.id] === opt.id;
                            const hex: string = opt.color_hex || '';
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => selectOption(group.id, opt.id)}
                                title={opt.name}
                                aria-label={opt.name}
                                className={`relative h-9 w-9 rounded-full border-2 transition focus:outline-none
                                  ${isSelected ? 'border-primary ring-2 ring-primary/20' : 'border-gray-200 hover:border-primary/40'}
                                  cursor-pointer
                                `}
                                style={{ backgroundColor: hex || '#e5e7eb' }}
                              />
                            );
                          })}
                        </div>
                      )}

                      {/* ── Image cards (pot type, style, etc.) ─────────── */}
                      {renderMode === 'image-card' && (
                        <div className="flex flex-wrap gap-2">
                          {visibleOptions.map((opt) => {
                            const isSelected = selectedOptions[group.id] === opt.id;
                            const priceDelta = Number(opt.price ?? 0);
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => selectOption(group.id, opt.id)}
                                className={`relative flex flex-col items-center rounded-xl border-2 p-2 w-[88px] transition focus:outline-none
                                  ${isSelected
                                    ? 'border-primary bg-primary/5 shadow-sm'
                                    : 'border-gray-200 hover:border-primary/60 bg-white cursor-pointer'
                                  }`}
                              >
                                <div className="h-14 w-14 rounded-lg overflow-hidden bg-gray-50 mb-1.5 shrink-0">
                                  {opt.images?.[0] ? (
                                    <img
                                      src={opt.images[0]}
                                      alt={opt.name}
                                      className="h-full w-full object-cover"
                                      loading="lazy"
                                    />
                                  ) : (
                                    <div className="h-full w-full flex items-center justify-center text-gray-300">
                                      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.5}>
                                        <rect x="3" y="3" width="18" height="18" rx="2"/>
                                        <circle cx="8.5" cy="8.5" r="1.5"/>
                                        <path d="M21 15l-5-5L5 21"/>
                                      </svg>
                                    </div>
                                  )}
                                </div>
                                <span className={`text-[11px] font-semibold text-center leading-tight line-clamp-2 ${isSelected ? 'text-primary' : 'text-gray-800'}`}>
                                  {opt.name}
                                </span>
                                {priceDelta > 0 && (
                                  <span className={`text-[10px] mt-0.5 font-medium ${isSelected ? 'text-primary/80' : 'text-gray-400'}`}>
                                    +₹{priceDelta}
                                  </span>
                                )}
                                {priceDelta === 0 && (
                                  <span className={`text-[10px] mt-0.5 font-medium ${isSelected ? 'text-primary/80' : 'text-gray-400'}`}>
                                    Included
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* ── Pill chips (size, weight, etc.) ─────────────── */}
                      {renderMode === 'pill' && (
                        <div className="flex flex-wrap gap-2">
                          {visibleOptions.map((opt) => {
                            const isSelected = selectedOptions[group.id] === opt.id;
                            const priceDelta = Number(opt.price ?? 0);
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => selectOption(group.id, opt.id)}
                                className={`px-4 py-2 rounded-full border-2 text-sm font-semibold transition focus:outline-none
                                  ${isSelected
                                    ? 'bg-primary border-primary text-white shadow-sm'
                                    : 'border-gray-200 text-gray-700 hover:border-primary hover:text-primary bg-white'
                                  }`}
                              >
                                {opt.name}
                                {priceDelta > 0 && (
                                  <span className={`ml-1.5 text-xs font-normal ${isSelected ? 'text-white/80' : 'text-gray-400'}`}>
                                    +₹{priceDelta}
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              )
            )}

            {/* Desktop add to cart */}
            {!isUnavailable && (
              <div className="hidden md:flex items-center gap-4">
                <div className="flex items-center border rounded-xl">
                  <button onClick={() => setQty(Math.max(1, qty - 1))} className="p-3 hover:bg-gray-50 transition touch-target">
                    <Minus size={16} />
                  </button>
                  <span className="px-4 font-medium">{qty}</span>
                  <button onClick={() => setQty(Math.min(effectiveStock, qty + 1))} className="p-3 hover:bg-gray-50 transition touch-target">
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
                  <button onClick={() => setQty(Math.min(effectiveStock, qty + 1))} className="px-4 py-3 touch-target">
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

            <ProductDescription description={product.description} />

            <CareTips tips={product.care_tips || []} />
          </div>
        </div>

        <PlantCareCard careCardImage={product.care_card_image} />

        <PlantogaPromise bannerImage={product.promise_banner_image} />

        <HowToGuide product={product} />

        {renderInlineBannerItem(productSpecBanner, 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=1400&q=80')}

        <ProductSpecification specs={productSpecs} />

        <StoriesCarousel stories={stories} />

        <WhyPlantoga bannerImage={product.why_plantoga_banner_image} />

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
        {renderInlineBannerItem(productDetailBanner, 'https://images.unsplash.com/photo-1463936575829-25148e1db1b8?w=1400&q=80')}

        <ProductFaq faqs={product.faqs} />
      </div>

    </div>
  );
}
