import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Matches Tailwind's `sm` breakpoint — the same cutoff the storefront layouts
// use, so the wide crop kicks in exactly where the mobile one stops fitting.
const DESKTOP_MEDIA = '(min-width: 640px)';
/**
 * Renders a banner's phone-sized `image_url` and swaps in the separate wide
 * `image_url_web` crop from the `sm` breakpoint up.
 *
 * Uses `<picture>`/`<source media>` so the browser downloads only the variant it
 * is going to display — that also keeps `onLoad` firing with the real dimensions
 * of the image actually shown, which callers rely on for aspect-ratio sizing.
 *
 * Falls back to the phone image when no web image was uploaded, so banners
 * created before the web field existed keep rendering unchanged.
 */
export default function ResponsiveBannerImage({ banner, className = 'absolute inset-0 h-full w-full object-cover', loading, onLoad, onError, }) {
    const mobileSrc = banner.image_url;
    const webSrc = banner.image_url_web;
    if (!mobileSrc && !webSrc)
        return null;
    return (_jsxs("picture", { className: "absolute inset-0 block h-full w-full", children: [webSrc && _jsx("source", { media: DESKTOP_MEDIA, srcSet: webSrc }), _jsx("img", { src: mobileSrc || webSrc, alt: "", className: className, loading: loading, onLoad: onLoad, onError: onError })] }));
}
