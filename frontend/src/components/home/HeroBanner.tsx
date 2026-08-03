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

  // Reset to the first slide when the banner set changes. React docs recommend
  // adjusting state during render (guarded) instead of a synchronous setState effect.
  const [lastBanners, setLastBanners] = useState(banners);
  if (lastBanners !== banners) {
    setLastBanners(banners);
    setCurrent(0);
  }

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
      if (delta < 0) next();
      else prev();
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
          const slideInner = (
            <>
              {slide.image_url && (
                <img
                  src={slide.image_url}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover"
                  loading={i === 0 ? 'eager' : 'lazy'}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              )}

              {slide.badge_text && (
                <div
                  className="absolute z-20 hidden md:flex left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[130px] h-[130px] lg:w-[148px] lg:h-[148px] items-center justify-center drop-shadow-xl"
                  style={{
                    clipPath: STARBURST_CLIP,
                    backgroundColor: '#F4A261',
                  }}
                />
              )}
            </>
          );

          const slideStyle = { backgroundColor: slide.bg_color };

          return slide.cta_link ? (
            <Link
              key={slide.id || i}
              to={slide.cta_link}
              className="w-full shrink-0 relative overflow-hidden block"
              style={slideStyle}
              aria-hidden={i !== current}
            >
              {slideInner}
            </Link>
          ) : (
            <div
              key={slide.id || i}
              className="w-full shrink-0 relative overflow-hidden"
              style={slideStyle}
              aria-hidden={i !== current}
            >
              {slideInner}
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
