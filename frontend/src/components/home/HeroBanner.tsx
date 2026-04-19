import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import clsx from 'clsx';

// ---------------------------------------------------------------------------
// Slide data
// ---------------------------------------------------------------------------

interface Slide {
  bg: string;
  headline: string;
  subtext: string;
  ctaText: string;
  ctaLink: string;
  ctaClass: string;
  image: string;
  dark?: boolean;
  starburst?: string;
  trustBadge?: string;
}

const SLIDES: Slide[] = [
  {
    bg: '#F5F0E8',
    headline: 'Get your first plant set!',
    subtext: 'Handpicked plants delivered to your door',
    ctaText: 'Shop Now',
    ctaLink: '/products',
    ctaClass: 'bg-accent text-[#1B4332] hover:bg-accent/90',
    image:
      'https://images.unsplash.com/photo-1509423350716-97f9360b4e09?w=800&h=1000&fit=crop',
    starburst: '4 plants starting @₹699',
    trustBadge: 'Trusted by 10M+ Plant Parents',
  },
  {
    bg: '#E8F0E8',
    headline: 'Less care. More green.',
    subtext: 'Low-maintenance plants for your home.',
    ctaText: 'Shop Plants',
    ctaLink: '/products?category=indoor-plants',
    ctaClass: 'bg-primary text-white hover:bg-primary/90',
    image:
      'https://images.unsplash.com/photo-1545241047-6083a3684587?w=800&h=1000&fit=crop',
  },
  {
    bg: '#1B4332',
    headline: 'New to plants?',
    subtext: 'Start with the easy ones.',
    ctaText: 'See Beginner Plants',
    ctaLink: '/products?tag=beginner-friendly',
    ctaClass: 'bg-white text-[#1B4332] hover:bg-gray-100',
    image:
      'https://images.unsplash.com/photo-1622467827417-bbe2237067a9?w=800&h=1000&fit=crop',
    dark: true,
  },
];

