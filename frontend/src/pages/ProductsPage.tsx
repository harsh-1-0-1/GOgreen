import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ChevronDown, SlidersHorizontal, X } from 'lucide-react';
import { useProducts } from '@/hooks/useProducts';
import { useCategories } from '@/hooks/useCategories';
import { useBanners } from '@/hooks/useBanners';
import ProductCard from '@/components/product/ProductCard';
import ResponsiveBannerImage from '@/components/banner/ResponsiveBannerImage';
import { getTagStyle, getReadableTextColor, shadeColor } from '@/components/product/productTagBadges.utils';
import { toTagKey } from '@/lib/tagKey';
import { useTags } from '@/hooks/useTags';
import SkeletonCard from '@/components/ui/SkeletonCard';
import ErrorBoundary from '@/components/ui/ErrorBoundary';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import type { Banner } from '@/types';

const SORT_OPTIONS = [
  { value: '', label: 'Relevance' },
  { value: 'price_asc', label: 'Price: Low → High' },
  { value: 'price_desc', label: 'Price: High → Low' },
  { value: 'newest', label: 'Newest First' },
  { value: 'discount', label: 'Best Discount' },
];

function formatSlugTitle(value: string) {
  return value
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function TrendingPromoBanner({
  banners,
  images,
  isLoading,
}: {
  banners: Banner[];
  images: string[];
  isLoading: boolean;
}) {
  const fallbackSlides: Banner[] = [
    {
      id: -101,
      title: 'Perfect plants for effortless indoor garden',
      subtitle: 'starting ₹699',
      cta_text: 'SHOP NOW',
      cta_link: '/products',
      image_url: images[0] || undefined,
      bg_color: '#e9dfc9',
      text_color: '#ffeb3b',
      placement: 'trending',
      position: 0,
      is_active: true,
    },
    {
      id: -102,
      title: 'Fresh greens for every bright corner',
      subtitle: 'price drop',
      cta_text: 'SHOP NOW',
      cta_link: '/products',
      image_url: images[1] || images[0] || undefined,
      bg_color: '#164d3b',
      text_color: '#ffeb3b',
      placement: 'trending',
      position: 1,
      is_active: true,
    },
    {
      id: -103,
      title: 'Easy care picks for your home',
      subtitle: 'trending now',
      cta_text: 'SHOP NOW',
      cta_link: '/products',
      image_url: images[2] || images[0] || undefined,
      bg_color: '#f1dfbd',
      text_color: '#ffeb3b',
      placement: 'trending',
      position: 2,
      is_active: true,
    },
  ];
  const slides = banners.length > 0 ? banners : fallbackSlides;
  const [current, setCurrent] = useState(0);

  const [lastSlideLens, setLastSlideLens] = useState<[number, number]>([
    banners.length,
    images.length,
  ]);
  if (banners.length !== lastSlideLens[0] || images.length !== lastSlideLens[1]) {
    setLastSlideLens([banners.length, images.length]);
    setCurrent(0);
  }

  useEffect(() => {
    if (slides.length <= 1) return;
    const id = window.setTimeout(
      () => setCurrent((index) => (index + 1) % slides.length),
      3500,
    );
    return () => window.clearTimeout(id);
  }, [current, slides.length]);

  if (isLoading) {
    return (
      <div className="mb-6 h-[260px] w-full animate-pulse rounded-none bg-gray-100 sm:mb-8 sm:h-[300px] sm:rounded-2xl md:h-[340px] lg:h-[380px] xl:h-[400px]" />
    );
  }

  return (
    <section className="relative -mx-3 mb-6 h-[260px] overflow-hidden bg-[#e9dfc9] sm:mx-0 sm:mb-8 sm:h-[300px] sm:rounded-2xl md:h-[340px] lg:h-[380px] xl:h-[400px]">
      <div
        className="flex h-full transition-transform duration-700 ease-in-out"
        style={{ transform: `translateX(-${current * 100}%)` }}
      >
        {slides.map((slide, slideIndex) => {
          const slideClass =
            'relative h-full w-full shrink-0 overflow-hidden block';
          const slideStyle = {
            backgroundColor: slide.bg_color || '#e9dfc9',
          };

          const slideImage = (
            <ResponsiveBannerImage
              banner={{ ...slide, image_url: slide.image_url || images[0] }}
              loading={slideIndex === 0 ? 'eager' : 'lazy'}
            />
          );

          return slide.cta_link ? (
            <Link
              key={slide.id || slideIndex}
              to={slide.cta_link}
              className={slideClass}
              style={slideStyle}
            >
              {slideImage}
            </Link>
          ) : (
            <div
              key={slide.id || slideIndex}
              className={slideClass}
              style={slideStyle}
            >
              {slideImage}
            </div>
          );
        })}
      </div>

      <div className="absolute bottom-2.5 left-1/2 flex -translate-x-1/2 gap-1.5 sm:bottom-3">
        {slides.map((slide, index) => (
          <button
            key={slide.id || index}
            type="button"
            onClick={() => setCurrent(index)}
            className={`h-1.5 rounded-full transition-all ${
              index === current ? 'w-6 bg-white' : 'w-1.5 bg-white/55'
            }`}
            aria-label={`Show trending banner ${index + 1}`}
          />
        ))}
      </div>
    </section>
  );
}

// ── Filter Panel (used inside both the top-bar dropdown and mobile sheet) ───

function CategoryFilter({
  selectedCategories,
  onCategoryToggle,
}: {
  selectedCategories: string[];
  onCategoryToggle: (slug: string) => void;
}) {
  const { data: categories } = useCategories();
  const selectedCategorySet = new Set(selectedCategories);
  const categoryNames = useMemo(() => {
    const map = new Map<string, string>();
    (categories ?? []).forEach((c) => {
      map.set(c.slug, c.name);
      (c.children ?? []).forEach((child) => map.set(child.slug, child.name));
    });
    return map;
  }, [categories]);

  const [expandedParents, setExpandedParents] = useState<Record<string, boolean>>({});

  return (
    <div className="w-64">
      {/* Selected chips */}
      {selectedCategories.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {selectedCategories.map((slug) => {
            const label = categoryNames.get(slug) ?? formatSlugTitle(slug);
            return (
              <span
                key={slug}
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 py-1 pl-2.5 pr-1 text-xs font-medium text-primary"
              >
                <span className="max-w-[9rem] truncate">{label}</span>
                <button
                  type="button"
                  onClick={() => onCategoryToggle(slug)}
                  aria-label={`Remove ${label} filter`}
                  className="rounded-full p-0.5 transition hover:bg-primary/20"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}

      <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-100 p-1">
        {(categories ?? []).map((c) => {
          const children = c.children ?? [];
          const parentSelected = selectedCategorySet.has(c.slug);
          const isOpen =
            expandedParents[c.slug] ??
            children.some((child) => selectedCategorySet.has(child.slug));
          return (
            <div key={c.slug}>
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => {
                    onCategoryToggle(c.slug);
                    if (children.length) {
                      setExpandedParents((prev) => ({ ...prev, [c.slug]: true }));
                    }
                  }}
                  aria-pressed={parentSelected}
                  className={`flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition ${parentSelected ? 'bg-primary/10 font-medium text-primary' : 'hover:bg-gray-50'}`}
                >
                  <span
                    aria-hidden="true"
                    className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border text-[9px] leading-none ${parentSelected ? 'border-primary bg-primary text-white' : 'border-gray-300 bg-white'}`}
                  >
                    {parentSelected ? '✓' : ''}
                  </span>
                  <span className="truncate">{c.name}</span>
                </button>
                {children.length > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedParents((prev) => ({ ...prev, [c.slug]: !isOpen }))
                    }
                    aria-expanded={isOpen}
                    aria-label={`${isOpen ? 'Hide' : 'Show'} subcategories of ${c.name}`}
                    className="rounded-md p-2 text-gray-400 transition hover:bg-gray-50 hover:text-gray-600"
                  >
                    <ChevronRight
                      className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                    />
                  </button>
                )}
              </div>
              {isOpen && children.length > 0 && (
                <div className="ml-3 border-l border-gray-200 pl-2">
                  {children.map((child) => {
                    const childSelected = selectedCategorySet.has(child.slug);
                    return (
                      <button
                        key={child.slug}
                        type="button"
                        onClick={() => onCategoryToggle(child.slug)}
                        aria-pressed={childSelected}
                        className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition ${childSelected ? 'bg-primary/10 font-medium text-primary' : 'text-gray-600 hover:bg-gray-50'}`}
                      >
                        <span
                          aria-hidden="true"
                          className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border text-[9px] leading-none ${childSelected ? 'border-primary bg-primary text-white' : 'border-gray-300 bg-white'}`}
                        >
                          {childSelected ? '✓' : ''}
                        </span>
                        <span className="truncate">{child.name}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
        {(categories ?? []).length === 0 && (
          <p className="px-2 py-3 text-center text-xs text-gray-400">No categories yet.</p>
        )}
      </div>
    </div>
  );
}

// A single dropdown pill used in the top filter bar
function FilterDropdown({
  label,
  active,
  children,
}: {
  label: React.ReactNode;
  active?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition ${
          active
            ? 'border-primary bg-primary/5 text-primary'
            : 'border-gray-200 bg-white text-gray-700 hover:border-gray-400'
        }`}
      >
        {label}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-40 mt-2 rounded-xl border border-gray-100 bg-white p-3 shadow-xl">
          {children}
        </div>
      )}
    </div>
  );
}

// ── Full-page filter sheet for mobile ──────────────────────────────────────

function MobileFilterSheet({
  open,
  onClose,
  selectedCategories,
  onCategoryToggle,
  minPrice,
  maxPrice,
  onMinPriceChange,
  onMaxPriceChange,
  selectedTags,
  onTagToggle,
  onReset,
  tagOptions,
  selectedTagKeys,
}: {
  open: boolean;
  onClose: () => void;
  selectedCategories: string[];
  onCategoryToggle: (slug: string) => void;
  minPrice: string;
  maxPrice: string;
  onMinPriceChange: (v: string) => void;
  onMaxPriceChange: (v: string) => void;
  selectedTags: string[];
  onTagToggle: (tag: string) => void;
  onReset: () => void;
  tagOptions: { key: string; label: string; color: string | null }[];
  selectedTagKeys: Set<string>;
}) {
  useBodyScrollLock(open);
  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl max-h-[85vh] flex flex-col animate-slide-up">
        <div className="flex items-center justify-between p-4 border-b shrink-0">
          <h3 className="font-bold flex items-center gap-2">
            <SlidersHorizontal size={18} /> Filters
          </h3>
          <div className="flex items-center gap-3">
            <button onClick={onReset} className="text-xs text-primary hover:underline">Clear All</button>
            <button onClick={onClose} className="p-2"><X size={20} /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Category */}
          <div>
            <h4 className="font-semibold text-sm mb-3">Category</h4>
            <CategoryFilter
              selectedCategories={selectedCategories}
              onCategoryToggle={onCategoryToggle}
            />
          </div>

          {/* Price */}
          <div>
            <h4 className="font-semibold text-sm mb-3">Price Range</h4>
            <div className="flex gap-2 items-center">
              <input
                type="number"
                placeholder="Min"
                value={minPrice}
                onChange={(e) => onMinPriceChange(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <span className="text-gray-300">—</span>
              <input
                type="number"
                placeholder="Max"
                value={maxPrice}
                onChange={(e) => onMaxPriceChange(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Tags */}
          <div>
            <h4 className="font-semibold text-sm mb-3">Tags</h4>
            <div className="flex flex-wrap gap-2">
              {tagOptions.map((tag) => {
                const isSelected = selectedTagKeys.has(tag.key);
                const style = tag.color
                  ? {
                      backgroundColor: tag.color,
                      color: getReadableTextColor(tag.color),
                      borderColor: shadeColor(tag.color, -0.18),
                    }
                  : {
                      backgroundColor: getTagStyle(tag.key).bg,
                      color: getTagStyle(tag.key).text,
                      borderColor: getTagStyle(tag.key).border,
                    };
                return (
                  <button
                    key={tag.key}
                    onClick={() => onTagToggle(tag.key)}
                    className={`px-3 py-1.5 text-xs rounded-full border transition-all font-medium ${
                      isSelected ? '' : 'text-gray-600 border-gray-200 hover:border-gray-300'
                    }`}
                    style={isSelected ? style : undefined}
                  >
                    {tag.label}
                  </button>
                );
              })}
              {tagOptions.length === 0 && (
                <p className="text-xs text-gray-400">No tags yet.</p>
              )}
            </div>
          </div>
        </div>

        <div className="shrink-0 p-4 border-t safe-bottom">
          <button
            onClick={onClose}
            className="w-full py-3 bg-primary text-white rounded-xl font-medium"
          >
            Apply Filters
          </button>
        </div>
      </div>
    </>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function ProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const categoryParam = searchParams.get('category') || searchParams.get('subcategory') || '';
  const categoryListParam = searchParams.get('categories') || '';
  const selectedCategories = useMemo(() => {
    const slugs = [...categoryListParam.split(','), categoryParam];
    return Array.from(new Set(slugs.map((s) => s.trim()).filter(Boolean)));
  }, [categoryListParam, categoryParam]);
  const search = searchParams.get('search') || '';
  const collectionTitle = searchParams.get('collection_title') || '';
  const sort = searchParams.get('sort_by') || '';
  const displaySection = searchParams.get('display_section') || '';
  const page = Number(searchParams.get('page')) || 1;
  const [minPrice, setMinPrice] = useState(searchParams.get('min_price') || '');
  const [maxPrice, setMaxPrice] = useState(searchParams.get('max_price') || '');
  const tagParam = searchParams.get('tags') || searchParams.get('tag') || '';
  const selectedTags = useMemo(() => tagParam.split(',').filter(Boolean), [tagParam]);

  function updateParams(updates: Record<string, string>) {
    const params = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([k, v]) => {
      if (v) params.set(k, v);
      else params.delete(k);
    });
    params.delete('page');
    setSearchParams(params);
  }

  function setPage(p: number) {
    const params = new URLSearchParams(searchParams);
    if (p > 1) params.set('page', String(p));
    else params.delete('page');
    setSearchParams(params);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleCategoryToggle(slug: string) {
    const next = selectedCategories.includes(slug)
      ? selectedCategories.filter((c) => c !== slug)
      : [...selectedCategories, slug];
    const params = new URLSearchParams(searchParams);
    params.delete('category');
    params.delete('subcategory');
    if (next.length) params.set('categories', next.join(','));
    else params.delete('categories');
    params.delete('page');
    setSearchParams(params);
  }

  function handleTagToggle(tag: string) {
    const next = selectedTags.includes(tag) ? selectedTags.filter((t) => t !== tag) : [...selectedTags, tag];
    updateParams({ tags: next.join(',') });
  }

  function resetFilters() {
    setMinPrice('');
    setMaxPrice('');
    setSearchParams({});
  }

  const { data, isLoading } = useProducts({
    categories: selectedCategories.length ? selectedCategories.join(',') : undefined,
    search: search || undefined,
    sort_by: sort || undefined,
    display_section: displaySection || undefined,
    min_price: minPrice ? Number(minPrice) : undefined,
    max_price: maxPrice ? Number(maxPrice) : undefined,
    tags: selectedTags.length ? selectedTags.join(',') : undefined,
    page,
    limit: 20,
  });
  const { data: trendingBanners = [], isLoading: trendingBannersLoading } =
    useBanners('trending');

  const isTrendingPage =
    (sort === 'popular' || displaySection === 'trending') &&
    !search &&
    selectedCategories.length === 0 &&
    !minPrice &&
    !maxPrice &&
    selectedTags.length === 0;
  const isNewestPage =
    sort === 'newest' &&
    !search &&
    selectedCategories.length === 0 &&
    !minPrice &&
    !maxPrice &&
    selectedTags.length === 0;

  const trendingBannerImages =
    data?.items.flatMap((product) => product.images ?? []).filter(Boolean) ?? [];

  const categoryTitle =
    selectedCategories.length === 1
      ? formatSlugTitle(selectedCategories[0])
      : selectedCategories.length > 1
        ? selectedCategories.map(formatSlugTitle).join(' + ')
        : '';
  const pageTitle = search
    ? `Results for "${search}"`
    : collectionTitle
      ? collectionTitle
      : isTrendingPage
        ? 'Price Drop!'
        : isNewestPage
          ? 'New Arrivals'
          : categoryTitle
            ? categoryTitle
            : selectedTags.length === 1
              ? formatSlugTitle(selectedTags[0])
              : selectedTags.length > 1
                ? selectedTags.map(formatSlugTitle).join(' + ')
                : 'All Products';

  // Tag options (shared between top-bar and mobile sheet)
  const { data: savedTags = [] } = useTags();
  const legacyTags = [
    'indoor', 'outdoor', 'flowering', 'low-maintenance',
    'air-purifying', 'pet-friendly', 'beginner-friendly', 'vastu-friendly',
  ];
  const tagOptions =
    savedTags.length > 0
      ? savedTags
          .filter((t) => t.is_active)
          .map((t) => ({ key: toTagKey(t.name), label: t.name, color: t.color || null }))
          .filter((t) => t.key)
      : legacyTags.map((t) => ({ key: t, label: formatSlugTitle(t), color: null }));

  const selectedTagKeys = new Set(selectedTags.map(toTagKey));

  // Active filter count for badge
  const activeFilterCount =
    selectedCategories.length +
    selectedTags.length +
    (minPrice ? 1 : 0) +
    (maxPrice ? 1 : 0);

  return (
    <div className="w-full px-3 sm:px-6 xl:px-10 py-3 sm:py-4">
      {isTrendingPage && (
        <TrendingPromoBanner
          banners={trendingBanners}
          images={trendingBannerImages}
          isLoading={isLoading || trendingBannersLoading}
        />
      )}

      {/* Page heading */}
      <div className="mb-4">
        <h1 className="text-2xl sm:text-3xl font-bold">{pageTitle}</h1>
        {data?.total !== undefined && (
          <p className="text-sm text-gray-500 mt-0.5">{data.total} products</p>
        )}
      </div>

      {/* ── Top Filter Bar ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-5 flex-wrap border-b border-gray-100 pb-4">

        {/* Mobile: single "Filter" button that opens the bottom sheet */}
        <button
          onClick={() => setMobileFiltersOpen(true)}
          className="sm:hidden flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium border-gray-200 bg-white text-gray-700 hover:border-gray-400 transition"
        >
          <SlidersHorizontal size={15} />
          Filter
          {activeFilterCount > 0 && (
            <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
              {activeFilterCount}
            </span>
          )}
        </button>

        {/* Desktop: inline dropdown pills */}
        <div className="hidden sm:flex items-center gap-2 flex-wrap">
          {/* Category dropdown */}
          <FilterDropdown
            label={
              selectedCategories.length > 0
                ? `Category (${selectedCategories.length})`
                : 'Category'
            }
            active={selectedCategories.length > 0}
          >
            <CategoryFilter
              selectedCategories={selectedCategories}
              onCategoryToggle={handleCategoryToggle}
            />
          </FilterDropdown>

          {/* Price dropdown */}
          <FilterDropdown
            label="Price"
            active={Boolean(minPrice || maxPrice)}
          >
            <div className="flex gap-2 items-center w-56">
              <input
                type="number"
                placeholder="Min ₹"
                value={minPrice}
                onChange={(e) => { setMinPrice(e.target.value); updateParams({ min_price: e.target.value }); }}
                className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <span className="text-gray-300 shrink-0">—</span>
              <input
                type="number"
                placeholder="Max ₹"
                value={maxPrice}
                onChange={(e) => { setMaxPrice(e.target.value); updateParams({ max_price: e.target.value }); }}
                className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </FilterDropdown>

          {/* Tags dropdown */}
          <FilterDropdown
            label={selectedTags.length > 0 ? `Tags (${selectedTags.length})` : 'Tags'}
            active={selectedTags.length > 0}
          >
            <div className="flex flex-wrap gap-2 max-w-xs">
              {tagOptions.map((tag) => {
                const isSelected = selectedTagKeys.has(tag.key);
                const style = tag.color
                  ? {
                      backgroundColor: tag.color,
                      color: getReadableTextColor(tag.color),
                      borderColor: shadeColor(tag.color, -0.18),
                    }
                  : {
                      backgroundColor: getTagStyle(tag.key).bg,
                      color: getTagStyle(tag.key).text,
                      borderColor: getTagStyle(tag.key).border,
                    };
                return (
                  <button
                    key={tag.key}
                    onClick={() => handleTagToggle(tag.key)}
                    className={`px-3 py-1.5 text-xs rounded-full border transition-all font-medium ${
                      isSelected ? '' : 'text-gray-600 border-gray-200 hover:border-gray-300'
                    }`}
                    style={isSelected ? style : undefined}
                  >
                    {tag.label}
                  </button>
                );
              })}
              {tagOptions.length === 0 && (
                <p className="text-xs text-gray-400">No tags yet.</p>
              )}
            </div>
          </FilterDropdown>

          {/* Clear all — only shown when something is active */}
          {activeFilterCount > 0 && (
            <button
              onClick={resetFilters}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-primary transition px-2"
            >
              <X size={14} /> Clear all
            </button>
          )}
        </div>

        {/* Sort — always visible, pushed to the right */}
        <div className="ml-auto relative flex items-center gap-2">
          <span className="hidden sm:inline text-sm text-gray-500">Sort by</span>
          <div className="relative">
            <select
              value={sort}
              onChange={(e) => updateParams({ sort_by: e.target.value })}
              className="appearance-none bg-white border border-gray-200 rounded-full py-2 pl-4 pr-8 text-sm font-medium text-gray-700 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary hover:border-gray-400 transition cursor-pointer"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Active filter chips row */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-2 mb-4 -mt-2">
          {selectedCategories.map((slug) => (
            <span
              key={slug}
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 py-1 pl-2.5 pr-1 text-xs font-medium text-primary"
            >
              {formatSlugTitle(slug)}
              <button
                type="button"
                onClick={() => handleCategoryToggle(slug)}
                className="rounded-full p-0.5 transition hover:bg-primary/20"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {selectedTags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 py-1 pl-2.5 pr-1 text-xs font-medium text-primary"
            >
              {formatSlugTitle(tag)}
              <button
                type="button"
                onClick={() => handleTagToggle(tag)}
                className="rounded-full p-0.5 transition hover:bg-primary/20"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          {(minPrice || maxPrice) && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 py-1 pl-2.5 pr-1 text-xs font-medium text-primary">
              ₹{minPrice || '0'} – ₹{maxPrice || '∞'}
              <button
                type="button"
                onClick={() => { setMinPrice(''); setMaxPrice(''); updateParams({ min_price: '', max_price: '' }); }}
                className="rounded-full p-0.5 transition hover:bg-primary/20"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          )}
        </div>
      )}

      {/* ── Mobile filter sheet ─────────────────────────────────────────── */}
      <MobileFilterSheet
        open={mobileFiltersOpen}
        onClose={() => setMobileFiltersOpen(false)}
        selectedCategories={selectedCategories}
        onCategoryToggle={handleCategoryToggle}
        minPrice={minPrice}
        maxPrice={maxPrice}
        onMinPriceChange={(v) => { setMinPrice(v); updateParams({ min_price: v }); }}
        onMaxPriceChange={(v) => { setMaxPrice(v); updateParams({ max_price: v }); }}
        selectedTags={selectedTags}
        onTagToggle={handleTagToggle}
        onReset={resetFilters}
        tagOptions={tagOptions}
        selectedTagKeys={selectedTagKeys}
      />

      {/* ── Product grid (full width) ──────────────────────────────────── */}
      <ErrorBoundary>
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : data?.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
            <p className="text-lg font-medium">No products found</p>
            <button onClick={resetFilters} className="text-sm text-primary hover:underline">Reset Filters</button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {data?.items.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </ErrorBoundary>

      {/* Pagination */}
      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8 sm:mt-10">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="p-2 border rounded-lg hover:bg-gray-50 disabled:opacity-30">
            <ChevronLeft size={18} />
          </button>
          {Array.from({ length: data.pages }, (_, i) => i + 1)
            .filter((p) => p === 1 || p === data.pages || Math.abs(p - page) <= 1)
            .map((p, idx, arr) => (
              <span key={p}>
                {idx > 0 && arr[idx - 1] !== p - 1 && <span className="px-1 text-gray-300">…</span>}
                <button
                  onClick={() => setPage(p)}
                  className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg text-sm font-medium transition ${p === page ? 'bg-primary text-white' : 'hover:bg-gray-50 border'}`}
                >
                  {p}
                </button>
              </span>
            ))}
          <button disabled={page >= data.pages} onClick={() => setPage(page + 1)} className="p-2 border rounded-lg hover:bg-gray-50 disabled:opacity-30">
            <ChevronRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
