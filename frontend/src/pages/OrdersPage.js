import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Package } from 'lucide-react';
import { useOrders } from '@/hooks/useOrders';
import Spinner from '@/components/ui/Spinner';
const STATUS_COLORS = {
    pending: 'bg-yellow-100 text-yellow-700',
    confirmed: 'bg-blue-100 text-blue-700',
    shipped: 'bg-purple-100 text-purple-700',
    delivered: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-700',
};
export default function OrdersPage() {
    const [page, setPage] = useState(1);
    const { data, isLoading } = useOrders(page);
    if (isLoading)
        return _jsx(Spinner, { className: "py-32" });
    return (_jsxs("div", { className: "max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-8", children: [_jsxs("h1", { className: "text-xl sm:text-2xl font-bold mb-4 sm:mb-8 flex items-center gap-2", children: [_jsx(Package, { size: 22, className: "text-primary" }), " My Orders"] }), !data?.items.length ? (_jsxs("div", { className: "text-center py-16 sm:py-20 text-gray-400", children: [_jsx(Package, { size: 48, strokeWidth: 1, className: "mx-auto mb-3" }), _jsx("p", { className: "text-lg font-medium", children: "No orders yet" }), _jsx(Link, { to: "/products", className: "text-sm text-primary hover:underline mt-2 inline-block", children: "Start Shopping" })] })) : (_jsx("div", { className: "space-y-3 sm:space-y-4", children: data.items.map((order) => (_jsxs(Link, { to: `/orders/${order.id}`, className: "block bg-white rounded-xl sm:rounded-2xl border p-4 sm:p-5 hover:shadow-md transition active:scale-[0.99]", children: [_jsxs("div", { className: "flex items-start justify-between mb-2 sm:mb-3", children: [_jsxs("div", { children: [_jsx("span", { className: "text-xs sm:text-sm text-gray-400", children: "Order #" }), _jsx("span", { className: "font-bold text-sm sm:text-base ml-1", children: order.id })] }), _jsx("span", { className: `text-[10px] sm:text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-600'}`, children: order.status })] }), _jsxs("div", { className: "flex items-end justify-between", children: [_jsxs("div", { className: "text-xs sm:text-sm text-gray-500", children: [_jsx("p", { children: new Date(order.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }) }), _jsxs("p", { className: "mt-0.5", children: [order.items.length, " item", order.items.length !== 1 && 's'] })] }), _jsx("div", { className: "text-right", children: _jsxs("span", { className: "font-bold text-primary text-base sm:text-lg", children: ["\u20B9", order.total_amount.toFixed(0)] }) })] })] }, order.id))) })), data && data.pages > 1 && (_jsxs("div", { className: "flex items-center justify-center gap-4 mt-6 sm:mt-8", children: [_jsx("button", { disabled: page <= 1, onClick: () => setPage(page - 1), className: "p-2 border rounded-lg hover:bg-gray-50 disabled:opacity-30 touch-target", children: _jsx(ChevronLeft, { size: 18 }) }), _jsxs("span", { className: "text-sm text-gray-500", children: ["Page ", page, " of ", data.pages] }), _jsx("button", { disabled: page >= data.pages, onClick: () => setPage(page + 1), className: "p-2 border rounded-lg hover:bg-gray-50 disabled:opacity-30 touch-target", children: _jsx(ChevronRight, { size: 18 }) })] }))] }));
}
