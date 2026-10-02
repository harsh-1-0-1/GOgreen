import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
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
const SORT_OPTIONS = [
    { value: '', label: 'Relevance' },
    { value: 'price_asc', label: 'Price: Low → High' },
    { value: 'price_desc', label: 'Price: High → Low' },
    { value: 'newest', label: 'Newest First' },
    { value: 'discount', label: 'Best Discount' },
];
function formatSlugTitle(value) {
    return value
        .replace(/-/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
}
function TrendingPromoBanner({ banners, images, isLoading, }) {
    const fallbackSlides = [
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
    // Reset to the first slide when the slide set changes — guarded render-time
    // adjustment replaces a synchronous setState effect.
    const [lastSlideLens, setLastSlideLens] = useState([
        banners.length,
        images.length,
    ]);
    if (banners.length !== lastSlideLens[0] || images.length !== lastSlideLens[1]) {
        setLastSlideLens([banners.length, images.length]);
        setCurrent(0);
    }
    useEffect(() => {
        if (slides.length <= 1)
            return;
        const id = window.setTimeout(() => setCurrent((index) => (index + 1) % slides.length), 3500);
        return () => window.clearTimeout(id);
    }, [current, slides.length]);
    if (isLoading) {
        return (_jsx("div", { className: "mb-6 h-[340px] w-full animate-pulse rounded-none bg-gray-100 sm:mb-8 sm:h-[380px] sm:rounded-2xl md:h-[58vh] lg:h-[58vh]" }));
    }
    return (_jsxs("section", { className: "relative -mx-3 mb-6 h-[340px] overflow-hidden bg-[#e9dfc9] sm:mx-0 sm:mb-8 sm:h-[380px] sm:rounded-2xl md:h-[58vh] lg:h-[58vh]", children: [_jsx("div", { className: "flex h-full transition-transform duration-700 ease-in-out", style: { transform: `translateX(-${current * 100}%)` }, children: slides.map((slide, slideIndex) => {
                    const slideClass = 'relative h-full w-full shrink-0 overflow-hidden block';
                    const slideStyle = {
                        backgroundColor: slide.bg_color || '#e9dfc9',
                    };
                    const slideImage = (_jsx(ResponsiveBannerImage, { banner: { ...slide, image_url: slide.image_url || images[0] }, loading: slideIndex === 0 ? 'eager' : 'lazy' }));
                    return slide.cta_link ? (_jsx(Link, { to: slide.cta_link, className: slideClass, style: slideStyle, children: slideImage }, slide.id || slideIndex)) : (_jsx("div", { className: slideClass, style: slideStyle, children: slideImage }, slide.id || slideIndex));
                }) }), _jsx("div", { className: "absolute bottom-2.5 left-1/2 flex -translate-x-1/2 gap-1.5 sm:bottom-3", children: slides.map((slide, index) => (_jsx("button", { type: "button", onClick: () => setCurrent(index), className: `h-1.5 rounded-full transition-all ${index === current ? 'w-6 bg-white' : 'w-1.5 bg-white/55'}`, "aria-label": `Show trending banner ${index + 1}` }, slide.id || index))) })] }));
}
function FiltersSidebar({ selectedCategories, onCategoryToggle, minPrice, maxPrice, onMinPriceChange, onMaxPriceChange, selectedTags, onTagToggle, onReset, }) {
    const { data: categories } = useCategories();
    const selectedCategorySet = new Set(selectedCategories);
    // Slug → display name for the chips, including slugs that came from a link
    // and no longer resolve to a live category (those fall back to the title-cased slug).
    const categoryNames = useMemo(() => {
        const map = new Map();
        (categories ?? []).forEach((c) => {
            map.set(c.slug, c.name);
            (c.children ?? []).forEach((child) => map.set(child.slug, child.name));
        });
        return map;
    }, [categories]);
    // Nested picker: one collapsible panel of categories, with subcategories
    // revealed per parent. Selected categories surface as removable chips above
    // the panel so nothing gets stranded inside a closed accordion.
    const [categoryOpen, setCategoryOpen] = useState(false);
    const [expandedParents, setExpandedParents] = useState({});
    const categoryRef = useRef(null);
    useEffect(() => {
        if (!categoryOpen)
            return;
        function onPointerDown(e) {
            if (categoryRef.current && !categoryRef.current.contains(e.target)) {
                setCategoryOpen(false);
            }
        }
        document.addEventListener('pointerdown', onPointerDown);
        return () => document.removeEventListener('pointerdown', onPointerDown);
    }, [categoryOpen]);
    // Drive the filter from the admin-defined tags so newly created tags (and
    // their colours) show up here. The hardcoded list is only a fallback for an
    // install with no tags configured yet.
    const { data: savedTags = [] } = useTags();
    const legacyTags = [
        'indoor',
        'outdoor',
        'flowering',
        'low-maintenance',
        'air-purifying',
        'pet-friendly',
        'beginner-friendly',
        'vastu-friendly',
    ];
    const tagOptions = savedTags.length > 0
        ? savedTags
            .filter((t) => t.is_active)
            .map((t) => ({
            key: toTagKey(t.name),
            label: t.name,
            color: t.color || null,
        }))
            .filter((t) => t.key)
        : legacyTags.map((t) => ({ key: t, label: formatSlugTitle(t), color: null }));
    // A tag can be selected via its slug (from a badge link) or its label (from
    // this list), so compare on the normalised key.
    const selectedTagKeys = new Set(selectedTags.map(toTagKey));
    return (_jsxs("div", { className: "space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h3", { className: "font-bold text-sm uppercase tracking-wider text-gray-500", children: "Filters" }), _jsx("button", { onClick: onReset, className: "text-xs text-primary hover:underline", children: "Clear All" })] }), _jsxs("div", { children: [_jsx("h4", { className: "font-semibold text-sm mb-3", children: "Category" }), _jsxs("div", { ref: categoryRef, children: [_jsxs("button", { type: "button", onClick: () => setCategoryOpen((o) => !o), "aria-expanded": categoryOpen, className: `flex w-full items-center justify-between gap-2 px-3 py-2.5 text-sm border rounded-lg transition touch-target ${categoryOpen ? 'border-primary text-primary' : 'border-gray-200 hover:border-gray-400'}`, children: [_jsx("span", { className: "truncate", children: selectedCategories.length === 0
                                            ? 'Select categories'
                                            : `${selectedCategories.length} selected` }), _jsxs("span", { className: "flex shrink-0 items-center gap-2", children: [selectedCategories.length > 0 && (_jsx("span", { className: "rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-medium leading-none text-white", children: selectedCategories.length })), _jsx(ChevronDown, { className: `h-4 w-4 text-gray-400 transition-transform ${categoryOpen ? 'rotate-180' : ''}` })] })] }), selectedCategories.length > 0 && (_jsx("div", { className: "mt-2 flex flex-wrap gap-1.5", children: selectedCategories.map((slug) => {
                                    const label = categoryNames.get(slug) ?? formatSlugTitle(slug);
                                    return (_jsxs("span", { className: "inline-flex items-center gap-1 rounded-full bg-primary-light/10 py-1 pl-2.5 pr-1 text-xs font-medium text-primary", children: [_jsx("span", { className: "max-w-[9rem] truncate", children: label }), _jsx("button", { type: "button", onClick: () => onCategoryToggle(slug), "aria-label": `Remove ${label} filter`, className: "rounded-full p-0.5 transition hover:bg-primary/20", children: _jsx(X, { className: "h-3 w-3" }) })] }, slug));
                                }) })), categoryOpen && (_jsxs("div", { className: "mt-2 max-h-64 overflow-y-auto rounded-lg border border-gray-200 p-1", children: [(categories ?? []).map((c) => {
                                        const children = c.children ?? [];
                                        const parentSelected = selectedCategorySet.has(c.slug);
                                        // A parent starts open when one of its subcategories is selected, so a
                                        // category arriving from a nav link lands on a visible ticked row.
                                        const isOpen = expandedParents[c.slug] ??
                                            children.some((child) => selectedCategorySet.has(child.slug));
                                        return (_jsxs("div", { children: [_jsxs("div", { className: "flex items-center gap-0.5", children: [_jsxs("button", { type: "button", onClick: () => {
                                                                onCategoryToggle(c.slug);
                                                                if (children.length) {
                                                                    setExpandedParents((prev) => ({ ...prev, [c.slug]: true }));
                                                                }
                                                            }, "aria-pressed": parentSelected, className: `flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition touch-target ${parentSelected ? 'bg-primary-light/10 font-medium text-primary' : 'hover:bg-gray-50'}`, children: [_jsx("span", { "aria-hidden": "true", className: `flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border text-[9px] leading-none ${parentSelected ? 'border-primary bg-primary text-white' : 'border-gray-300 bg-white'}`, children: parentSelected ? '✓' : '' }), _jsx("span", { className: "truncate", children: c.name })] }), children.length > 0 && (_jsx("button", { type: "button", onClick: () => setExpandedParents((prev) => ({ ...prev, [c.slug]: !isOpen })), "aria-expanded": isOpen, "aria-label": `${isOpen ? 'Hide' : 'Show'} subcategories of ${c.name}`, className: "rounded-md p-2 text-gray-400 transition hover:bg-gray-50 hover:text-gray-600", children: _jsx(ChevronRight, { className: `h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-90' : ''}` }) }))] }), isOpen && children.length > 0 && (_jsx("div", { className: "ml-3 border-l border-gray-200 pl-2", children: children.map((child) => {
                                                        const childSelected = selectedCategorySet.has(child.slug);
                                                        return (_jsxs("button", { type: "button", onClick: () => onCategoryToggle(child.slug), "aria-pressed": childSelected, className: `flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition touch-target ${childSelected ? 'bg-primary-light/10 font-medium text-primary' : 'text-gray-600 hover:bg-gray-50'}`, children: [_jsx("span", { "aria-hidden": "true", className: `flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border text-[9px] leading-none ${childSelected ? 'border-primary bg-primary text-white' : 'border-gray-300 bg-white'}`, children: childSelected ? '✓' : '' }), _jsx("span", { className: "truncate", children: child.name })] }, child.slug));
                                                    }) }))] }, c.slug));
                                    }), (categories ?? []).length === 0 && (_jsx("p", { className: "px-2 py-3 text-center text-xs text-gray-400", children: "No categories yet." }))] }))] })] }), _jsxs("div", { children: [_jsx("h4", { className: "font-semibold text-sm mb-3", children: "Price Range" }), _jsxs("div", { className: "flex gap-2 items-center", children: [_jsx("input", { type: "number", placeholder: "Min", value: minPrice, onChange: (e) => onMinPriceChange(e.target.value), className: "w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-light" }), _jsx("span", { className: "text-gray-300", children: "\u2014" }), _jsx("input", { type: "number", placeholder: "Max", value: maxPrice, onChange: (e) => onMaxPriceChange(e.target.value), className: "w-full px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-light" })] })] }), _jsxs("div", { children: [_jsx("h4", { className: "font-semibold text-sm mb-3", children: "Tags" }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [tagOptions.map((tag) => {
                                const isSelected = selectedTagKeys.has(tag.key);
                                // Admin colour wins; fall back to the legacy palette, then to grey.
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
                                return (_jsx("button", { onClick: () => onTagToggle(tag.key), className: `px-3 py-1.5 text-xs rounded-full border transition-all touch-target font-medium ${isSelected ? '' : 'text-gray-600 border-gray-200 hover:border-gray-300'}`, style: isSelected ? style : undefined, children: tag.label }, tag.key));
                            }), tagOptions.length === 0 && (_jsx("p", { className: "text-xs text-gray-400", children: "No tags yet." }))] })] })] }));
}
export default function ProductsPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
    useBodyScrollLock(mobileFiltersOpen);
    // `category` is the single-category param every nav/banner link uses; `categories`
    // is the multi-select facet. Both are folded into one selection so an old
    // `?category=xl-plants` link lands with that category ticked, not silently lost.
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
    function updateParams(updates) {
        const params = new URLSearchParams(searchParams);
        Object.entries(updates).forEach(([k, v]) => {
            if (v)
                params.set(k, v);
            else
                params.delete(k);
        });
        params.delete('page');
        setSearchParams(params);
    }
    function setPage(p) {
        const params = new URLSearchParams(searchParams);
        if (p > 1)
            params.set('page', String(p));
        else
            params.delete('page');
        setSearchParams(params);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    function handleCategoryToggle(slug) {
        const next = selectedCategories.includes(slug)
            ? selectedCategories.filter((c) => c !== slug)
            : [...selectedCategories, slug];
        // Collapse both params into `categories` so the sidebar stays the single source
        // of truth once the shopper starts clicking (otherwise a stale `category`
        // param would re-add its slug on every render).
        const params = new URLSearchParams(searchParams);
        params.delete('category');
        params.delete('subcategory');
        if (next.length)
            params.set('categories', next.join(','));
        else
            params.delete('categories');
        params.delete('page');
        setSearchParams(params);
    }
    function handleTagToggle(tag) {
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
    const { data: trendingBanners = [], isLoading: trendingBannersLoading } = useBanners('trending');
    const isTrendingPage = (sort === 'popular' || displaySection === 'trending') &&
        !search &&
        selectedCategories.length === 0 &&
        !minPrice &&
        !maxPrice &&
        selectedTags.length === 0;
    const isNewestPage = sort === 'newest' &&
        !search &&
        selectedCategories.length === 0 &&
        !minPrice &&
        !maxPrice &&
        selectedTags.length === 0;
    const trendingBannerImages = data?.items.flatMap((product) => product.images ?? []).filter(Boolean) ??
        [];
    const categoryTitle = selectedCategories.length === 1
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
    const sidebar = (_jsx(FiltersSidebar, { selectedCategories: selectedCategories, onCategoryToggle: handleCategoryToggle, minPrice: minPrice, maxPrice: maxPrice, onMinPriceChange: (v) => { setMinPrice(v); updateParams({ min_price: v }); }, onMaxPriceChange: (v) => { setMaxPrice(v); updateParams({ max_price: v }); }, selectedTags: selectedTags, onTagToggle: handleTagToggle, onReset: resetFilters }));
    return (_jsxs("div", { className: "max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-8", children: [isTrendingPage && (_jsx(TrendingPromoBanner, { banners: trendingBanners, images: trendingBannerImages, isLoading: isLoading || trendingBannersLoading })), _jsxs("div", { className: "mb-4 sm:mb-6", children: [_jsx("h1", { className: "text-lg sm:text-2xl font-bold", children: pageTitle }), data && _jsxs("p", { className: "text-xs sm:text-sm text-gray-500 mt-0.5", children: [data.total, " products"] })] }), _jsxs("div", { className: "lg:hidden flex items-center gap-3 mb-4 -mx-1 sm:mx-0", children: [_jsxs("button", { onClick: () => setMobileFiltersOpen(true), className: "flex-1 flex items-center justify-center gap-2 bg-white border border-gray-200 rounded-xl py-2.5 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50 active:bg-gray-100 transition-colors", children: [_jsx(SlidersHorizontal, { size: 18, className: "text-primary" }), "Filters", (selectedTags.length > 0 || selectedCategories.length > 0 || minPrice || maxPrice) && (_jsx("span", { className: "w-2 h-2 rounded-full bg-accent ml-1" }))] }), _jsxs("div", { className: "flex-1 relative", children: [_jsxs("select", { value: sort, onChange: (e) => updateParams({ sort_by: e.target.value }), className: "w-full appearance-none bg-white border border-gray-200 rounded-xl py-2.5 pl-4 pr-10 text-sm font-semibold text-gray-700 shadow-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary truncate", children: [_jsx("option", { value: "", disabled: true, children: "Sort By" }), SORT_OPTIONS.map((o) => (_jsx("option", { value: o.value, children: o.label }, o.value)))] }), _jsx(ChevronDown, { size: 16, className: "absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" })] })] }), _jsx("div", { className: "hidden lg:flex items-center justify-end mb-4 gap-3", children: _jsx("select", { value: sort, onChange: (e) => updateParams({ sort_by: e.target.value }), className: "text-sm border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-1 focus:ring-primary-light", children: SORT_OPTIONS.map((o) => (_jsx("option", { value: o.value, children: o.label }, o.value))) }) }), _jsxs("div", { className: "flex gap-8", children: [_jsx("aside", { className: "hidden lg:block w-60 shrink-0", children: sidebar }), mobileFiltersOpen && (_jsxs(_Fragment, { children: [_jsx("div", { className: "fixed inset-0 bg-black/40 z-50 lg:hidden", onClick: () => setMobileFiltersOpen(false) }), _jsxs("div", { className: "fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl max-h-[85vh] flex flex-col lg:hidden animate-slide-up", children: [_jsxs("div", { className: "flex items-center justify-between p-4 border-b shrink-0", children: [_jsxs("h3", { className: "font-bold flex items-center gap-2", children: [_jsx(SlidersHorizontal, { size: 18 }), " Filters"] }), _jsx("button", { onClick: () => setMobileFiltersOpen(false), className: "p-2 touch-target", children: _jsx(X, { size: 20 }) })] }), _jsx("div", { className: "flex-1 overflow-y-auto p-4", children: sidebar }), _jsx("div", { className: "shrink-0 p-4 border-t safe-bottom", children: _jsx("button", { onClick: () => setMobileFiltersOpen(false), className: "w-full py-3 bg-primary text-white rounded-xl font-medium", children: "Apply Filters" }) })] })] })), _jsxs("div", { className: "flex-1", children: [_jsx(ErrorBoundary, { children: isLoading ? (_jsx("div", { className: "grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4", children: Array.from({ length: 8 }).map((_, i) => _jsx(SkeletonCard, {}, i)) })) : data?.items.length === 0 ? (_jsxs("div", { className: "flex flex-col items-center justify-center py-20 text-gray-400 gap-3", children: [_jsx("p", { className: "text-lg font-medium", children: "No products found" }), _jsx("button", { onClick: resetFilters, className: "text-sm text-primary hover:underline", children: "Reset Filters" })] })) : (_jsx("div", { className: "grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4", children: data?.items.map((p) => _jsx(ProductCard, { product: p }, p.id)) })) }), data && data.pages > 1 && (_jsxs("div", { className: "flex items-center justify-center gap-2 mt-8 sm:mt-10", children: [_jsx("button", { disabled: page <= 1, onClick: () => setPage(page - 1), className: "p-2 border rounded-lg hover:bg-gray-50 disabled:opacity-30 touch-target", children: _jsx(ChevronLeft, { size: 18 }) }), Array.from({ length: data.pages }, (_, i) => i + 1)
                                        .filter((p) => p === 1 || p === data.pages || Math.abs(p - page) <= 1)
                                        .map((p, idx, arr) => (_jsxs("span", { children: [idx > 0 && arr[idx - 1] !== p - 1 && _jsx("span", { className: "px-1 text-gray-300", children: "\u2026" }), _jsx("button", { onClick: () => setPage(p), className: `w-9 h-9 sm:w-10 sm:h-10 rounded-lg text-sm font-medium transition touch-target ${p === page ? 'bg-primary text-white' : 'hover:bg-gray-50 border'}`, children: p })] }, p))), _jsx("button", { disabled: page >= data.pages, onClick: () => setPage(page + 1), className: "p-2 border rounded-lg hover:bg-gray-50 disabled:opacity-30 touch-target", children: _jsx(ChevronRight, { size: 18 }) })] }))] })] })] }));
}
