import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { CheckCircle2, ChevronDown, ImagePlus, Star, ThumbsUp } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCreateReview, useMarkReviewHelpful, useProductReviews } from '@/hooks/useReviews';
import { useAuthStore } from '@/store/authStore';
import { getApiErrorDetail, isUnauthorizedError } from '@/lib/apiError';
const ratingRows = [5, 4, 3, 2, 1];
function Stars({ value, size = 16 }) {
    return (_jsx("span", { className: "inline-flex items-center gap-0.5", "aria-label": `${value.toFixed(1)} out of 5 stars`, children: [1, 2, 3, 4, 5].map((star) => (_jsx(Star, { size: size, className: star <= Math.round(value) ? 'fill-[#f4b400] text-[#f4b400]' : 'fill-gray-200 text-gray-200' }, star))) }));
}
export function ProductRatingInline({ summary }) {
    if (!summary || summary.review_count === 0) {
        return _jsx("p", { className: "text-sm text-gray-500", children: "No customer reviews yet" });
    }
    return (_jsxs("a", { href: "#customer-reviews", className: "inline-flex items-center gap-2 text-sm text-primary hover:underline", children: [_jsx(Stars, { value: summary.average_rating }), _jsx("span", { className: "font-semibold text-gray-800", children: summary.average_rating.toFixed(1) }), _jsxs("span", { children: [summary.review_count, " review", summary.review_count === 1 ? '' : 's'] })] }));
}
function RatingBreakdown({ summary, activeRating, onSelect, }) {
    const total = Math.max(summary.review_count, 1);
    return (_jsx("div", { className: "mx-auto w-full max-w-[520px] space-y-2.5", children: ratingRows.map((star) => {
            const count = summary.rating_counts[star] ?? 0;
            const pct = Math.round((count / total) * 100);
            return (_jsxs("button", { type: "button", onClick: () => onSelect(activeRating === star ? undefined : star), className: `grid w-full grid-cols-[54px_minmax(0,1fr)_42px] items-center gap-2.5 rounded-md px-1.5 py-1 text-left text-[13px] font-medium transition sm:grid-cols-[62px_minmax(0,1fr)_48px] ${activeRating === star ? 'bg-primary/5 text-primary' : 'text-gray-700 hover:bg-gray-50'}`, "aria-label": `${star} star reviews, ${count} reviews`, children: [_jsxs("span", { className: "whitespace-nowrap", children: [star, " star"] }), _jsx("span", { className: "h-3 overflow-hidden rounded-full bg-[#eeeeee]", children: _jsx("span", { className: "block h-full rounded-full bg-[#f4b400] transition-all duration-500", style: { width: `${pct}%` } }) }), _jsx("span", { className: "text-right text-gray-500", children: count })] }, star));
        }) }));
}
function FieldLabel({ htmlFor, children }) {
    return (_jsx("label", { htmlFor: htmlFor, className: "block text-center text-sm font-semibold text-gray-900", children: children }));
}
function formatDate(value) {
    return new Intl.DateTimeFormat('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    }).format(new Date(value));
}
function extractYouTubeId(url) {
    if (!url)
        return null;
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
        /^([a-zA-Z0-9_-]{11})$/,
    ];
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match)
            return match[1];
    }
    return null;
}
function isVideoFile(url) {
    if (!url)
        return false;
    return /\.(mp4|webm|mov)$/i.test(url);
}
export default function ProductReviews({ productId }) {
    const [sortBy, setSortBy] = useState('newest');
    const [ratingFilter, setRatingFilter] = useState();
    const [page, setPage] = useState(1);
    const [isWriting, setIsWriting] = useState(false);
    const [rating, setRating] = useState(5);
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [email, setEmail] = useState('');
    const [youtubeUrl, setYoutubeUrl] = useState('');
    const [mediaFile, setMediaFile] = useState(null);
    const [mediaName, setMediaName] = useState('');
    const { openAuthModal } = useAuthStore();
    const { data, isLoading } = useProductReviews(productId, {
        page,
        limit: 8,
        sort_by: sortBy,
        rating: ratingFilter,
    });
    const createReview = useCreateReview(productId);
    const helpful = useMarkReviewHelpful(productId);
    const summary = data?.summary ?? { average_rating: 0, review_count: 0, rating_counts: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };
    const reviewsLabel = `${summary.review_count} review${summary.review_count === 1 ? '' : 's'}`;
    const sortedTitle = useMemo(() => {
        if (sortBy === 'highest')
            return 'Highest Rating';
        if (sortBy === 'lowest')
            return 'Lowest Rating';
        return 'Most Recent';
    }, [sortBy]);
    async function handleSubmit(e) {
        e.preventDefault();
        if (!title.trim()) {
            toast.error('Review Title is required');
            return;
        }
        if (!body.trim()) {
            toast.error('Review Content is required');
            return;
        }
        if (!displayName.trim()) {
            toast.error('Display Name is required');
            return;
        }
        if (!email.trim()) {
            toast.error('Email Address is required');
            return;
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            toast.error('Please enter a valid email address');
            return;
        }
        try {
            await createReview.mutateAsync({
                rating,
                title: title.trim() || undefined,
                body: body.trim() || undefined,
                author_name: displayName.trim() || undefined,
                youtube_url: youtubeUrl.trim() || undefined,
                media: mediaFile || undefined,
            });
            setTitle('');
            setBody('');
            setDisplayName('');
            setEmail('');
            setYoutubeUrl('');
            setMediaFile(null);
            setMediaName('');
            setRating(5);
            setIsWriting(false);
            toast.success('Review submitted');
        }
        catch (err) {
            toast.error(getApiErrorDetail(err, 'Could not submit review'));
        }
    }
    function handleMediaChange(e) {
        const file = e.target.files?.[0];
        if (file) {
            setMediaFile(file);
            setMediaName(file.name);
        }
        else {
            setMediaFile(null);
            setMediaName('');
        }
    }
    async function markHelpful(reviewId) {
        try {
            await helpful.mutateAsync(reviewId);
        }
        catch (err) {
            if (isUnauthorizedError(err))
                openAuthModal();
            else
                toast.error(getApiErrorDetail(err, 'Could not mark helpful'));
        }
    }
    return (_jsx("section", { id: "customer-reviews", className: "mt-8 sm:mt-10 border-t border-gray-100 pt-8 sm:pt-10", children: _jsxs("div", { className: "mx-auto w-full max-w-5xl px-0 text-center", children: [_jsxs("div", { className: "mx-auto max-w-2xl", children: [_jsx("h2", { className: "text-2xl font-bold tracking-normal text-gray-950 sm:text-3xl", children: "Customer Reviews" }), _jsxs("div", { className: "mt-5 flex flex-col items-center gap-2", children: [_jsx(Stars, { value: summary.average_rating, size: 24 }), _jsx("p", { className: "text-4xl font-bold leading-none text-gray-950 sm:text-5xl", children: summary.average_rating.toFixed(1) }), _jsxs("p", { className: "text-sm font-medium text-gray-500", children: ["Based on ", reviewsLabel] })] })] }), _jsx("div", { className: "mt-7 sm:mt-8", children: _jsx(RatingBreakdown, { summary: summary, activeRating: ratingFilter, onSelect: (nextRating) => {
                            setRatingFilter(nextRating);
                            setPage(1);
                        } }) }), _jsx("button", { type: "button", onClick: () => setIsWriting((value) => !value), className: "mt-8 inline-flex min-h-12 w-full max-w-[300px] items-center justify-center rounded-full bg-gray-950 px-8 py-3 text-sm font-bold text-white transition duration-200 hover:bg-primary focus:outline-none focus:ring-4 focus:ring-primary/20 sm:min-h-14 sm:text-base", "aria-expanded": isWriting, children: isWriting ? 'Cancel Review' : 'Write a Review' }), _jsx("div", { className: `grid transition-all duration-500 ease-out ${isWriting ? 'mt-8 grid-rows-[1fr] opacity-100' : 'mt-0 grid-rows-[0fr] opacity-0'}`, children: _jsx("div", { className: "overflow-hidden", children: _jsxs("form", { onSubmit: handleSubmit, className: "mx-auto w-full max-w-2xl space-y-5 rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-7", children: [_jsxs("div", { className: "space-y-2.5", children: [_jsx(FieldLabel, { children: "Rating Stars" }), _jsx("div", { className: "flex justify-center gap-1.5", children: [1, 2, 3, 4, 5].map((star) => (_jsx("button", { type: "button", onClick: () => setRating(star), className: "rounded-full p-1.5 transition hover:bg-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-300", "aria-label": `Rate ${star} stars`, children: _jsx(Star, { size: 34, className: star <= rating ? 'fill-[#f4b400] text-[#f4b400]' : 'fill-gray-200 text-gray-200' }) }, star))) })] }), _jsxs("div", { className: "space-y-2.5", children: [_jsx(FieldLabel, { htmlFor: "review-title", children: "Review Title *" }), _jsx("input", { id: "review-title", value: title, onChange: (e) => setTitle(e.target.value), maxLength: 140, placeholder: "Give your review a title", required: true, className: "min-h-12 w-full rounded-lg border border-gray-200 bg-white px-4 text-center text-base text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-primary focus:ring-4 focus:ring-primary/10" })] }), _jsxs("div", { className: "space-y-2.5", children: [_jsx(FieldLabel, { htmlFor: "review-body", children: "Review Content *" }), _jsx("textarea", { id: "review-body", value: body, onChange: (e) => setBody(e.target.value), maxLength: 4000, rows: 5, placeholder: "Share your experience with this product", required: true, className: "w-full resize-none rounded-lg border border-gray-200 bg-white px-4 py-3 text-center text-base leading-relaxed text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-primary focus:ring-4 focus:ring-primary/10" })] }), _jsxs("div", { className: "space-y-2.5", children: [_jsx(FieldLabel, { htmlFor: "review-media", children: "Picture/Video Upload" }), _jsxs("label", { htmlFor: "review-media", className: "flex min-h-14 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 text-sm font-semibold text-gray-600 transition hover:border-primary hover:bg-primary/5", children: [_jsx(ImagePlus, { size: 18 }), _jsx("span", { className: "max-w-full truncate", children: mediaName || 'Choose picture or video' })] }), _jsx("input", { id: "review-media", type: "file", accept: "image/*,video/*", onChange: handleMediaChange, className: "sr-only" })] }), _jsxs("div", { className: "space-y-2.5", children: [_jsx(FieldLabel, { htmlFor: "review-youtube", children: "YouTube URL" }), _jsx("input", { id: "review-youtube", type: "url", value: youtubeUrl, onChange: (e) => setYoutubeUrl(e.target.value), placeholder: "https://youtube.com/watch?v=...", className: "min-h-12 w-full rounded-lg border border-gray-200 bg-white px-4 text-center text-base text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-primary focus:ring-4 focus:ring-primary/10" })] }), _jsxs("div", { className: "grid gap-5 sm:grid-cols-2", children: [_jsxs("div", { className: "space-y-2.5", children: [_jsx(FieldLabel, { htmlFor: "review-name", children: "Display Name *" }), _jsx("input", { id: "review-name", value: displayName, onChange: (e) => setDisplayName(e.target.value), maxLength: 255, placeholder: "Your name", required: true, className: "min-h-12 w-full rounded-lg border border-gray-200 bg-white px-4 text-center text-base text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-primary focus:ring-4 focus:ring-primary/10" })] }), _jsxs("div", { className: "space-y-2.5", children: [_jsx(FieldLabel, { htmlFor: "review-email", children: "Email Address *" }), _jsx("input", { id: "review-email", type: "email", value: email, onChange: (e) => setEmail(e.target.value), placeholder: "you@example.com", required: true, className: "min-h-12 w-full rounded-lg border border-gray-200 bg-white px-4 text-center text-base text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-primary focus:ring-4 focus:ring-primary/10" })] })] }), _jsx("button", { type: "submit", disabled: createReview.isPending, className: "min-h-12 w-full rounded-full bg-primary px-6 py-3 text-base font-bold text-white transition hover:bg-primary/90 focus:outline-none focus:ring-4 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60", children: createReview.isPending ? 'Submitting...' : 'Submit Review' })] }) }) }), _jsxs("div", { className: "mt-10 border-t border-gray-100 pt-8 text-left sm:mt-12 sm:pt-10", children: [_jsxs("div", { className: "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-xl font-bold text-gray-950", children: "Reviews" }), _jsxs("p", { className: "mt-1 text-sm text-gray-500", children: ["Showing ", sortedTitle.toLowerCase(), " reviews", ratingFilter ? ` filtered by ${ratingFilter} star` : ''] })] }), _jsxs("div", { className: "relative w-full sm:w-56", children: [_jsxs("select", { value: sortBy, onChange: (e) => {
                                                setSortBy(e.target.value);
                                                setPage(1);
                                            }, className: "min-h-12 w-full appearance-none rounded-full border border-gray-200 bg-white px-4 pr-10 text-sm font-semibold text-gray-800 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10", "aria-label": "Sort reviews", children: [_jsx("option", { value: "newest", children: "Most Recent" }), _jsx("option", { value: "highest", children: "Highest Rating" }), _jsx("option", { value: "lowest", children: "Lowest Rating" })] }), _jsx(ChevronDown, { size: 18, className: "pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-500" })] })] }), ratingFilter && (_jsxs("button", { type: "button", onClick: () => {
                                setRatingFilter(undefined);
                                setPage(1);
                            }, className: "mt-4 text-sm font-semibold text-primary hover:underline", children: ["Clear ", ratingFilter, "-star filter"] })), isLoading ? (_jsx("div", { className: "mt-5 grid gap-4", children: Array.from({ length: 3 }).map((_, i) => (_jsx("div", { className: "h-36 animate-pulse rounded-lg bg-gray-100" }, i))) })) : data?.items.length ? (_jsxs("div", { className: "mt-5 grid gap-4", children: [data.items.map((review) => (_jsxs("article", { className: "rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-5", children: [_jsxs("div", { className: "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between", children: [_jsxs("div", { className: "flex min-w-0 items-center gap-3", children: [_jsx("div", { className: "grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-bold text-primary", children: review.author_name.charAt(0).toUpperCase() }), _jsxs("div", { className: "min-w-0", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx("p", { className: "truncate text-sm font-bold text-gray-950", children: review.author_name }), review.is_verified_purchase && (_jsxs("span", { className: "inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700", children: [_jsx(CheckCircle2, { size: 12 }), " Verified"] }))] }), _jsx("p", { className: "mt-0.5 text-xs font-medium text-gray-500", children: formatDate(review.created_at) })] })] }), _jsx(Stars, { value: review.rating })] }), review.title && _jsx("h4", { className: "mt-4 text-base font-bold text-gray-950", children: review.title }), review.body && _jsx("p", { className: "mt-2 text-sm leading-6 text-gray-700", children: review.body }), review.media_url && (_jsx("div", { className: "mt-4", children: isVideoFile(review.media_url) ? (_jsx("video", { src: review.media_url, controls: true, className: "max-h-80 w-full rounded-lg border border-gray-200 object-contain", children: "Your browser does not support the video tag." })) : (_jsx("img", { src: review.media_url, alt: "Review media", className: "max-h-80 w-full rounded-lg border border-gray-200 object-contain" })) })), review.youtube_url && extractYouTubeId(review.youtube_url) && (_jsx("div", { className: "mt-4", children: _jsx("div", { className: "relative aspect-video w-full overflow-hidden rounded-lg border border-gray-200", children: _jsx("iframe", { src: `https://www.youtube.com/embed/${extractYouTubeId(review.youtube_url)}`, title: "YouTube video player", allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture", allowFullScreen: true, className: "absolute inset-0 h-full w-full" }) }) })), _jsxs("button", { type: "button", onClick: () => markHelpful(review.id), className: "mt-4 inline-flex min-h-9 items-center gap-1.5 rounded-full border border-gray-200 px-3 text-xs font-bold text-gray-600 transition hover:border-primary hover:text-primary focus:outline-none focus:ring-4 focus:ring-primary/10", children: [_jsx(ThumbsUp, { size: 14 }), "Helpful (", review.helpful_count, ")"] })] }, review.id))), data.pages > 1 && (_jsxs("div", { className: "flex flex-col items-center justify-between gap-3 pt-2 sm:flex-row", children: [_jsx("button", { type: "button", disabled: page <= 1, onClick: () => setPage((p) => Math.max(1, p - 1)), className: "min-h-11 w-full rounded-full border border-gray-200 px-5 text-sm font-bold text-gray-700 transition hover:border-primary hover:text-primary disabled:opacity-40 sm:w-auto", children: "Previous" }), _jsxs("span", { className: "text-sm font-medium text-gray-500", children: ["Page ", data.page, " of ", data.pages] }), _jsx("button", { type: "button", disabled: page >= data.pages, onClick: () => setPage((p) => Math.min(data.pages, p + 1)), className: "min-h-11 w-full rounded-full border border-gray-200 px-5 text-sm font-bold text-gray-700 transition hover:border-primary hover:text-primary disabled:opacity-40 sm:w-auto", children: "Next" })] }))] })) : (_jsxs("div", { className: "mt-5 rounded-lg border border-dashed border-gray-200 bg-gray-50 p-8 text-center", children: [_jsx("p", { className: "font-bold text-gray-900", children: "No reviews yet" }), _jsx("p", { className: "mt-1 text-sm text-gray-500", children: "Be the first to share your experience with this product." })] }))] })] }) }));
}
