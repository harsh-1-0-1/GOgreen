import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Link } from 'react-router-dom';
import { useBanners } from '@/hooks/useBanners';
export default function PromoCTASection() {
    const { data: banners = [], isLoading } = useBanners('themed');
    if (isLoading) {
        return (_jsx("section", { className: "w-full py-10 sm:py-14 bg-white", children: _jsx("div", { className: "mx-auto px-6 sm:px-10 lg:px-16 xl:px-24 max-w-7xl", children: _jsxs("div", { className: "grid md:grid-cols-2 gap-4 sm:gap-5", children: [_jsx("div", { className: "aspect-[16/9] rounded-2xl bg-gray-200 animate-pulse" }), _jsx("div", { className: "aspect-[16/9] rounded-2xl bg-gray-200 animate-pulse" })] }) }) }));
    }
    if (banners.length === 0)
        return null;
    const cards = banners;
    return (_jsx("section", { className: "w-full py-10 sm:py-14 bg-white", children: _jsx("div", { className: "mx-auto px-6 sm:px-10 lg:px-16 xl:px-24 max-w-7xl", children: _jsx("div", { className: "grid md:grid-cols-2 gap-4 sm:gap-5", children: cards.map((card) => {
                    const content = (_jsx(_Fragment, { children: card.image_url && (_jsx("img", { src: card.image_url, alt: "", className: "w-full h-auto object-cover", loading: "lazy", onError: (e) => {
                                e.currentTarget.style.display = 'none';
                            } })) }));
                    const className = 'block rounded-2xl overflow-hidden hover:opacity-95 transition-opacity';
                    return card.cta_link ? (_jsx(Link, { to: card.cta_link, className: className, children: content }, card.id)) : (_jsx("div", { className: className, children: content }, card.id));
                }) }) }) }));
}
