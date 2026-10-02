import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useBanners } from '@/hooks/useBanners';
import { DEFAULT_SHIPPING_SETTINGS, useShippingSettings } from '@/hooks/useSettings';
const COOKIE_NAME = 'bar_dismissed';
const COOKIE_MAX_AGE = 86400;
const FALLBACK_MESSAGES = [
    { title: 'Free Delivery — Shop Now', cta_link: '' },
];
function getCookie(name) {
    const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    return match?.[1];
}
function setCookie(name, value, maxAge) {
    document.cookie = `${name}=${value}; path=/; max-age=${maxAge}; SameSite=Lax`;
}
const Separator = () => (_jsx("span", { className: "mx-4 text-white/50 text-[10px] sm:text-xs select-none", "aria-hidden": true, children: "\u2726" }));
export default function AnnouncementBar() {
    const { data: banners = [] } = useBanners('announcement');
    const { data: shippingSettings = DEFAULT_SHIPPING_SETTINGS } = useShippingSettings();
    const [visible, setVisible] = useState(() => getCookie(COOKIE_NAME) !== '1');
    if (!visible)
        return null;
    const messages = banners.length > 0
        ? banners
        : [{ ...FALLBACK_MESSAGES[0], title: `Free Delivery Above ₹${shippingSettings.free_shipping_threshold} — Shop Now` }];
    function dismiss() {
        setCookie(COOKIE_NAME, '1', COOKIE_MAX_AGE);
        setVisible(false);
    }
    const messageStrip = messages.map((msg, i) => (_jsxs("span", { className: "inline-flex items-center whitespace-nowrap", children: [i > 0 && _jsx(Separator, {}), msg.cta_link ? (_jsx(Link, { to: msg.cta_link, className: "hover:underline underline-offset-2 transition-colors", children: msg.title })) : (_jsx("span", { children: msg.title }))] }, i)));
    return (_jsxs("div", { className: "relative w-full h-9 sm:h-[38px] flex items-center overflow-hidden text-white text-[11.5px] sm:text-[12.5px] font-medium tracking-[0.04em]", style: { backgroundColor: '#16A34A' }, children: [_jsxs("div", { className: "animate-marquee flex items-center whitespace-nowrap", children: [messageStrip, _jsx(Separator, {}), messageStrip, _jsx(Separator, {})] }), _jsx("button", { onClick: dismiss, "aria-label": "Close announcement", className: "absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 z-10 w-5 h-5 flex items-center justify-center rounded-full text-white/60 hover:text-white hover:bg-white/15 transition-colors text-sm leading-none", children: "\u00D7" })] }));
}