const STARBURST_CLIP =
  'polygon(50% 0%,66% 18%,85% 5%,80% 28%,100% 35%,87% 50%,100% 65%,80% 72%,85% 95%,66% 82%,50% 100%,34% 82%,15% 95%,20% 72%,0% 65%,13% 50%,0% 35%,20% 28%,15% 5%,34% 18%)';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function HeroBanner() {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartRef = useRef(0);

  const next = useCallback(
    () => setCurrent((c) => (c + 1) % SLIDES.length),
    [],
  );

  const prev = useCallback(
    () => setCurrent((c) => (c - 1 + SLIDES.length) % SLIDES.length),
    [],
  );

  // Auto-advance every 4 s — resets whenever slide changes or pause toggles
  useEffect(() => {
    if (paused) return;
    const id = setTimeout(next, 4000);
    return () => clearTimeout(id);
  }, [paused, next, current]);

  function handleTouchStart(e: React.TouchEvent) {
    touchStartRef.current = e.touches[0].clientX;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const delta = e.changedTouches[0].clientX - touchStartRef.current;
    if (Math.abs(delta) > 50) {
      delta < 0 ? next() : prev();
    }
  }

  return (
    <section
      className="relative w-full overflow-hidden group"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* ---- Slider Track ---- */}
      <div
        className="flex transition-transform duration-700 ease-in-out"
        style={{
          transform: `translateX(-${current * 100}%)`,
          /* Ugaoo-style: approx 55vh on desktop, full on mobile */
          height: 'clamp(420px, 58vh, 680px)',
        }}
      >
        {SLIDES.map((slide, i) => {
          return (
            <div
              key={i}
              className="w-full shrink-0 relative overflow-hidden"
              style={{ backgroundColor: slide.bg }}
              aria-hidden={i !== current}
            >
              {/* Mobile: full-bleed background image + gradient overlay */}
              <img
                src={slide.image}
                alt=""
                className="absolute inset-0 w-full h-full object-cover md:hidden"
                loading={i === 0 ? 'eager' : 'lazy'}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent md:hidden" />

              {/* Content wrapper — full-width, constrained max */}
              <div className="relative h-full flex items-stretch">

                {/* ---- Text column ---- */}
                <div className="relative z-10 w-full md:w-[48%] lg:w-[44%] flex items-center px-6 sm:px-10 md:pl-12 lg:pl-20 xl:pl-28 py-10 md:py-0">
                  <div className="text-center md:text-left max-w-md w-full space-y-5 md:space-y-6">

                    {/* Offer badge (mobile only, above headline) */}
                    {slide.starburst && (
                      <div className="md:hidden">
                        <span className="inline-block px-4 py-1.5 bg-accent/90 backdrop-blur-sm rounded-full text-xs font-bold text-[#1B4332] shadow">
                          {slide.starburst}
                        </span>
                      </div>
                    )}

                    <h2
                      className={clsx(
                        'font-bold leading-[1.15] tracking-tight',
                        /* Mobile: big, Desktop: even bigger */
                        'text-[2rem] sm:text-[2.4rem] md:text-[2.8rem] lg:text-[3.2rem] xl:text-[3.6rem]',
                        slide.dark
                          ? 'text-white'
                          : 'text-white md:text-[#1B4332]',
                      )}
                    >
                      {slide.headline}
                    </h2>

                    <p
                      className={clsx(
                        'text-[15px] md:text-[16px] lg:text-[17px] leading-relaxed',
                        slide.dark
                          ? 'text-white/80'
                          : 'text-white/90 md:text-gray-500',
                      )}
                    >
                      {slide.subtext}
                    </p>

                    <div className="flex flex-col sm:flex-row items-center md:items-start gap-3">
                      <Link
                        to={slide.ctaLink}
                        className={clsx(
                          'inline-flex items-center justify-center px-8 py-3 rounded-lg font-semibold text-[14px] md:text-[15px] transition-all duration-200 shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:shadow-md',
                          slide.ctaClass,
                        )}
                      >
                        {slide.ctaText}
                      </Link>
                    </div>
                  </div>
                </div>

                {/* ---- Desktop image column ---- */}
                <div className="hidden md:block flex-1 relative overflow-hidden">
                  <img
                    src={slide.image}
                    alt={slide.headline}
                    className="w-full h-full object-cover object-center"
                    loading={i === 0 ? 'eager' : 'lazy'}
                  />
                  {/* Subtle fade from bg color on the left edge of the image */}
                  <div
                    className="absolute inset-y-0 left-0 w-24 pointer-events-none"
                    style={{
                      background: `linear-gradient(to right, ${slide.bg}, transparent)`,
                    }}
                  />
                </div>

                {/* Desktop starburst — clip-path star, positioned at the seam */}
                {slide.starburst && (
                  <div
                    className="absolute z-20 hidden md:flex left-[44%] top-1/2 -translate-x-1/2 -translate-y-1/2 w-[130px] h-[130px] lg:w-[148px] lg:h-[148px] items-center justify-center drop-shadow-xl"
                    style={{
                      clipPath: STARBURST_CLIP,
                      backgroundColor: '#F4A261',
                    }}
                  >
                    <span className="text-[11px] font-extrabold text-[#1B4332] leading-tight text-center px-5">
                      {slide.starburst}
                    </span>
                  </div>
                )}

                {/* Trust badge */}
                {slide.trustBadge && (
                  <div className="absolute z-20 top-5 right-5 md:top-8 md:right-10 w-[72px] h-[72px] md:w-[88px] md:h-[88px] lg:w-[100px] lg:h-[100px] rounded-full border-[3px] border-primary bg-white/95 flex items-center justify-center text-center p-2 shadow-[0_8px_30px_rgb(0,0,0,0.14)]">
                    <span className="text-[8px] md:text-[9px] lg:text-[10px] font-bold text-primary leading-tight">
                      {slide.trustBadge}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ---- Arrow buttons ---- */}
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

      {/* ---- Dot indicators ---- */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2">
        {SLIDES.map((_, i) => (
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
