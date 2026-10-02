import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useProducts } from '@/hooks/useProducts';
import { useCartStore } from '@/store/cartStore';
import ProductTagBadges from '@/components/product/ProductTagBadges';
import ProductImageBadges from '@/components/product/ProductImageBadges';
import { getApiErrorDetail } from '@/lib/apiError';
const SECONDARY = '#16A34A';
const LIMIT = 8;
function ProductTile({ product }) {
    const addItem = useCartStore((s) => s.addItem);
    const navigate = useNavigate();
    const hasVariants = Boolean((product.variants?.variant_groups?.length ?? 0) > 0);
    async function handleAdd(e) {
        e.preventDefault();
        e.stopPropagation();
        if (hasVariants) {
            navigate(`/products/${product.slug}`);
            return;
        }
        try {
            await addItem(product.id, 1, product);
            toast.success(`${product.name} added to cart`);
        }
        catch (err) {
            toast.error(getApiErrorDetail(err, 'Failed to add'));
        }
    }
    return (_jsxs(Link, { to: `/products/${product.slug}`, className: "group flex flex-col h-full bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-md transition-shadow", children: [_jsxs("div", { className: "relative aspect-square overflow-hidden bg-gray-50", children: [product.images?.[0] ? (_jsx("img", { src: product.images?.[0], alt: product.name, loading: "lazy", className: "w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" })) : (_jsx("div", { className: "w-full h-full bg-gray-100" })), _jsx(ProductImageBadges, { product: product })] }), _jsxs("div", { className: "flex flex-col flex-1 px-3 sm:px-4 pt-3 pb-3 sm:pb-4 gap-1.5", children: [_jsx("h3", { className: "text-sm sm:text-base font-medium text-gray-800 line-clamp-2 leading-snug", children: product.name }), _jsx(ProductTagBadges, { tags: product.tags, maxTags: 2, size: "sm" }), _jsxs("div", { className: "flex items-baseline gap-2 mt-0.5", children: [_jsxs("span", { className: "text-base sm:text-lg font-semibold", style: { color: SECONDARY }, children: [hasVariants && (_jsx("span", { className: "text-xs font-normal text-gray-500 mr-0.5", children: "from" })), "\u20B9", product.price] }), product.original_price &&
                                product.original_price > product.price && (_jsxs("span", { className: "text-xs sm:text-sm text-gray-400 line-through", children: ["\u20B9", product.original_price] }))] }), product.stock_qty === 0 ? (_jsx("button", { type: "button", disabled: true, className: "mt-auto w-full py-2.5 rounded-lg text-sm font-semibold bg-gray-100 text-gray-400 cursor-not-allowed", children: "Out of Stock" })) : (_jsx("button", { type: "button", onClick: handleAdd, className: "mt-auto w-full py-2.5 rounded-lg text-sm font-semibold text-white transition active:scale-[0.98] hover:opacity-90", style: { backgroundColor: SECONDARY }, children: "Add to cart" }))] })] }));
}
function GridSkeleton({ count = LIMIT }) {
    return (_jsx(_Fragment, { children: Array.from({ length: count }).map((_, i) => (_jsxs("div", { className: "flex flex-col bg-white rounded-2xl border border-gray-100 overflow-hidden", children: [_jsx("div", { className: "aspect-square bg-gray-100 animate-pulse" }), _jsxs("div", { className: "px-3 sm:px-4 py-3 sm:py-4 space-y-2", children: [_jsx("div", { className: "h-4 w-3/4 bg-gray-100 rounded animate-pulse" }), _jsx("div", { className: "h-4 w-1/3 bg-gray-100 rounded animate-pulse" }), _jsx("div", { className: "h-9 w-full bg-gray-100 rounded-lg animate-pulse" })] })] }, i))) }));
}
export default function DisplaySectionBlock({ section }) {
    const { data, isLoading } = useProducts({
        display_section: section.key,
        limit: LIMIT,
    });
    const products = data?.items ?? [];
    if (!isLoading && products.length === 0)
        return null;
    const viewAllHref = `/products?display_section=${encodeURIComponent(section.key)}&collection_title=${encodeURIComponent(section.name)}`;
    return (_jsx("section", { className: "w-full py-8 sm:py-10 bg-white", children: _jsxs("div", { className: "mx-auto px-4 sm:px-6 lg:px-10 xl:px-16 max-w-7xl", children: [_jsx("div", { className: "mb-5 sm:mb-6", children: _jsx("h2", { className: "text-xl sm:text-2xl lg:text-3xl font-bold text-black", children: section.name }) }), _jsx("div", { className: "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5", children: isLoading ? (_jsx(GridSkeleton, {})) : (products.map((p) => _jsx(ProductTile, { product: p }, p.id))) }), _jsx("div", { className: "mt-8 flex justify-center", children: _jsxs(Link, { to: viewAllHref, className: "px-6 py-2.5 rounded-lg text-sm font-semibold border-2 transition-colors hover:text-white", style: { borderColor: SECONDARY, color: SECONDARY }, onMouseEnter: (e) => {
                            e.currentTarget.style.backgroundColor = SECONDARY;
                        }, onMouseLeave: (e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                        }, children: ["View all ", section.name, " \u2192"] }) })] }) }));
}
