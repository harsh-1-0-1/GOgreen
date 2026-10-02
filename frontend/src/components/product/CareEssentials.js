import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Droplets, Sun } from 'lucide-react';
function normalize(value) {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
}
/**
 * Compact at-a-glance care card for the buy-box column (sunlight + watering).
 *
 * Renders nothing when neither field is set, so it never leaves a hollow
 * placeholder. Deliberately excludes `care_tips`, which the CareTips accordion
 * already owns — repeating the same copy here is what made the column read as
 * padded rather than dense.
 */
export default function CareEssentials({ sunlight, watering }) {
    const light = normalize(sunlight);
    const water = normalize(watering);
    if (!light && !water)
        return null;
    const items = [
        light ? { label: 'Sunlight', value: light, Icon: Sun } : null,
        water ? { label: 'Watering', value: water, Icon: Droplets } : null,
    ].filter((item) => item !== null);
    return (_jsxs("section", { className: "rounded-2xl border border-primary/15 bg-[#F4F8F4] p-4 sm:p-5", "aria-labelledby": "care-essentials-title", children: [_jsx("h2", { id: "care-essentials-title", className: "mb-3 text-[11px] font-semibold uppercase tracking-widest text-primary", children: "Care essentials" }), _jsx("dl", { className: `grid gap-3 ${items.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`, children: items.map(({ label, value, Icon }) => (_jsxs("div", { className: "flex items-center gap-2.5 rounded-xl bg-white px-3 py-2.5 shadow-sm", children: [_jsx("span", { className: "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary", children: _jsx(Icon, { size: 16, strokeWidth: 1.8, "aria-hidden": "true" }) }), _jsxs("span", { className: "min-w-0", children: [_jsx("dt", { className: "text-[10px] font-semibold uppercase tracking-wide text-gray-400", children: label }), _jsx("dd", { className: "text-xs font-medium leading-snug text-gray-800 sm:text-sm", children: value })] })] }, label))) })] }));
}
