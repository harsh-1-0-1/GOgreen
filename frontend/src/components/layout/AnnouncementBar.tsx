import { useState } from 'react';
import { Link } from 'react-router-dom';

import { useBanners } from '@/hooks/useBanners';

const COOKIE_NAME = 'bar_dismissed';
const COOKIE_MAX_AGE = 86400;

const FALLBACK_MESSAGES = [
  { title: 'Free Delivery Above ₹499 | Shop Now', cta_link: '/products' },
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
    className="mx-4 text-white/50 text-[10px] sm:text-xs select-none"
    aria-hidden
  >
    ✦
  </span>
);

export default function AnnouncementBar() {
  const { data: banners = [] } = useBanners('announcement');
  const [visible, setVisible] = useState(
    () => getCookie(COOKIE_NAME) !== '1',
  );

  if (!visible) return null;

  const messages = banners.length > 0 ? banners : FALLBACK_MESSAGES;

  function dismiss() {
    setCookie(COOKIE_NAME, '1', COOKIE_MAX_AGE);
    setVisible(false);
  }

  const messageStrip = messages.map((msg, i) => (
    <span key={i} className="inline-flex items-center whitespace-nowrap">
      {i > 0 && <Separator />}
      <Link
        to={msg.cta_link || '/products'}
        className="hover:underline underline-offset-2 transition-colors"
      >
        {msg.title}
      </Link>
    </span>
  ));

  return (
    <div
      className="relative w-full h-9 sm:h-[38px] flex items-center overflow-hidden text-white text-[11.5px] sm:text-[12.5px] font-medium tracking-[0.04em]"
      style={{ backgroundColor: '#1B4332' }}
    >
      <div className="animate-marquee flex items-center whitespace-nowrap">
        {messageStrip}
        <Separator />
        {messageStrip}
        <Separator />
      </div>

      <button
        onClick={dismiss}
        aria-label="Close announcement"
        className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 z-10 w-5 h-5 flex items-center justify-center rounded-full text-white/60 hover:text-white hover:bg-white/15 transition-colors text-sm leading-none"
      >
        ×
      </button>
    </div>
  );
}
