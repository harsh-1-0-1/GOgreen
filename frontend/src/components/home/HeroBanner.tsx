import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';

import { useBanners } from '@/hooks/useBanners';
import type { Banner } from '@/types';

const FALLBACK_SLIDE: Banner = {
  id: 0,
  title: "India's favourite plant store",
  subtitle: 'Plants, seeds & pots delivered to your door',
  cta_text: 'Shop Now',
  cta_link: '/products',
  bg_color: '#2D6A4F',
  text_color: '#FFFFFF',
  image_url:
    'https://images.unsplash.com/photo-1545241047-6083a3684587?w=1400&h=600&fit=crop',
  placement: 'hero',
  position: 0,
  is_active: true,
};

const STARBURST_CLIP =
  'polygon(50% 0%,66% 18%,85% 5%,80% 28%,100% 35%,87% 50%,100% 65%,80% 72%,85% 95%,66% 82%,50% 100%,34% 82%,15% 95%,20% 72%,0% 65%,13% 50%,0% 35%,20% 28%,15% 5%,34% 18%)';

function isDarkBg(hex: string): boolean {
  const c = hex.replace('#', '');
  if (c.length !== 6) return false;
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return r * 0.299 + g * 0.587 + b * 0.114 < 128;
}

function SlidesSkeleton() {
  return (
    <section className="w-full overflow-hidden">
      <div className="animate-pulse bg-[#f0ebe3] h-[340px] sm:h-[380px] md:h-[58vh] lg:h-[58vh]">
        <div className="flex items-center h-full px-6 sm:px-10 md:pl-12 lg:pl-20 xl:pl-28">
          <div className="space-y-5 w-full max-w-md">
            <div className="h-10 w-3/4 bg-gray-300/40 rounded-lg" />
            <div className="h-5 w-1/2 bg-gray-300/30 rounded" />
            <div className="h-12 w-36 bg-gray-300/40 rounded-lg" />
          </div>
        </div>
      </div>
    </section>
  );
}

export default function HeroBanner() {
  const { data: banners = [], isLoading } = useBanners('hero');
  const slides = banners.length > 0 ? banners : [FALLBACK_SLIDE];

  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartRef = useRef(0);

  useEffect(() => {
    setCurrent(0);
  }, [banners]);

  const next = useCallback(
    () => setCurrent((c) => (c + 1) % slides.length),
    [slides.length],
  );

  const prev = useCallback(
    () => setCurrent((c) => (c - 1 + slides.length) % slides.length),
    [slides.length],
  );

  useEffect(() => {
    if (paused || slides.length <= 1) return;
    const id = setTimeout(next, 4000);
    return () => clearTimeout(id);
  }, [paused, next, current, slides.length]);

  function handleTouchStart(e: React.TouchEvent) {
    touchStartRef.current = e.touches[0].clientX;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const delta = e.changedTouches[0].clientX - touchStartRef.current;
    if (Math.abs(delta) > 50) {
      delta < 0 ? next() : prev();
    }
  }

  if (isLoading) return <SlidesSkeleton />;

  return (
    <section
      className="relative w-full overflow-hidden group"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className="flex transition-transform duration-700 ease-in-out h-[340px] sm:h-[380px] md:h-[58vh] lg:h-[58vh]"
        style={{
          transform: `translateX(-${current * 100}%)`,
        }}
      >
        {slides.map((slide, i) => {
          const dark = isDarkBg(slide.bg_color);
          const textColor = slide.text_color || (dark ? '#FFFFFF' : '#1B4332');

          return (
            <div
              key={slide.id || i}
              className="w-full shrink-0 relative overflow-hidden"
              style={{ backgroundColor: slide.bg_color }}
              aria-hidden={i !== current}
            >
              {slide.image_url && (
                <img
                  src={slide.image_url}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover md:hidden"
                  loading={i === 0 ? 'eager' : 'lazy'}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              )}
              <div className="relative h-full flex items-stretch">
                <div className="relative z-10 w-full md:w-[48%] lg:w-[44%] flex items-center px-6 sm:px-10 md:pl-12 lg:pl-20 xl:pl-28 py-10 md:py-0">
                  <div className="text-center md:text-left max-w-md w-full space-y-5 md:space-y-6">
                    {slide.title && (
                      <h2
                        className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold leading-tight"
                        style={{ color: textColor }}
                      >
                        {slide.title}
                      </h2>
                    )}
                    {slide.subtitle && (
                      <p
                        className="text-sm sm:text-base md:text-lg leading-relaxed"
                        style={{ color: textColor, opacity: 0.9 }}
                      >
                        {slide.subtitle}
                      </p>
                    )}
                    {slide.cta_text && slide.cta_link && (
                      <div className="flex flex-col sm:flex-row items-center md:items-start gap-3">
                        <Link
                          to={slide.cta_link}
                          className={clsx(
                            'inline-flex items-center justify-center px-8 py-3 rounded-lg font-semibold text-[14px] md:text-[15px] transition-all duration-200 shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:shadow-md',
                            dark
                              ? 'bg-white text-[#1B4332] hover:bg-gray-100'
                              : 'bg-accent text-[#1B4332] hover:bg-accent/90',
                          )}
                        >
                          {slide.cta_text}
                        </Link>
                      </div>
                    )}
                  </div>
                </div>

                <div className="hidden md:block flex-1 relative overflow-hidden">
                  {slide.image_url && (
                    <img
                      src={slide.image_url}
                      alt=""
                      className="w-full h-full object-cover object-center"
                      loading={i === 0 ? 'eager' : 'lazy'}
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  )}

                </div>

                {slide.badge_text && (
                  <div
                    className="absolute z-20 hidden md:flex left-[44%] top-1/2 -translate-x-1/2 -translate-y-1/2 w-[130px] h-[130px] lg:w-[148px] lg:h-[148px] items-center justify-center drop-shadow-xl"
                    style={{
                      clipPath: STARBURST_CLIP,
                      backgroundColor: '#F4A261',
                    }}
                  >
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <button
        onClick={prev}
        aria-label="Previous slide"
        className="absolute left-4 md:left-8 top-1/2 -translate-y-1/2 z-20 w-10 h-10 md:w-11 md:h-11 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-lg text-[#1B4332] hover:bg-white hover:scale-105 transition-all opacity-0 group-hover:opacity-100 duration-200"
      >
        <ChevronLeft size={22} />
      </button>
      <button
        onClick={next}
        aria-label="Next slide"
        className="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 z-20 w-10 h-10 md:w-11 md:h-11 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-lg text-[#1B4332] hover:bg-white hover:scale-105 transition-all opacity-0 group-hover:opacity-100 duration-200"
      >
        <ChevronRight size={22} />
      </button>

      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            aria-label={`Go to slide ${i + 1}`}
            className={clsx(
              'rounded-full transition-all duration-300',
              i === current
                ? 'w-7 h-2 bg-white shadow-sm'
                : 'w-2 h-2 bg-white/50 hover:bg-white/80',
            )}
          />
        ))}
      </div>
    </section>
  );
}
