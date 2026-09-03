import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ChevronDown, SlidersHorizontal, X } from 'lucide-react';
import { useProducts } from '@/hooks/useProducts';
import { useCategories } from '@/hooks/useCategories';
import { useBanners } from '@/hooks/useBanners';
import ProductCard from '@/components/product/ProductCard';
import { getTagStyle } from '@/components/product/productTagBadges.utils';
import SkeletonCard from '@/components/ui/SkeletonCard';
import ErrorBoundary from '@/components/ui/ErrorBoundary';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import type { Banner, Category } from '@/types';

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
      cta_link: '/products?sort_by=popular',
      image_url: images[0] || '/page-banner-default.jpeg',
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
      cta_link: '/products?sort_by=popular',
      image_url: images[1] || images[0] || '/page-banner-default.jpeg',
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
      cta_link: '/products?sort_by=popular',
      image_url: images[2] || images[0] || '/page-banner-default.jpeg',
      bg_color: '#f1dfbd',
      text_color: '#ffeb3b',
      placement: 'trending',
      position: 2,
      is_active: true,
    },
  ];
  const slides = banners.length > 0 ? banners : fallbackSlides;
  const [current, setCurrent] = useState(0);

  // Reset to the first slide when the slide set changes — guarded render-time
  // adjustment replaces a synchronous setState effect.
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
      <div className="mb-6 aspect-square w-full animate-pulse rounded-none bg-gray-100 sm:mb-8 sm:rounded-2xl lg:aspect-[16/7]" />
    );
  }

  return (
    <section className="relative -mx-3 mb-6 aspect-square overflow-hidden bg-[#e9dfc9] sm:mx-0 sm:mb-8 sm:rounded-2xl lg:aspect-[16/7]">
      <div
        className="flex h-full transition-transform duration-700 ease-in-out"
        style={{ transform: `translateX(-${current * 100}%)` }}
      >
        {slides.map((slide, slideIndex) => {
          const sideImages = images
            .filter((src) => src && src !== slide.image_url)
            .slice(0, 3);

          return (
            <Link
              key={slide.id || slideIndex}
              to={slide.cta_link || '/products?sort_by=popular'}
              className="relative h-full w-full shrink-0 overflow-hidden block"
              style={{ backgroundColor: slide.bg_color || '#e9dfc9' }}
            >
              <img
                src={slide.image_url || images[0] || '/page-banner-default.jpeg'}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
                loading={slideIndex === 0 ? 'eager' : 'lazy'}
              />
              {sideImages.map((src, index) => (
                <img
                  key={`${src}-${index}`}
                  src={src}
                  alt=""
                  className={[
                    'absolute hidden rounded-xl border-4 border-white/85 object-cover shadow-xl sm:block',
                    index === 0 && 'right-[9%] top-[14%] h-[34%] w-[22%] rotate-3',
                    index === 1 && 'right-[23%] bottom-[12%] h-[30%] w-[18%] -rotate-2',
                    index === 2 && 'right-[4%] bottom-[18%] h-[25%] w-[16%] rotate-6',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  loading="lazy"
                />
              ))}

              {slide.subtitle && (
                <div className="absolute right-7 top-10 grid h-24 w-24 rotate-[-10deg] place-items-center rounded-full bg-[#ffeb3b] text-center text-primary shadow-lg [clip-path:polygon(50%_0%,59%_12%,73%_6%,78%_21%,94%_22%,88%_38%,100%_50%,88%_62%,94%_78%,78%_79%,73%_94%,59%_88%,50%_100%,41%_88%,27%_94%,22%_79%,6%_78%,12%_62%,0%_50%,12%_38%,6%_22%,22%_21%,27%_6%,41%_12%)] sm:right-12 sm:top-12 sm:h-32 sm:w-32">
                </div>
              )}
            </Link>
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

// ─── Category Banner (mobile + desktop) ──────────────────────────────────────
function CategoryBanner({ category }: { category: Category }) {
  const bannerUrl = category.banner_image_url;
  if (!bannerUrl) return null;

  return (
    <Link
      to={`/products?category=${category.slug}`}
      className="relative block -mx-3 mb-6 aspect-[5/2] overflow-hidden bg-gray-100 sm:mx-0 sm:mb-8 sm:rounded-2xl lg:aspect-[16/5]"
      aria-label={`${category.name} banner`}
    >
      <img
        src={bannerUrl}
        alt={category.name}
        className="absolute inset-0 h-full w-full object-cover"
        loading="eager"
      />
    </Link>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

function FiltersSidebar({
  selectedCategory,
  onCategoryChange,
  minPrice,
  maxPrice,
  onMinPriceChange,
  onMaxPriceChange,
  selectedTags,
  onTagToggle,
  onReset,
}: {
  selectedCategory: string;
  onCategoryChange: (slug: string) => void;
  minPrice: string;
  maxPrice: string;
  onMinPriceChange: (v: string) => void;
  onMaxPriceChange: (v: string) => void;
  selectedTags: string[];
  onTagToggle: (tag: string) => void;
  onReset: () => void;
}) {
  const { data: categories } = useCategories();
  const allCategories = categories?.flatMap((c) => [c, ...(c.children ?? [])]) ?? [];
  const popularTags = [
    'indoor',
    'outdoor',
    'flowering',
    'low-maintenance',
    'air-purifying',
    'pet-friendly',
    'beginner-friendly',
    'vastu-friendly',
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-sm uppercase tracking-wider text-gray-500">Filters</h3>
        <button onClick={onReset} className="text-xs text-primary hover:underline">Clear All</button>
      </div>
      <div>
        <h4 className="font-semibold text-sm mb-3">Category</h4>
        <div className="space-y-1.5 max-h-52 overflow-y-auto">
          <button
            onClick={() => onCategoryChange('')}
            className={`block w-full text-left text-sm px-3 py-2 rounded-lg transition touch-target ${!selectedCategory ? 'bg-primary-light/10 text-primary font-medium' : 'hover:bg-gray-50'}`}
          >
            All
          </button>
          {allCategories.map((c) => (
            <button
              key={c.slug}
              onClick={() => onCategoryChange(c.slug)}
              className={`block w-full text-left text-sm px-3 py-2 rounded-lg transition touch-target ${selectedCategory === c.slug ? 'bg-primary-light/10 text-primary font-medium' : 'hover:bg-gray-50'}`}
            >
              {c.parent_id ? `  ${c.name}` : c.name}
            </button>
          ))}
        </div>
      </div>
      <div>
        <h4 className="font-semibold text-sm mb-3">Price Range</h4>
        <div className="flex gap-2 items-center">
          <input type="number" placeholder="Min" value={minPrice} onChange={(e) => onMinPriceChange(e.target.value)}
            className="w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-light" />
          <span className="text-gray-300">—</span>
          <input type="number" placeholder="Max" value={maxPrice} onChange={(e) => onMaxPriceChange(e.target.value)}
            className="w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-light" />
        </div>
      </div>
      <div>
        <h4 className="font-semibold text-sm mb-3">Tags</h4>
        <div className="flex flex-wrap gap-2">
          {popularTags.map((tag) => {
            const isSelected = selectedTags.includes(tag);
            const style = getTagStyle(tag);
            const label = tag.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
            return (
              <button
                key={tag}
                onClick={() => onTagToggle(tag)}
                className="px-3 py-1.5 text-xs rounded-full border transition-all touch-target font-medium"
                style={isSelected ? {
                  backgroundColor: style.bg,
                  color: style.text,
                  borderColor: style.border,
                } : undefined}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function ProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  useBodyScrollLock(mobileFiltersOpen);

  const category = searchParams.get('category') || searchParams.get('subcategory') || '';
  const search = searchParams.get('search') || '';
  const collectionTitle = searchParams.get('collection_title') || '';
  const sort = searchParams.get('sort_by') || '';
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

  function handleTagToggle(tag: string) {
    const next = selectedTags.includes(tag) ? selectedTags.filter((t) => t !== tag) : [...selectedTags, tag];
    updateParams({ tags: next.join(',') });
  }

  function resetFilters() {
    setMinPrice(''); setMaxPrice('');
    setSearchParams({});
  }

  const { data, isLoading } = useProducts({
    category_slug: category || undefined,
    search: search || undefined,
    sort_by: sort || undefined,
    min_price: minPrice ? Number(minPrice) : undefined,
    max_price: maxPrice ? Number(maxPrice) : undefined,
    tags: selectedTags.length ? selectedTags.join(',') : undefined,
    page,
    limit: 20,
  });
  const { data: trendingBanners = [], isLoading: trendingBannersLoading } =
    useBanners('trending');
  const { data: categories } = useCategories();
  const activeCategory = useMemo(
    () =>
      category
        ? (categories?.flatMap((c) => [c, ...(c.children ?? [])]) ?? []).find(
            (c) => c.slug === category,
          )
        : undefined,
    [category, categories],
  );

  const isTrendingPage =
    sort === 'popular' &&
    !search &&
    !category &&
    !minPrice &&
    !maxPrice &&
    selectedTags.length === 0;
  const isNewestPage =
    sort === 'newest' &&
    !search &&
    !category &&
    !minPrice &&
    !maxPrice &&
    selectedTags.length === 0;
  const trendingBannerImages =
    data?.items.flatMap((product) => product.images ?? []).filter(Boolean) ??
    [];
  const pageTitle = search
    ? `Results for "${search}"`
    : collectionTitle
      ? collectionTitle
      : isTrendingPage
      ? 'Price Drop!'
      : isNewestPage
        ? 'New Arrivals'
        : category
          ? formatSlugTitle(category)
          : selectedTags.length === 1
            ? formatSlugTitle(selectedTags[0])
            : selectedTags.length > 1
              ? selectedTags.map(formatSlugTitle).join(' + ')
              : 'All Products';

  const sidebar = (
    <FiltersSidebar
      selectedCategory={category}
      onCategoryChange={(slug) => updateParams({ category: slug })}
      minPrice={minPrice}
      maxPrice={maxPrice}
      onMinPriceChange={(v) => { setMinPrice(v); updateParams({ min_price: v }); }}
      onMaxPriceChange={(v) => { setMaxPrice(v); updateParams({ max_price: v }); }}
      selectedTags={selectedTags}
      onTagToggle={handleTagToggle}
      onReset={resetFilters}
    />
  );

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
      {isTrendingPage && (
        <TrendingPromoBanner
          banners={trendingBanners}
          images={trendingBannerImages}
          isLoading={isLoading || trendingBannersLoading}
        />
      )}

      {/* Category banner — shown on all screen sizes when a category is active */}
      {!isTrendingPage && activeCategory?.banner_image_url && (
        <CategoryBanner category={activeCategory} />
      )}

      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <h1 className="text-lg sm:text-2xl font-bold">
          {pageTitle}
        </h1>
        {data && <p className="text-xs sm:text-sm text-gray-500 mt-0.5">{data.total} products</p>}
      </div>

      {/* Mobile Control Bar */}
      <div className="lg:hidden flex items-center gap-3 mb-4 -mx-1 sm:mx-0">
        <button
          onClick={() => setMobileFiltersOpen(true)}
          className="flex-1 flex items-center justify-center gap-2 bg-white border border-gray-200 rounded-xl py-2.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 active:bg-gray-100 transition-colors"
        >
          <SlidersHorizontal size={18} className="text-primary" /> 
          Filters
          {(selectedTags.length > 0 || category || minPrice || maxPrice) && (
            <span className="w-2 h-2 rounded-full bg-accent ml-1" />
          )}
        </button>
        
        <div className="flex-1 relative">
          <select
            value={sort}
            onChange={(e) => updateParams({ sort_by: e.target.value })}
            className="w-full appearance-none bg-white border border-gray-200 rounded-xl py-2.5 pl-4 pr-10 text-sm font-semibold text-gray-700 shadow-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary truncate"
          >
            <option value="" disabled>Sort By</option>
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Desktop sort */}
      <div className="hidden lg:flex items-center justify-end mb-4 gap-3">
        <select
          value={sort}
          onChange={(e) => updateParams({ sort_by: e.target.value })}
          className="text-sm border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-primary-light"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      <div className="flex gap-8">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block w-60 shrink-0">{sidebar}</aside>

        {/* Mobile filter bottom sheet */}
        {mobileFiltersOpen && (
          <>
            <div className="fixed inset-0 bg-black/40 z-50 lg:hidden" onClick={() => setMobileFiltersOpen(false)} />
            <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl max-h-[85vh] flex flex-col lg:hidden animate-slide-up">
              <div className="flex items-center justify-between p-4 border-b shrink-0">
                <h3 className="font-bold flex items-center gap-2">
                  <SlidersHorizontal size={18} /> Filters
                </h3>
                <button onClick={() => setMobileFiltersOpen(false)} className="p-2 touch-target"><X size={20} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-4">{sidebar}</div>
              <div className="shrink-0 p-4 border-t safe-bottom">
                <button
                  onClick={() => setMobileFiltersOpen(false)}
                  className="w-full py-3 bg-primary text-white rounded-xl font-medium"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </>
        )}

        {/* Product grid */}
        <div className="flex-1">
          <ErrorBoundary>
            {isLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
              </div>
            ) : data?.items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
                <p className="text-lg font-medium">No products found</p>
                <button onClick={resetFilters} className="text-sm text-primary hover:underline">Reset Filters</button>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                {data?.items.map((p) => <ProductCard key={p.id} product={p} />)}
              </div>
            )}
          </ErrorBoundary>

          {/* Pagination */}
          {data && data.pages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8 sm:mt-10">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="p-2 border rounded-lg hover:bg-gray-50 disabled:opacity-30 touch-target">
                <ChevronLeft size={18} />
              </button>
              {Array.from({ length: data.pages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === data.pages || Math.abs(p - page) <= 1)
                .map((p, idx, arr) => (
                  <span key={p}>
                    {idx > 0 && arr[idx - 1] !== p - 1 && <span className="px-1 text-gray-300">…</span>}
                    <button
                      onClick={() => setPage(p)}
                      className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg text-sm font-medium transition touch-target ${p === page ? 'bg-primary text-white' : 'hover:bg-gray-50 border'}`}
                    >
                      {p}
                    </button>
                  </span>
                ))}
              <button disabled={page >= data.pages} onClick={() => setPage(page + 1)} className="p-2 border rounded-lg hover:bg-gray-50 disabled:opacity-30 touch-target">
                <ChevronRight size={18} />
              </button>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
