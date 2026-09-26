import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';

import { useBanners } from '@/hooks/useBanners';
import ResponsiveBannerImage from '@/components/banner/ResponsiveBannerImage';

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
  const slides = banners;

  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const [slideRatio, setSlideRatio] = useState<number | null>(null);
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

  // Preserve the banner image's own aspect ratio so the hero is sized the same
  // on web and mobile (the admin's crop obviously stays as intended). Uses the
  // first loaded slide's ratio as the uniform height for the whole strip.
  function handleImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const img = e.currentTarget;
    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
      setSlideRatio((r) => r ?? img.naturalWidth / img.naturalHeight);
    }
  }

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

  if (slides.length === 0) return null;

  return (
<section
        className="relative w-full overflow-hidden group"
        style={
          slideRatio
            ? {
                height: 'auto',
                aspectRatio: String(slideRatio),
                minHeight: 320,
                maxHeight: 620,
              }
            : undefined
        }
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className="flex transition-transform duration-700 ease-in-out h-[340px] sm:h-[380px] md:h-[58vh] lg:h-[58vh]"
        style={{
          transform: `translateX(-${current * 100}%)`,
          ...(slideRatio ? { height: '100%' } : {}),
        }}
      >
        {slides.map((slide, i) => {
          const slideInner = <ResponsiveBannerImage banner={slide} loading={i === 0 ? 'eager' : 'lazy'} onLoad={handleImageLoad} onError={(e) => { e.currentTarget.style.display = 'none'; }} />;

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
