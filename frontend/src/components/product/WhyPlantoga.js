import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Check, Leaf, Minus, X } from 'lucide-react';
const COMPARISONS = [
    {
        feature: 'Plant quality',
        local: { status: 'mixed', text: 'Can vary' },
        plantoga: { status: 'yes', text: 'Healthy & quality checked' },
        marketplace: { status: 'mixed', text: 'Inconsistent' },
    },
    {
        feature: 'Pest check',
        local: { status: 'no', text: 'Not assured' },
        plantoga: { status: 'yes', text: 'Pest inspected' },
        marketplace: { status: 'mixed', text: 'Possible risk' },
    },
    {
        feature: 'Repotting',
        local: { status: 'mixed', text: 'May be needed' },
        plantoga: { status: 'yes', text: 'Ready to grow' },
        marketplace: { status: 'mixed', text: 'Varies' },
    },
    {
        feature: 'Soil',
        local: { status: 'mixed', text: 'Standard mix' },
        plantoga: { status: 'yes', text: 'Plant-ready blend' },
        marketplace: { status: 'mixed', text: 'Standard mix' },
    },
    {
        feature: 'Growing',
        local: { status: 'mixed', text: 'Varies' },
        plantoga: { status: 'yes', text: 'Nursery grown' },
        marketplace: { status: 'mixed', text: 'Outsourced' },
    },
    {
        feature: 'Care support',
        local: { status: 'no', text: 'Limited' },
        plantoga: { status: 'yes', text: 'Expert support' },
        marketplace: { status: 'no', text: 'Limited' },
    },
    {
        feature: 'Guarantee',
        local: { status: 'no', text: 'Not assured' },
        plantoga: { status: 'yes', text: '14-day guarantee' },
        marketplace: { status: 'mixed', text: 'Seller dependent' },
    },
];
function StatusIcon({ status }) {
    if (status === 'yes')
        return _jsx(Check, { size: 17, strokeWidth: 3, "aria-hidden": "true" });
    if (status === 'no')
        return _jsx(X, { size: 16, strokeWidth: 2.5, "aria-hidden": "true" });
    return _jsx(Minus, { size: 16, strokeWidth: 2.5, "aria-hidden": "true" });
}
function ValueCell({ value, featured = false }) {
    return (_jsxs("td", { className: `px-1.5 py-3 text-center align-middle sm:px-4 sm:py-4 ${featured ? 'bg-primary text-white' : 'bg-white text-gray-600'}`, children: [_jsx("span", { className: `mx-auto mb-1 flex h-5 w-5 items-center justify-center rounded-full ${featured ? 'bg-white/15 text-[#F4A261]' : value.status === 'no' ? 'text-gray-400' : 'text-primary'}`, children: _jsx(StatusIcon, { status: value.status }) }), _jsx("span", { className: `block text-[9px] leading-tight sm:text-xs ${featured ? 'font-medium text-white' : ''}`, children: value.text })] }));
}
export default function WhyPlantoga({ bannerImage }) {
    if (bannerImage) {
        return (_jsx("section", { className: "mt-8 sm:mt-10", children: _jsx("img", { src: bannerImage, alt: "Plantoga vs the rest", className: "mx-auto max-w-full h-auto" }) }));
    }
    return (_jsxs("section", { className: "mt-8 sm:mt-10", "aria-labelledby": "why-plantoga-title", children: [_jsxs("div", { className: "mb-5 text-center", children: [_jsxs("span", { className: "mb-2 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-primary", children: [_jsx(Leaf, { size: 13, "aria-hidden": "true" }), "The greener choice"] }), _jsx("h2", { id: "why-plantoga-title", className: "text-2xl font-bold text-gray-900 sm:text-3xl", style: { fontFamily: "'Playfair Display', Georgia, serif" }, children: "Plantoga vs the rest" }), _jsx("p", { className: "mx-auto mt-2 max-w-lg text-sm text-gray-500", children: "Thoughtfully grown plants, checked and supported beyond delivery." })] }), _jsxs("div", { className: "overflow-hidden rounded-2xl border border-primary/15 bg-white shadow-sm", children: [_jsxs("table", { className: "w-full table-fixed border-collapse", "aria-label": "Plant seller comparison", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { className: "w-[25%] bg-[#EAF3ED] px-2 py-4 text-left text-[10px] font-semibold text-primary sm:px-4 sm:text-sm", children: "What matters" }), _jsx("th", { className: "w-[25%] bg-[#EAF3ED] px-1 py-4 text-center text-[10px] font-semibold text-primary sm:px-4 sm:text-sm", children: "Local sellers" }), _jsx("th", { className: "w-[25%] bg-primary px-1 py-4 text-center text-xs font-bold text-white sm:px-4 sm:text-base", children: _jsxs("span", { className: "flex items-center justify-center gap-1", children: [_jsx(Leaf, { size: 15, className: "text-[#F4A261]", "aria-hidden": "true" }), "Plantoga"] }) }), _jsx("th", { className: "w-[25%] bg-[#EAF3ED] px-1 py-4 text-center text-[10px] font-semibold text-primary sm:px-4 sm:text-sm", children: "Marketplaces" })] }) }), _jsx("tbody", { className: "divide-y divide-gray-100", children: COMPARISONS.map((row) => (_jsxs("tr", { children: [_jsx("th", { scope: "row", className: "bg-[#F7FAF7] px-2 py-3 text-left text-[10px] font-semibold leading-tight text-gray-700 sm:px-4 sm:py-4 sm:text-sm", children: row.feature }), _jsx(ValueCell, { value: row.local }), _jsx(ValueCell, { value: row.plantoga, featured: true }), _jsx(ValueCell, { value: row.marketplace })] }, row.feature))) })] }), _jsx("div", { className: "bg-[#1B4332] px-4 py-3 text-center text-xs font-medium text-white/90 sm:text-sm", children: "From our nursery to your home, with care at every step." })] })] }));
}
