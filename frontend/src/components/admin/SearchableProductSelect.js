import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
export default function SearchableProductSelect({ products, onSelect, placeholder = 'Search products...', }) {
    const [search, setSearch] = useState('');
    const [isOpen, setIsOpen] = useState(true);
    const filtered = useMemo(() => {
        if (!search.trim())
            return products;
        const q = search.toLowerCase();
        return products.filter((p) => p.name.toLowerCase().includes(q) ||
            p.slug.toLowerCase().includes(q));
    }, [search, products]);
    function handleSelect(productId) {
        onSelect(productId);
        setSearch('');
        setIsOpen(false);
    }
    return (_jsxs("div", { className: "relative w-full", children: [_jsxs("div", { className: "relative", children: [_jsx(Search, { size: 16, className: "absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" }), _jsx("input", { type: "text", placeholder: placeholder, value: search, onChange: (e) => {
                            setSearch(e.target.value);
                            setIsOpen(true);
                        }, onFocus: () => setIsOpen(true), className: "w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary focus:border-transparent", autoFocus: true })] }), isOpen && (_jsx("div", { className: "absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-20 max-h-80 overflow-y-auto", children: filtered.length === 0 ? (_jsx("div", { className: "px-4 py-3 text-sm text-gray-500 text-center", children: search.trim() ? 'No products found' : 'No products available' })) : (_jsx("div", { className: "divide-y", children: filtered.map((product) => (_jsxs("button", { onClick: () => handleSelect(product.id), className: "w-full px-4 py-3 text-left hover:bg-gray-50 transition flex items-center gap-3", children: [product.images?.[0] ? (_jsx("img", { src: product.images?.[0], alt: product.name, className: "w-8 h-8 rounded object-cover bg-gray-100 shrink-0" })) : (_jsx("div", { className: "w-8 h-8 rounded bg-gray-100 shrink-0" })), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("p", { className: "text-sm font-medium text-gray-900 truncate", children: product.name }), _jsxs("p", { className: "text-xs text-gray-500", children: ["\u20B9", product.price] })] })] }, product.id))) })) })), isOpen && products.length > 0 && (_jsx("div", { className: "fixed inset-0 z-10", onClick: () => setIsOpen(false) }))] }));
}
