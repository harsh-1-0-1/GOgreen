import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useBanners } from '@/hooks/useBanners';
/**
 * The row of round category icons at the top of the homepage.
 *
 * Every circle is a banner record with placement `category_nav`, so the admin
 * decides which ones appear, in what order, what the name says and what it
 * opens — the storefront renders nothing at all until at least one is added.
 * This replaces the old hardwired category circles, which pulled straight from
 * the category table and could not be curated.
 */
export default function CategoryNavBanners() {
    const { data: banners = [], isLoading } = useBanners('category_nav');
    const scrollRef = useRef(null);
    const [centered, setCentered] = useState(true);
    // A circle with no destination renders as a dead end, so it is dropped rather
    // than shown as an unclickable circle.
    const circles = banners.filter((b) => b.cta_link && b.image_url);
    useEffect(() => {
        const el = scrollRef.current;
        if (!el)
            return;
        const check = () => setCentered(el.scrollWidth <= el.clientWidth);
        check();
        const ro = new ResizeObserver(check);
        ro.observe(el);
        window.addEventListener('resize', check);
        return () => {
            ro.disconnect();
            window.removeEventListener('resize', check);
        };
    }, [circles.length]);
    if (!isLoading && circles.length === 0)
        return null;
    return (_jsx("section", { className: "bg-white w-full border-b border-gray-100 py-3 sm:py-4", children: _jsxs("div", { ref: scrollRef, className: "overflow-x-auto scrollbar-hide px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto", style: { scrollbarWidth: 'none', msOverflowStyle: 'none' }, children: [_jsx("style", { children: `.scrollbar-hide::-webkit-scrollbar { display: none; }` }), _jsx("div", { className: `flex gap-4 flex-nowrap w-max min-w-full ${centered ? 'mx-auto justify-center' : ''}`, children: isLoading
                        ? Array.from({ length: 6 }).map((_, i) => (_jsxs("div", { className: "flex flex-col items-center gap-1.5 sm:gap-2 flex-shrink-0 w-max min-w-[68px] sm:min-w-[76px] lg:min-w-[84px]", children: [_jsx("div", { className: "w-[60px] h-[60px] sm:w-[68px] sm:h-[68px] lg:w-[76px] lg:h-[76px] rounded-full bg-gray-100 animate-pulse" }), _jsx("div", { className: "h-3 w-12 rounded bg-gray-100 animate-pulse" })] }, i)))
                        : circles.map((banner) => (_jsxs(Link, { to: banner.cta_link || '#', className: "flex flex-col items-center gap-1.5 sm:gap-2 group flex-shrink-0 w-max min-w-[68px] sm:min-w-[76px] lg:min-w-[84px]", children: [_jsx("div", { className: "w-[60px] h-[60px] sm:w-[68px] sm:h-[68px] lg:w-[76px] lg:h-[76px] rounded-full overflow-hidden bg-gray-50 border-2 border-transparent group-hover:border-[#16A34A] transition-colors p-0.5", children: _jsx("img", { src: banner.image_url || '', alt: banner.title, className: "w-full h-full object-cover rounded-full", loading: "lazy", onError: (e) => {
                                            e.currentTarget.style.display = 'none';
                                        } }) }), _jsx("span", { className: "text-xs sm:text-sm lg:text-base font-medium text-center text-gray-700 leading-tight whitespace-nowrap", children: banner.title })] }, banner.id))) })] }) }));
}
