import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Filter, SlidersHorizontal, X } from 'lucide-react';
import { useProducts } from '@/hooks/useProducts';
import { useCategories } from '@/hooks/useCategories';
import ProductCard from '@/components/product/ProductCard';
import SkeletonCard from '@/components/ui/SkeletonCard';
import ErrorBoundary from '@/components/ui/ErrorBoundary';

const SORT_OPTIONS = [
  { value: '', label: 'Relevance' },
  { value: 'price_asc', label: 'Price: Low → High' },
  { value: 'price_desc', label: 'Price: High → Low' },
  { value: 'newest', label: 'Newest First' },
  { value: 'discount', label: 'Best Discount' },
];

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

  const popularTags = ['indoor', 'outdoor', 'flowering', 'low-maintenance', 'air-purifying', 'pet-friendly', 'beginner-friendly'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-sm uppercase tracking-wider text-gray-500">Filters</h3>
        <button onClick={onReset} className="text-xs text-primary hover:underline">
          Clear All
        </button>
      </div>

      {/* Category */}
      <div>
        <h4 className="font-semibold text-sm mb-3">Category</h4>
        <div className="space-y-1.5 max-h-52 overflow-y-auto">
          <button
            onClick={() => onCategoryChange('')}
            className={`block w-full text-left text-sm px-3 py-1.5 rounded-lg transition ${
              !selectedCategory ? 'bg-primary-light/10 text-primary font-medium' : 'hover:bg-gray-50'
            }`}
          >
            All
          </button>
          {allCategories.map((c) => (
            <button
              key={c.slug}
              onClick={() => onCategoryChange(c.slug)}
              className={`block w-full text-left text-sm px-3 py-1.5 rounded-lg transition ${
                selectedCategory === c.slug
                  ? 'bg-primary-light/10 text-primary font-medium'
                  : 'hover:bg-gray-50'
              }`}
            >
              {c.parent_id ? `  ${c.name}` : c.name}
            </button>
          ))}
        </div>
      </div>

      {/* Price Range */}
      <div>
        <h4 className="font-semibold text-sm mb-3">Price Range</h4>
        <div className="flex gap-2 items-center">
          <input
            type="number"
            placeholder="Min"
            value={minPrice}
            onChange={(e) => onMinPriceChange(e.target.value)}
            className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-light"
          />
          <span className="text-gray-300">—</span>
          <input
            type="number"
            placeholder="Max"
            value={maxPrice}
            onChange={(e) => onMaxPriceChange(e.target.value)}
            className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-light"
          />
        </div>
      </div>

      {/* Tags */}
      <div>
        <h4 className="font-semibold text-sm mb-3">Tags</h4>
        <div className="flex flex-wrap gap-2">
          {popularTags.map((tag) => (
            <button
              key={tag}
              onClick={() => onTagToggle(tag)}
              className={`px-3 py-1 text-xs rounded-full border transition ${
                selectedTags.includes(tag)
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white hover:border-primary-light'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const category = searchParams.get('category') || '';
  const search = searchParams.get('search') || '';
  const sort = searchParams.get('sort_by') || '';
  const page = Number(searchParams.get('page')) || 1;
  const [minPrice, setMinPrice] = useState(searchParams.get('min_price') || '');
  const [maxPrice, setMaxPrice] = useState(searchParams.get('max_price') || '');
  const [selectedTags, setSelectedTags] = useState<string[]>(
    searchParams.get('tags')?.split(',').filter(Boolean) || [],
  );

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
  }

  function handleTagToggle(tag: string) {
    const next = selectedTags.includes(tag)
      ? selectedTags.filter((t) => t !== tag)
      : [...selectedTags, tag];
    setSelectedTags(next);
    updateParams({ tags: next.join(',') });
  }

  function resetFilters() {
    setMinPrice('');
    setMaxPrice('');
    setSelectedTags([]);
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
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">
            {search ? `Results for "${search}"` : category ? category.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'All Products'}
          </h1>
          {data && <p className="text-sm text-gray-500 mt-0.5">{data.total} products</p>}
        </div>
        <div className="flex items-center gap-3">
          <select
            value={sort}
            onChange={(e) => updateParams({ sort_by: e.target.value })}
            className="text-sm border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-primary-light"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <button
            className="lg:hidden p-2 border rounded-lg"
            onClick={() => setMobileFiltersOpen(true)}
          >
            <SlidersHorizontal size={18} />
          </button>
        </div>
      </div>

      <div className="flex gap-8">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block w-60 shrink-0">
          {sidebar}
        </aside>

        {/* Mobile filter drawer */}
        {mobileFiltersOpen && (
          <>
            <div className="fixed inset-0 bg-black/30 z-50 lg:hidden" onClick={() => setMobileFiltersOpen(false)} />
            <div className="fixed top-0 right-0 h-full w-80 bg-white z-50 shadow-xl p-6 overflow-y-auto lg:hidden">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-bold flex items-center gap-2"><Filter size={18} /> Filters</h3>
                <button onClick={() => setMobileFiltersOpen(false)}><X size={20} /></button>
              </div>
              {sidebar}
              <button
                onClick={() => setMobileFiltersOpen(false)}
                className="w-full mt-6 py-3 bg-primary text-white rounded-xl font-medium"
              >
                Apply Filters
              </button>
            </div>
          </>
        )}

        {/* Product grid */}
        <div className="flex-1">
          <ErrorBoundary>
            {isLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
              </div>
            ) : data?.items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
                <p className="text-lg font-medium">No products found</p>
                <button onClick={resetFilters} className="text-sm text-primary hover:underline">
                  Reset Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {data?.items.map((p) => <ProductCard key={p.id} product={p} />)}
              </div>
            )}
          </ErrorBoundary>

          {/* Pagination */}
          {data && data.pages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-10">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="p-2 border rounded-lg hover:bg-gray-50 disabled:opacity-30"
              >
                <ChevronLeft size={18} />
              </button>
              {Array.from({ length: data.pages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === data.pages || Math.abs(p - page) <= 2)
                .map((p, idx, arr) => (
                  <span key={p}>
                    {idx > 0 && arr[idx - 1] !== p - 1 && (
                      <span className="px-1 text-gray-300">…</span>
                    )}
                    <button
                      onClick={() => setPage(p)}
                      className={`w-10 h-10 rounded-lg text-sm font-medium transition ${
                        p === page
                          ? 'bg-primary text-white'
                          : 'hover:bg-gray-50 border'
                      }`}
                    >
                      {p}
                    </button>
                  </span>
                ))}
              <button
                disabled={page >= data.pages}
                onClick={() => setPage(page + 1)}
                className="p-2 border rounded-lg hover:bg-gray-50 disabled:opacity-30"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
