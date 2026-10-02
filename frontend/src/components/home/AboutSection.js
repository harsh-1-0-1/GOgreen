import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link } from 'react-router-dom';
const SERIF = "'Playfair Display', Georgia, serif";
const A = ({ to, children }) => (_jsx(Link, { to: to, className: "font-semibold hover:opacity-80 transition-opacity", style: {
        color: '#16A34A',
        textDecoration: 'underline',
        textDecorationColor: '#52B788',
        textUnderlineOffset: '3px',
    }, children: children }));
const STATS = [
    { number: '10M+', label: 'Plant Parents' },
    { number: '500+', label: 'Plant Varieties' },
    { number: '50+', label: 'Cities Delivered' },
];
const PILLS = [
    '🌿 100% Natural Plants',
    '🚚 Next-Day Delivery',
    '⭐ 4.8 Rated on Google',
    '↩ Easy Returns',
];
export default function AboutSection() {
    return (_jsx("section", { id: "about-us", className: "w-full border-t-4", style: {
            backgroundColor: '#F7F5F0',
            borderTopColor: '#52B788',
        }, children: _jsx("div", { className: "mx-auto px-6 sm:px-10 lg:px-16 xl:px-24 py-14 sm:py-20", children: _jsxs("div", { className: "grid md:grid-cols-2 gap-10 md:gap-20 items-start", children: [_jsxs("div", { className: "relative", children: [_jsxs("svg", { viewBox: "0 0 200 280", className: "absolute -top-6 -left-6 w-48 h-auto opacity-[0.06] pointer-events-none select-none", fill: "#2D6A4F", "aria-hidden": "true", children: [_jsx("path", { d: "M100 0C60 40 10 100 10 170c0 60 40 110 90 110s90-50 90-110C190 100 140 40 100 0zM100 260c-40 0-70-40-70-90 0-55 40-105 70-140 30 35 70 85 70 140 0 50-30 90-70 90z" }), _jsx("path", { d: "M97 60v180M97 120c-20-15-40-10-50 5M103 160c20-15 40-10 50 5M97 90c-15-10-30-8-38 3M103 200c15-10 30-8 38 3", fill: "none", stroke: "#2D6A4F", strokeWidth: "3" })] }), _jsxs("div", { className: "relative", children: [_jsx("h2", { className: "text-[32px] sm:text-[48px] font-bold leading-[1.1] mb-5", style: { fontFamily: SERIF, color: '#1B4332' }, children: "About Plantoga" }), _jsx("div", { className: "mb-6", style: {
                                            width: '4px',
                                            height: '48px',
                                            backgroundColor: '#52B788',
                                            display: 'inline-block',
                                            borderRadius: '2px',
                                        } }), _jsx("div", { className: "flex items-start gap-0", children: STATS.map((stat, i) => (_jsxs("div", { className: "flex items-start", children: [i > 0 && (_jsx("div", { className: "w-px h-12 bg-gray-300 mx-4 sm:mx-6 mt-1 shrink-0" })), _jsxs("div", { children: [_jsx("p", { className: "text-[28px] sm:text-[32px] font-bold leading-none", style: { color: '#1B4332' }, children: stat.number }), _jsx("p", { className: "text-[13px] text-gray-500 mt-1", children: stat.label })] })] }, stat.label))) })] })] }), _jsxs("div", { children: [_jsxs("p", { className: "leading-[1.85] mb-6", style: { fontSize: '17px', color: '#2C2C2A' }, children: ["Plantoga is India's no.1 online plant store and gardening products destination, trusted by millions of plant lovers. Shop a wide range of", ' ', _jsx(A, { to: "/products?category=indoor-plants", children: "indoor plants" }), ",", ' ', _jsx(A, { to: "/products?category=flowering-plants", children: "flowering plants" }), ",", ' ', _jsx(A, { to: "/products?category=cacti-succulents", children: "succulents" }), ", and", ' ', _jsx(A, { to: "/products?tags=air-purifying", children: "air-purifying plants" }), " delivered right to your doorstep. We also offer a complete range of gardening products, including premium", ' ', _jsx(A, { to: "/products?category=seeds", children: "seeds" }), ", organic", ' ', _jsx(A, { to: "/products?tags=fertiliser", children: "fertilizers" }), ", stylish", ' ', _jsx(A, { to: "/products?category=pots-planters", children: "planters" }), ", and essential", ' ', _jsx(A, { to: "/products?tags=tools", children: "gardening tools" }), " to help your garden thrive."] }), _jsx("div", { className: "flex flex-wrap gap-2", children: PILLS.map((pill) => (_jsx("span", { className: "inline-flex items-center px-4 py-2 text-[13px] rounded-full", style: {
                                        border: '1.5px solid #52B788',
                                        color: '#16A34A',
                                    }, children: pill }, pill))) })] })] }) }) }));
}
