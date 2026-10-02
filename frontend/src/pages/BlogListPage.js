import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useBlogPosts } from '@/hooks/useBlog';
const CATEGORIES = [
    { label: 'All', value: '' },
    { label: 'GROW', value: 'GROW' },
    { label: 'CARE', value: 'CARE' },
    { label: 'DIY', value: 'DIY' },
    { label: 'TIPS', value: 'TIPS' },
];
const CATEGORY_COLORS = {
    GROW: 'bg-green-100 text-green-700',
    CARE: 'bg-blue-100 text-blue-700',
    DIY: 'bg-amber-100 text-amber-700',
    TIPS: 'bg-purple-100 text-purple-700',
};
export default function BlogListPage() {
    const [activeCategory, setActiveCategory] = useState('');
    const { data, isLoading } = useBlogPosts({
        category: activeCategory || undefined,
        limit: 50,
    });
    return (_jsxs("div", { className: "max-w-7xl mx-auto px-3 sm:px-4 py-6 sm:py-10", children: [_jsx("h1", { className: "text-2xl sm:text-3xl font-bold text-center mb-6 sm:mb-8", children: "Our Blog" }), _jsx("div", { className: "flex items-center justify-center gap-2 sm:gap-3 mb-8 flex-wrap", children: CATEGORIES.map((cat) => (_jsx("button", { onClick: () => setActiveCategory(cat.value), className: `px-4 py-2 rounded-full text-sm font-medium transition ${activeCategory === cat.value
                        ? 'bg-primary text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`, children: cat.label }, cat.value))) }), isLoading ? (_jsx("div", { className: "grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6", children: Array.from({ length: 6 }).map((_, i) => (_jsx("div", { className: "animate-pulse bg-gray-200 rounded-2xl h-80" }, i))) })) : !data?.items.length ? (_jsx("p", { className: "text-center text-gray-400 py-12", children: "No articles found." })) : (_jsx("div", { className: "grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6", children: data.items.map((post) => {
                    const colorClass = CATEGORY_COLORS[post.category] ?? 'bg-gray-100 text-gray-700';
                    return (_jsxs(Link, { to: `/blog/${post.slug}`, className: "group block bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition-shadow", children: [_jsx("div", { className: "overflow-hidden aspect-video", children: post.cover_image_url ? (_jsx("img", { src: post.cover_image_url, alt: post.title, className: "w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300", loading: "lazy" })) : (_jsx("div", { className: "w-full h-full bg-gray-100" })) }), _jsxs("div", { className: "p-4 sm:p-5", children: [_jsx("span", { className: `inline-block px-2.5 py-0.5 text-[11px] font-semibold rounded-full ${colorClass}`, children: post.category }), _jsx("h3", { className: "mt-2 font-semibold text-[18px] leading-snug line-clamp-2 group-hover:text-primary transition-colors", children: post.title }), _jsx("p", { className: "mt-1.5 text-[13px] text-gray-500 line-clamp-3 leading-relaxed", children: post.excerpt }), _jsx("span", { className: "mt-3 inline-block text-sm font-medium text-primary", children: "\u2014 Read More" })] })] }, post.id));
                }) }))] }));
}
