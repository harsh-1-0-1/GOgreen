import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link } from 'react-router-dom';
import { useBanners } from '@/hooks/useBanners';
function HighlightCardSkeleton() {
    return (_jsxs("div", { className: "flex flex-col gap-2.5 sm:gap-3", children: [_jsx("div", { className: "aspect-[3/4] rounded-xl bg-gray-100 animate-pulse" }), _jsx("div", { className: "h-5 w-3/4 mx-auto rounded bg-gray-100 animate-pulse" })] }));
}
export default function CategoryHighlightGrid() {
    const { data: banners = [], isLoading } = useBanners('highlight');
    const cards = banners;
    if (!isLoading && cards.length === 0)
        return null;
    return (_jsx("section", { className: "w-full py-7 sm:py-9 bg-white", children: _jsx("div", { className: "mx-auto max-w-[760px] px-2 sm:px-6", children: _jsx("div", { className: "grid grid-cols-2 gap-x-2.5 gap-y-5 sm:gap-x-5 sm:gap-y-7", children: isLoading
                    ? Array.from({ length: 4 }).map((_, i) => (_jsx(HighlightCardSkeleton, {}, i)))
                    : cards.map((card) => {
                        const content = (_jsxs("div", { className: "group flex flex-col gap-2.5 sm:gap-3", children: [_jsx("div", { className: "relative aspect-[3/4] overflow-hidden rounded-xl shadow-sm transition-all group-hover:shadow-md", style: { backgroundColor: card.bg_color || '#F5F0E8' }, children: card.image_url && (_jsx("img", { src: card.image_url, alt: "", loading: "lazy", className: "absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700", onError: (e) => {
                                            e.currentTarget.style.display = 'none';
                                        } })) }), card.title && (_jsx("span", { className: "text-center text-[clamp(1rem,4vw,1.65rem)] font-semibold leading-tight", style: { color: card.text_color || '#16A34A' }, children: card.title })), card.subtitle && (_jsx("span", { className: "text-center text-[clamp(0.75rem,3vw,1rem)] text-gray-500 leading-tight", children: card.subtitle }))] }));
                        return card.cta_link ? (_jsx(Link, { to: card.cta_link, children: content }, card.id)) : (_jsx("div", { children: content }, card.id));
                    }) }) }) }));
}
