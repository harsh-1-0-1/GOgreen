import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import clsx from 'clsx';
const SERIF = "'Playfair Display', Georgia, serif";
function getDiscount(product) {
    if (product.original_price && product.original_price > product.price) {
        return Math.round(((product.original_price - product.price) / product.original_price) * 100);
    }
    return [20, 25, 30, 15, 22, 18][Math.abs(product.id) % 6];
}
function ProductCard({ product }) {
    const discount = getDiscount(product);
    return (_jsxs(Link, { to: `/products/${product.slug}`, className: "group flex flex-col bg-white rounded-2xl overflow-hidden h-full p-3 sm:p-4", style: {
            boxShadow: '0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)',
        }, children: [_jsx("div", { className: "relative overflow-hidden rounded-xl bg-[#f5f1ec] shrink-0 aspect-[4/3] sm:aspect-square flex items-center justify-center p-3 sm:p-4", children: product.images?.[0] ? (_jsx("img", { src: product.images?.[0], alt: product.name, className: "w-full h-full object-contain object-center group-hover:scale-105 transition-transform duration-500", loading: "lazy" })) : (_jsx("div", { className: "w-full h-full bg-gray-100" })) }), _jsxs("div", { className: "pt-3 sm:pt-4 flex flex-col gap-1.5 sm:gap-2 flex-1", children: [_jsx("p", { className: "font-bold text-sm sm:text-base leading-snug line-clamp-1 text-gray-900", children: product.name }), _jsxs("div", { className: "flex items-center justify-between mt-auto", children: [_jsxs("span", { className: "inline-flex items-center gap-1 text-sm font-semibold px-3 py-1.5 rounded-full", style: { backgroundColor: '#D1FAE5', color: '#065F46' }, children: ["Get ", discount, "% OFF"] }), _jsx("span", { className: "w-8 h-8 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform", style: { backgroundColor: '#059669' }, children: _jsx(ArrowRight, { size: 16, className: "text-white" }) })] })] })] }));
}
function FullScreenCarouselLayout({ bgValue, headline, subheadline, headlineColor, products, }) {
    const scrollContainerRef = useRef(null);
    const [index, setIndex] = useState(0);
    const dotCount = products.length;
    function handleScroll(e) {
        const el = e.currentTarget;
        if (!el.firstElementChild)
            return;
        const cardWidth = el.firstElementChild.clientWidth;
        const gap = 20;
        const newIndex = Math.round(el.scrollLeft / (cardWidth + gap));
        if (newIndex !== index) {
            setIndex(newIndex);
        }
    }
    function scrollToA(i) {
        if (scrollContainerRef.current) {
            const el = scrollContainerRef.current;
            const cardWidth = el.firstElementChild?.clientWidth || 0;
            const gap = 20;
            el.scrollTo({ left: i * (cardWidth + gap), behavior: 'smooth' });
        }
    }
    function prev() {
        if (scrollContainerRef.current) {
            const el = scrollContainerRef.current;
            const cardWidth = el.firstElementChild?.clientWidth || 0;
            el.scrollBy({ left: -(cardWidth + 20), behavior: 'smooth' });
        }
    }
    function next() {
        if (scrollContainerRef.current) {
            const el = scrollContainerRef.current;
            const cardWidth = el.firstElementChild?.clientWidth || 0;
            el.scrollBy({ left: cardWidth + 20, behavior: 'smooth' });
        }
    }
    return (_jsxs("section", { className: "relative w-full overflow-hidden h-dvh min-h-[640px]", children: [_jsx("img", { src: bgValue, alt: "", className: "absolute inset-0 w-full h-full object-cover", loading: "lazy" }), _jsx("div", { className: "absolute inset-0 bg-black/35" }), _jsxs("div", { className: "relative z-10 flex flex-col h-full", children: [_jsx("div", { className: "flex-1 flex items-center justify-center px-6 pt-6", children: _jsxs("div", { className: "text-center space-y-3 md:space-y-4 max-w-3xl", children: [_jsx("h2", { className: "text-5xl sm:text-6xl md:text-7xl lg:text-[80px] font-bold italic leading-[1.05]", style: { fontFamily: SERIF, color: headlineColor }, children: headline }), subheadline && (_jsx("p", { className: "text-xl md:text-2xl text-white/90 font-medium", children: subheadline }))] }) }), _jsxs("div", { className: "relative px-10 sm:px-14 md:px-16 lg:px-20 pb-6 max-w-[1300px] mx-auto w-full", children: [_jsxs("div", { className: "relative w-full", children: [_jsx("style", { children: `.hide-scrollbar::-webkit-scrollbar { display: none; }` }), _jsx("div", { ref: scrollContainerRef, onScroll: handleScroll, className: "flex gap-5 overflow-x-auto snap-x snap-mandatory pt-2 pb-6 hide-scrollbar", style: { scrollbarWidth: 'none', msOverflowStyle: 'none' }, children: products.map((product) => (_jsx("div", { className: "shrink-0 snap-start w-[82%] sm:w-[44%] lg:w-[28%]", children: _jsx(ProductCard, { product: product }) }, product.id))) })] }), _jsx("button", { onClick: prev, "aria-label": "Previous", className: "absolute left-1 sm:left-2 md:left-4 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white shadow-xl flex items-center justify-center text-gray-700 hover:scale-110 transition-all z-20", children: _jsx(ChevronLeft, { size: 20 }) }), _jsx("button", { onClick: next, "aria-label": "Next", className: "absolute right-1 sm:right-2 md:right-4 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white shadow-xl flex items-center justify-center text-gray-700 hover:scale-110 transition-all z-20", children: _jsx(ChevronRight, { size: 20 }) })] }), dotCount > 1 && (_jsx("div", { className: "flex items-center justify-center gap-2 pb-5 mt-2", children: Array.from({ length: dotCount }).map((_, i) => (_jsx("button", { onClick: () => scrollToA(i), "aria-label": `Go to slide ${i + 1}`, className: clsx('rounded-full transition-all duration-300', i === index
                                ? 'w-6 h-2 bg-white'
                                : 'w-2 h-2 bg-white/40 hover:bg-white/70') }, i))) }))] })] }));
}
export default function ThemedProductSection(props) {
    if (!props.products.length)
        return null;
    return _jsx(FullScreenCarouselLayout, { ...props });
}
