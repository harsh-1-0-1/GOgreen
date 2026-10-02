import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useRef } from 'react';
import { useBanners } from '@/hooks/useBanners';
export default function HappyPlanters({ fallbackImages }) {
    const { data: banners = [] } = useBanners('happy_planters');
    const scrollerRef = useRef(null);
    const managedImages = banners
        .filter((banner) => banner.image_url)
        .map((banner) => ({ src: banner.image_url, alt: '' }));
    const images = managedImages.length
        ? managedImages
        : fallbackImages.map((src, index) => ({ src, alt: `Plantoga plant ${index + 1}` }));
    if (!images.length)
        return null;
    function scroll(direction) {
        const element = scrollerRef.current;
        if (!element)
            return;
        element.scrollBy({ left: direction * Math.min(element.clientWidth * 0.8, 440), behavior: 'smooth' });
    }
    return (_jsxs("section", { className: "mt-8 sm:mt-10", "aria-labelledby": "happy-planters-title", children: [_jsxs("div", { className: "mb-4 flex items-end justify-between gap-4", children: [_jsxs("div", { children: [_jsx("p", { className: "mb-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary", children: "Growing together" }), _jsx("h2", { id: "happy-planters-title", className: "text-2xl font-bold text-gray-900 sm:text-3xl", style: { fontFamily: "'Playfair Display', Georgia, serif" }, children: "Happy Planters" })] }), images.length > 1 && (_jsxs("div", { className: "hidden gap-2 sm:flex", "aria-label": "Gallery controls", children: [_jsx("button", { type: "button", onClick: () => scroll(-1), className: "flex h-10 w-10 items-center justify-center rounded-full border border-primary/20 bg-white text-primary transition hover:bg-primary hover:text-white", "aria-label": "Previous images", children: _jsx(ChevronLeft, { size: 19 }) }), _jsx("button", { type: "button", onClick: () => scroll(1), className: "flex h-10 w-10 items-center justify-center rounded-full border border-primary/20 bg-white text-primary transition hover:bg-primary hover:text-white", "aria-label": "Next images", children: _jsx(ChevronRight, { size: 19 }) })] }))] }), _jsx("div", { ref: scrollerRef, className: "-mx-3 flex snap-x-mandatory gap-3 overflow-x-auto px-3 pb-3 scrollbar-hide sm:-mx-4 sm:gap-4 sm:px-4", children: images.map((image, index) => (_jsx("figure", { className: "relative aspect-[4/5] w-[68vw] max-w-[280px] shrink-0 snap-start overflow-hidden rounded-2xl bg-[#EAF3ED] sm:w-64", children: _jsx("img", { src: image.src, alt: image.alt, className: "h-full w-full object-cover transition duration-500 hover:scale-[1.03]", loading: "lazy" }) }, `${image.src}-${index}`))) }), images.length > 1 && _jsx("p", { className: "mt-1 text-center text-[11px] text-gray-400 sm:hidden", children: "Swipe to see more" })] }));
}
