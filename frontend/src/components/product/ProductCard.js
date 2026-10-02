import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useCartStore } from '@/store/cartStore';
import ProductTagBadges from '@/components/product/ProductTagBadges';
import ProductImageBadges from '@/components/product/ProductImageBadges';
import { getApiErrorDetail } from '@/lib/apiError';
const SECONDARY = '#16A34A';
export default function ProductCard({ product }) {
    const addItem = useCartStore((s) => s.addItem);
    const navigate = useNavigate();
    const hasVariants = Boolean((product.variants?.variant_groups?.length ?? 0) > 0);
    // For stock-display purposes the meaningful distinction is whether there are
    // multiple variant groups. With 0 or 1 group, stock_qty is exact:
    //   0 groups → simple product, stock_qty is the literal count.
    //   1 group  → min([sum of that group]) = sum = total units across all options,
    //              still an exact count for the product (e.g. "12 plants total across sizes").
    // With 2+ groups, stock_qty = min(group sums) — a transportation-problem ceiling
    // that can diverge from any individual combo's real availability, so showing
    // the number as a per-item count would be misleading.
    const variantGroupCount = product.variants?.variant_groups?.length ?? 0;
    const stockQtyIsExact = variantGroupCount <= 1;
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
    return (_jsxs(Link, { to: `/products/${product.slug}`, className: "group flex flex-col h-full bg-white rounded-2xl sm:rounded-2xl border border-gray-100 overflow-hidden hover:shadow-lg sm:hover:shadow-lg transition-shadow duration-300", children: [_jsxs("div", { className: "relative aspect-square overflow-hidden bg-gray-50", children: [product.images?.[0] ? (_jsx("img", { src: product.images?.[0], alt: product.name, className: "w-full h-full object-cover group-hover:scale-105 transition-transform duration-500", loading: "lazy" })) : (_jsx("div", { className: "w-full h-full bg-gray-100" })), _jsx(ProductImageBadges, { product: product })] }), _jsxs("div", { className: "flex flex-col flex-1 px-3 pt-3 pb-3 sm:p-4 gap-1.5", children: [_jsx("h3", { className: "text-sm font-medium leading-snug text-gray-800 line-clamp-2 sm:min-h-[2.5rem] group-hover:text-primary transition-colors", children: product.name }), _jsx(ProductTagBadges, { tags: product.tags, maxTags: 2, size: "sm" }), _jsxs("div", { className: "flex items-baseline gap-1.5 sm:gap-2 mt-0.5", children: [_jsxs("span", { className: "font-semibold sm:font-bold text-base sm:text-base", style: { color: SECONDARY }, children: [hasVariants && _jsx("span", { className: "text-xs font-normal text-gray-500 mr-0.5", children: "from" }), "\u20B9", product.price] }), product.original_price && product.original_price > product.price && (_jsxs("span", { className: "text-xs text-gray-400 line-through", children: ["\u20B9", product.original_price] }))] }), product.stock_qty <= 5 && product.stock_qty > 0 && stockQtyIsExact && (_jsxs("p", { className: "hidden sm:block text-xs text-red-500 mt-1", children: ["Only ", product.stock_qty, " left!"] })), product.stock_qty <= 5 && product.stock_qty > 0 && !stockQtyIsExact && (_jsx("p", { className: "hidden sm:block text-xs text-amber-600 mt-1", children: "Low stock" })), product.stock_qty === 0 && (_jsx("p", { className: "hidden sm:block text-xs text-red-500 mt-1 font-medium", children: "Out of Stock" })), product.stock_qty === 0 ? (_jsx("button", { type: "button", disabled: true, className: "mt-auto w-full py-2.5 rounded-lg text-sm font-semibold bg-gray-100 text-gray-400 cursor-not-allowed", children: "Out of Stock" })) : (_jsx("button", { type: "button", onClick: handleAdd, className: "mt-auto w-full py-2.5 rounded-lg text-sm font-semibold text-white transition active:scale-[0.98] hover:opacity-90", style: { backgroundColor: SECONDARY }, children: hasVariants ? 'Choose options' : 'Add to cart' }))] })] }));
}
