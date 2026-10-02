import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Link } from 'react-router-dom';
import { ArrowRight, Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCartStore } from '@/store/cartStore';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import DoNotForgetBar from './DoNotForgetBar';
import { formatSelectedOptions } from '@/lib/variantDisplay';
import { getApiErrorDetail } from '@/lib/apiError';
import { useSuggestionTiles } from '@/hooks/useSuggestionTiles';
import { getShippingFee, useShippingSettings } from '@/hooks/useSettings';
function optionSummary(item) {
    if (!item.selected_options)
        return null;
    return formatSelectedOptions(item.selected_options, item.product.variants) || null;
}
export default function CartDrawer() {
    const { isDrawerOpen, closeDrawer, items, total, itemCount, updateItem, removeItem } = useCartStore();
    const suggestionTiles = useSuggestionTiles(4);
    const { data: shippingSettings } = useShippingSettings();
    const shipping = getShippingFee(total, shippingSettings);
    const grandTotal = total + shipping;
    useBodyScrollLock(isDrawerOpen);
    if (!isDrawerOpen)
        return null;
    async function handleUpdate(itemId, qty) {
        try {
            if (qty <= 0)
                await removeItem(itemId);
            else
                await updateItem(itemId, qty);
        }
        catch (err) {
            toast.error(getApiErrorDetail(err, 'Failed to update cart'));
        }
    }
    async function handleRemove(itemId) {
        try {
            await removeItem(itemId);
            toast.success('Removed from cart');
        }
        catch {
            toast.error('Failed to remove item');
        }
    }
    return (_jsxs(_Fragment, { children: [_jsx("div", { className: "fixed inset-0 bg-black/40 z-50", onClick: closeDrawer }), _jsxs("div", { className: "fixed inset-0 md:inset-auto md:top-0 md:right-0 md:h-full md:w-[400px] bg-white z-50 md:shadow-2xl flex flex-col", children: [_jsxs("div", { className: "flex items-center justify-between p-4 border-b shrink-0", children: [_jsxs("h2", { className: "text-lg font-bold flex items-center gap-2", children: [_jsx(ShoppingBag, { size: 20, className: "text-primary" }), "Cart (", itemCount, ")"] }), _jsx("button", { onClick: closeDrawer, className: "p-2 hover:bg-gray-100 rounded-lg touch-target", children: _jsx(X, { size: 20 }) })] }), _jsx("div", { className: "flex-1 overflow-y-auto p-4 space-y-3 sm:space-y-4", children: items.length === 0 ? (_jsxs("div", { className: "flex flex-col items-center py-6 animate-fade-in h-full", children: [_jsxs("div", { className: "flex flex-col items-center text-center max-w-[280px] mb-8", children: [_jsx("div", { className: "w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center text-primary mb-3 shadow-inner", children: _jsx(ShoppingBag, { size: 24, className: "text-emerald-700" }) }), _jsx("h3", { className: "text-base font-bold text-gray-800", children: "Your cart is empty" }), _jsx("p", { className: "text-xs text-gray-400 mt-1", children: "Add some live greens to kickstart your green space!" }), _jsx("button", { onClick: closeDrawer, className: "mt-4 px-6 py-2 bg-primary hover:bg-primary/95 text-white font-bold rounded-full text-xs shadow-sm hover:shadow transition active:scale-[0.98]", children: "Continue Shopping" })] }), _jsxs("div", { className: "w-full mt-2 border-t pt-6", children: [_jsx("h4", { className: "text-xs font-bold text-gray-400 uppercase tracking-widest mb-4", children: "Shop Popular Collections" }), _jsx("div", { className: "grid grid-cols-2 gap-3.5", children: suggestionTiles.map((col) => (_jsxs(Link, { to: col.link, onClick: closeDrawer, className: "group flex flex-col bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm hover:shadow transition active:scale-[0.99]", children: [_jsxs("div", { className: "relative aspect-[4/3] overflow-hidden bg-gray-50 shrink-0", children: [_jsx("img", { src: col.image, alt: col.title, className: "w-full h-full object-cover group-hover:scale-105 transition-transform duration-500", loading: "lazy" }), _jsx("div", { className: "absolute inset-0 bg-black/5 group-hover:bg-black/0 transition-colors" })] }), _jsxs("div", { className: "p-2.5 flex flex-col flex-1", children: [_jsx("h5", { className: "text-xs font-bold text-gray-800 line-clamp-1 leading-snug", children: col.title }), _jsx("p", { className: `text-[9px] font-semibold mt-0.5 leading-none ${col.color}`, children: col.subtitle })] })] }, col.title))) })] })] })) : (_jsxs(_Fragment, { children: [items.map((item) => (_jsxs("div", { className: "flex gap-3 p-3 bg-gray-50 rounded-xl", children: [item.resolved_image_url || item.product.images?.[0] ? (_jsx("img", { src: item.resolved_image_url || item.product.images?.[0], alt: item.product.name, className: "w-16 h-16 sm:w-20 sm:h-20 rounded-lg object-cover shrink-0", loading: "lazy" })) : (_jsx("div", { className: "w-16 h-16 sm:w-20 sm:h-20 rounded-lg bg-gray-100 shrink-0" })), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx(Link, { to: `/products/${item.product.slug}`, className: "text-sm font-medium line-clamp-1 hover:text-primary", onClick: closeDrawer, children: item.product.name }), optionSummary(item) && (_jsx("p", { className: "text-[11px] text-gray-500 mt-0.5", children: optionSummary(item) })), _jsxs("p", { className: "text-primary font-semibold text-sm mt-0.5", children: ["\u20B9", item.unit_price] }), item.stock_warning && (_jsxs("p", { className: "text-[11px] text-red-500 mt-1", children: ["Only ", item.available_stock, " units available. Please adjust quantity."] })), _jsxs("div", { className: "flex items-center gap-2 mt-2", children: [_jsxs("div", { className: "flex items-center border rounded-lg", children: [_jsx("button", { onClick: () => handleUpdate(item.id, item.quantity - 1), className: "p-1.5 hover:bg-gray-100 touch-target", children: _jsx(Minus, { size: 14 }) }), _jsx("span", { className: "px-2.5 text-sm font-medium", children: item.quantity }), _jsx("button", { onClick: () => handleUpdate(item.id, item.quantity + 1), disabled: item.quantity >= item.available_stock, className: "p-1.5 hover:bg-gray-100 touch-target disabled:opacity-30 disabled:cursor-not-allowed", children: _jsx(Plus, { size: 14 }) })] }), _jsx("button", { onClick: () => handleRemove(item.id), className: "p-1.5 text-red-400 hover:text-red-600 ml-auto touch-target", children: _jsx(Trash2, { size: 15 }) })] })] }), _jsxs("p", { className: "text-sm font-semibold shrink-0", children: ["\u20B9", item.line_total] })] }, item.id))), _jsx(DoNotForgetBar, {})] })) }), items.length > 0 && (_jsxs("div", { className: "border-t p-4 space-y-3 shrink-0 safe-bottom", children: [_jsxs("div", { className: "flex justify-between text-sm", children: [_jsx("span", { className: "text-gray-500", children: "Subtotal" }), _jsxs("span", { className: "font-medium", children: ["\u20B9", total.toFixed(2)] })] }), _jsxs("div", { className: "flex justify-between text-sm", children: [_jsx("span", { className: "text-gray-500", children: "Delivery" }), _jsx("span", { className: "font-medium text-green-600", children: shipping === 0 ? 'Free' : `₹${shipping.toFixed(2)}` })] }), _jsxs("div", { className: "flex justify-between border-t pt-3 text-base font-bold", children: [_jsx("span", { children: "Total" }), _jsxs("span", { className: "text-primary", children: ["\u20B9", grandTotal.toFixed(2)] })] }), _jsxs(Link, { to: "/checkout", onClick: closeDrawer, className: "block w-full text-center py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition", children: ["Proceed to Checkout ", _jsx(ArrowRight, { size: 18, className: "inline ml-1" })] })] }))] })] }));
}
