import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useRef, useEffect } from 'react';
import { StoryViewer } from './StoryViewer';
function StoryCard({ story, onClick }) {
    const videoRef = useRef(null);
    useEffect(() => {
        const video = videoRef.current;
        if (!video)
            return;
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    video.play().catch(() => {
                        // Autoplay might be blocked by browser policy, ignore quietly
                    });
                }
                else {
                    video.pause();
                }
            });
        }, { threshold: 0.5 } // Play when at least 50% visible
        );
        observer.observe(video);
        return () => {
            observer.unobserve(video);
            observer.disconnect();
        };
    }, []);
    return (_jsxs("button", { className: "relative shrink-0 w-44 h-72 rounded-2xl overflow-hidden snap-start group shadow-md", onClick: onClick, children: [_jsx("div", { className: "absolute inset-0 bg-black/20 z-10 group-hover:bg-black/10 transition-colors" }), _jsx("video", { ref: videoRef, src: story.video, poster: story.thumbnail || undefined, muted: true, loop: true, playsInline: true, className: "w-full h-full object-cover" }), story.caption && !story.linked_product && (_jsx("div", { className: "absolute bottom-4 left-3 right-3 z-20 text-white font-medium text-sm text-left drop-shadow-md", children: story.caption })), story.linked_product && (_jsxs("div", { className: "absolute bottom-3 left-3 right-3 bg-white/95 backdrop-blur-sm rounded-xl p-2 flex items-center gap-2 z-20 shadow-lg group-hover:-translate-y-1 transition-transform", children: [story.linked_product.thumbnail && (_jsx("img", { src: story.linked_product.thumbnail, className: "w-9 h-9 rounded-lg object-cover bg-gray-100 shrink-0", alt: story.linked_product.name })), _jsxs("div", { className: "flex-1 min-w-0 text-left", children: [_jsx("div", { className: "font-semibold text-gray-900 text-[11px] truncate", children: story.linked_product.name }), _jsxs("div", { className: "font-bold text-green-800 text-[11px]", children: ["\u20B9", story.linked_product.price] })] })] }))] }));
}
export function StoriesCarousel({ stories }) {
    const [activeIndex, setActiveIndex] = useState(null);
    if (!stories || stories.length === 0)
        return null;
    return (_jsxs("div", { className: "mt-8 sm:mt-10", children: [_jsx("div", { className: "flex items-center justify-between mb-6", children: _jsx("h2", { className: "text-2xl font-serif text-green-900", children: "Stories Across India." }) }), _jsx("div", { className: "flex gap-4 overflow-x-auto snap-x pb-4 scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0", children: stories.map((story, i) => (_jsx(StoryCard, { story: story, onClick: () => setActiveIndex(i) }, story.id))) }), activeIndex !== null && (_jsx(StoryViewer, { stories: stories, startIndex: activeIndex, onClose: () => setActiveIndex(null) }))] }));
}
