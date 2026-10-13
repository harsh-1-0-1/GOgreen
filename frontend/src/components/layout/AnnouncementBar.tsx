import { useState } from 'react';
import { Link } from 'react-router-dom';

import { useBanners } from '@/hooks/useBanners';
import { DEFAULT_SHIPPING_SETTINGS, useShippingSettings } from '@/hooks/useSettings';

const COOKIE_NAME = 'bar_dismissed';
const COOKIE_MAX_AGE = 86400;

const FALLBACK_MESSAGES = [
  {
    title: 'Free Delivery — Shop Now',
    cta_link: '',
    bg_color: '#16A34A',
    text_color: '#FFFFFF',
  },
];

function getCookie(name: string): string | undefined {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match?.[1];
}

function setCookie(name: string, value: string, maxAge: number) {
  document.cookie = `${name}=${value}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

const Separator = () => (
  <span
    className="mx-4 text-[10px] opacity-50 sm:text-xs select-none"
    aria-hidden
  >
    ✦
  </span>
);

export default function AnnouncementBar() {
  const { data: banners = [] } = useBanners('announcement');
  const { data: shippingSettings = DEFAULT_SHIPPING_SETTINGS } = useShippingSettings();
  const [visible, setVisible] = useState(
    () => getCookie(COOKIE_NAME) !== '1',
  );

  if (!visible) return null;

  const messages = banners.length > 0
    ? banners
    : [{ ...FALLBACK_MESSAGES[0], title: `Free Delivery Above ₹${shippingSettings.free_shipping_threshold} — Shop Now` }];

  function dismiss() {
    setCookie(COOKIE_NAME, '1', COOKIE_MAX_AGE);
    setVisible(false);
  }

  const barBgColor = messages[0]?.bg_color || '#16A34A';
  const barTextColor = messages[0]?.text_color || '#FFFFFF';
  const marqueeItems = Array.from({ length: 4 }, () => messages).flat();
  const messageStrip = marqueeItems.map((msg, i) => (
    <span key={`${i}-${msg.title}`} className="inline-flex items-center whitespace-nowrap">
      {msg.cta_link ? (
        <Link
          to={msg.cta_link}
          className="hover:underline underline-offset-2 transition-colors"
        >
          {msg.title}
        </Link>
      ) : (
        <span>{msg.title}</span>
      )}
      <Separator />
    </span>
  ));

  return (
    <div
      className="relative w-full h-9 sm:h-[38px] flex items-center overflow-hidden text-[11.5px] sm:text-[12.5px] font-medium tracking-[0.04em]"
      style={{ backgroundColor: barBgColor, color: barTextColor }}
    >
      <div className="animate-marquee flex w-max items-center whitespace-nowrap">
        <div className="flex shrink-0 items-center whitespace-nowrap">
          {messageStrip}
        </div>
        <div className="flex shrink-0 items-center whitespace-nowrap" aria-hidden="true">
          {messageStrip}
        </div>
      </div>

      <button
        onClick={dismiss}
        aria-label="Close announcement"
        className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 z-10 w-5 h-5 flex items-center justify-center rounded-full opacity-60 hover:opacity-100 hover:bg-white/15 transition text-sm leading-none"
      >
        ×
      </button>
    </div>
  );
}
