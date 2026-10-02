import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { Link } from 'react-router-dom';
import { useBanners } from '@/hooks/useBanners';
function QuickAccessSkeleton() {
    return (_jsx("section", { className: "w-full py-4 sm:py-6", children: _jsx("div", { className: "flex gap-2 sm:gap-3 lg:gap-4 overflow-x-auto scrollbar-hide px-4 sm:px-6 lg:px-10 xl:px-16 w-full pb-2 lg:pb-0", children: Array.from({ length: 8 }).map((_, i) => (_jsx("div", { className: "shrink-0 w-[140px] sm:w-[160px] lg:w-auto lg:flex-1 h-[170px] sm:h-auto aspect-[3/4] rounded-2xl bg-gray-200 animate-pulse" }, i))) }) }));
}
function PromoTile({ tile }) {
    const className = 'shrink-0 lg:shrink lg:flex-1 w-[140px] sm:w-[160px] lg:w-auto h-[170px] sm:h-auto aspect-[3/4] rounded-2xl flex items-center justify-center p-4 transition-all hover:scale-[1.02] shadow-sm hover:shadow-md';
    const content = (_jsx("span", { className: "text-lg sm:text-xl lg:text-2xl font-bold italic leading-tight text-center whitespace-pre-line", style: { color: tile.textColor }, children: tile.label }));
    if (!tile.link) {
        return (_jsx("div", { className: className, style: { backgroundColor: tile.bg }, children: content }));
    }
    return (_jsx(Link, { to: tile.link, className: className, style: { backgroundColor: tile.bg }, children: content }));
}
function CategoryTile({ tile }) {
    const className = 'group shrink-0 lg:shrink lg:flex-1 w-[140px] sm:w-[160px] lg:w-auto h-[170px] sm:h-auto aspect-[3/4] rounded-2xl overflow-hidden relative flex flex-col shadow-sm hover:shadow-md transition-all hover:scale-[1.02]';
    const content = (_jsxs(_Fragment, { children: [_jsx("div", { className: "relative flex-1 min-h-0", children: _jsx("img", { src: tile.image, alt: tile.label, loading: "lazy", className: "absolute inset-0 w-full h-full object-cover" }) }), _jsx("div", { className: "relative bg-white px-3 py-1 sm:py-1.5 border-t", children: _jsx("span", { className: "text-[11px] sm:text-sm font-bold text-gray-800 leading-tight block text-center truncate", children: tile.label }) })] }));
    if (!tile.link) {
        return _jsx("div", { className: className, children: content });
    }
    return (_jsx(Link, { to: tile.link, className: className, children: content }));
}
export default function QuickAccessStrip() {
    const { data: banners = [], isLoading } = useBanners('strip');
    if (isLoading)
        return _jsx(QuickAccessSkeleton, {});
    if (banners.length === 0)
        return null;
    const tiles = banners.map((b) => ({
        id: b.id,
        type: b.image_url ? 'category' : 'promo',
        label: b.title.replace('\\n', '\n'),
        link: b.cta_link || undefined,
        image: b.image_url || undefined,
        bg: b.bg_color,
        textColor: b.text_color,
    }));
    return (_jsx("section", { className: "w-full py-4 sm:py-6", children: _jsx("div", { className: "flex gap-2 sm:gap-3 lg:gap-4 overflow-x-auto lg:overflow-visible scrollbar-hide px-4 sm:px-6 lg:px-10 xl:px-16 w-full pb-2 lg:pb-0", children: tiles.map((tile) => tile.type === 'promo' ? (_jsx(PromoTile, { tile: tile }, tile.id)) : (_jsx(CategoryTile, { tile: tile }, tile.id))) }) }));
}
