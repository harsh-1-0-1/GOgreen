import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
export default function ProductSpecification({ specs }) {
    const [open, setOpen] = useState(false);
    return (_jsxs("div", { className: "mt-8 sm:mt-10 border border-gray-200 rounded-xl overflow-hidden bg-white", children: [_jsxs("button", { type: "button", onClick: () => setOpen(!open), className: "w-full flex items-center justify-between px-4 py-4 text-sm font-semibold text-gray-900 hover:bg-gray-50 transition touch-target", children: ["Product Specification", open ? _jsx(ChevronUp, { size: 18 }) : _jsx(ChevronDown, { size: 18 })] }), open && (_jsx("div", { className: "border-t border-gray-200", children: specs.map(({ label, value }) => (_jsxs("div", { children: [_jsx("div", { className: "px-4 py-3 bg-gray-100 text-sm font-semibold text-gray-800", children: label }), _jsx("div", { className: "px-4 py-3 bg-white text-sm text-gray-700 leading-relaxed border-b border-gray-100 last:border-b-0", children: value })] }, label))) }))] }));
}
