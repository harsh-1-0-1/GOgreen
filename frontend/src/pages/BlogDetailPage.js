import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link, useParams } from 'react-router-dom';
import Markdown from 'react-markdown';
import { ArrowLeft } from 'lucide-react';
import { useBlogPost, useBlogPosts } from '@/hooks/useBlog';
const CATEGORY_COLORS = {
    GROW: 'bg-green-100 text-green-700',
    CARE: 'bg-blue-100 text-blue-700',
    DIY: 'bg-amber-100 text-amber-700',
    TIPS: 'bg-purple-100 text-purple-700',
};
export default function BlogDetailPage() {
    const { slug } = useParams();
    const { data: post, isLoading, error } = useBlogPost(slug ?? '');
    const { data: related } = useBlogPosts({
        category: post?.category,
        limit: 4,
    });
    if (isLoading) {
        return (_jsx("div", { className: "max-w-4xl mx-auto px-3 sm:px-4 py-10", children: _jsxs("div", { className: "animate-pulse space-y-4", children: [_jsx("div", { className: "bg-gray-200 rounded-2xl h-64 sm:h-96" }), _jsx("div", { className: "bg-gray-200 h-8 w-3/4 rounded" }), _jsx("div", { className: "bg-gray-200 h-4 w-1/2 rounded" }), _jsx("div", { className: "space-y-2 mt-8", children: Array.from({ length: 8 }).map((_, i) => (_jsx("div", { className: "bg-gray-100 h-4 rounded" }, i))) })] }) }));
    }
    if (error || !post) {
        return (_jsxs("div", { className: "max-w-4xl mx-auto px-4 py-20 text-center", children: [_jsx("h2", { className: "text-xl font-semibold text-gray-600 mb-2", children: "Article not found" }), _jsx(Link, { to: "/blog", className: "text-primary hover:underline text-sm", children: "Back to Blog" })] }));
    }
    const colorClass = CATEGORY_COLORS[post.category] ?? 'bg-gray-100 text-gray-700';
    const date = post.published_at
        ? new Date(post.published_at).toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        })
        : '';
    const relatedPosts = related?.items.filter((p) => p.slug !== post.slug).slice(0, 3) ?? [];
    return (_jsxs("article", { children: [_jsx("div", { className: "w-full h-64 sm:h-[400px] relative", children: post.cover_image_url ? (_jsx("img", { src: post.cover_image_url, alt: post.title, className: "w-full h-full object-cover" })) : (_jsx("div", { className: "w-full h-full bg-gray-100" })) }), _jsx("div", { className: "max-w-3xl mx-auto px-3 sm:px-4 -mt-16 relative z-10", children: _jsxs("div", { className: "bg-white rounded-2xl p-5 sm:p-8 shadow-lg", children: [_jsxs(Link, { to: "/blog", className: "inline-flex items-center gap-1 text-sm text-gray-500 hover:text-primary mb-4", children: [_jsx(ArrowLeft, { size: 16 }), " Back to Blog"] }), _jsxs("div", { className: "flex items-center gap-3 mb-3 flex-wrap", children: [_jsx("span", { className: `px-2.5 py-0.5 text-[11px] font-semibold rounded-full ${colorClass}`, children: post.category }), date && _jsx("span", { className: "text-xs text-gray-400", children: date }), _jsxs("span", { className: "text-xs text-gray-400", children: ["by ", post.author_name] })] }), _jsx("h1", { className: "text-2xl sm:text-3xl font-bold leading-tight mb-6", children: post.title }), _jsx("div", { className: "prose prose-green max-w-none prose-headings:font-bold prose-h2:text-xl prose-h3:text-lg prose-p:text-gray-600 prose-p:leading-relaxed prose-li:text-gray-600 prose-table:text-sm prose-img:rounded-xl", children: _jsx(Markdown, { children: post.content }) })] }) }), relatedPosts.length > 0 && (_jsxs("section", { className: "max-w-7xl mx-auto px-3 sm:px-4 py-10 sm:py-16", children: [_jsx("h2", { className: "text-xl sm:text-2xl font-bold mb-6", children: "Related Articles" }), _jsx("div", { className: "grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6", children: relatedPosts.map((rp) => {
                            const rpColor = CATEGORY_COLORS[rp.category] ?? 'bg-gray-100 text-gray-700';
                            return (_jsxs(Link, { to: `/blog/${rp.slug}`, className: "group block bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition-shadow", children: [_jsx("div", { className: "overflow-hidden aspect-video", children: rp.cover_image_url ? (_jsx("img", { src: rp.cover_image_url, alt: rp.title, className: "w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300", loading: "lazy" })) : (_jsx("div", { className: "w-full h-full bg-gray-100" })) }), _jsxs("div", { className: "p-4", children: [_jsx("span", { className: `inline-block px-2.5 py-0.5 text-[11px] font-semibold rounded-full ${rpColor}`, children: rp.category }), _jsx("h3", { className: "mt-2 font-semibold text-base leading-snug line-clamp-2 group-hover:text-primary transition-colors", children: rp.title }), _jsx("span", { className: "mt-2 inline-block text-sm font-medium text-primary", children: "\u2014 Read More" })] })] }, rp.id));
                        }) })] }))] }));
}
