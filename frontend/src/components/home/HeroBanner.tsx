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
      className="relative overflow-hidden min-h-[60vh] md:min-h-0 md:h-[520px] group"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* ---- Slides ---- */}
      {SLIDES.map((slide, i) => {
        const active = i === current;
        return (
          <div
            key={i}
            className={clsx(
              'absolute inset-0 transition-opacity duration-700 ease-in-out',
              active
                ? 'opacity-100 z-10'
                : 'opacity-0 z-0 pointer-events-none',
            )}
            style={{ backgroundColor: slide.bg }}
            aria-hidden={!active}
          >
            {/* Mobile background image + overlay */}
            <img
              src={slide.image}
              alt=""
              className="absolute inset-0 w-full h-full object-cover md:hidden"
              loading={i === 0 ? 'eager' : 'lazy'}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-black/20 md:hidden" />

            {/* Content wrapper */}
            <div className="relative h-full max-w-7xl mx-auto flex items-center">
              {/* ---- Text column ---- */}
              <div className="relative z-10 flex-1 px-6 md:px-12 lg:px-16 flex items-center justify-center md:justify-start py-12 md:py-0">
                <div className="text-center md:text-left max-w-md space-y-4 md:space-y-5">
                  <h2
                    className={clsx(
                      'text-3xl md:text-[48px] font-bold leading-tight',
                      slide.dark
                        ? 'text-white'
                        : 'text-white md:text-[#1B4332]',
                    )}
                  >
                    {slide.headline}
                  </h2>

                  <p
                    className={clsx(
                      'text-base md:text-lg',
                      slide.dark
                        ? 'text-white/80'
                        : 'text-white/80 md:text-gray-600',
                    )}
                  >
                    {slide.subtext}
                  </p>

                  <Link
                    to={slide.ctaLink}
                    className={clsx(
                      'inline-block px-7 py-3 rounded-full font-semibold text-sm md:text-base transition-colors shadow-lg',
                      slide.ctaClass,
                    )}
                  >
                    {slide.ctaText}
                  </Link>

                  {/* Mobile starburst — simple pill */}
                  {slide.starburst && (
                    <span className="md:hidden inline-block px-4 py-1.5 bg-accent/90 rounded-full text-xs font-bold text-[#1B4332]">
                      {slide.starburst}
                    </span>
                  )}
                </div>
              </div>

              {/* ---- Desktop image column ---- */}
              <div className="hidden md:block flex-1 h-full relative overflow-hidden">
                <img
                  src={slide.image}
                  alt={slide.headline}
                  className="w-full h-full object-cover object-center"
                  loading={i === 0 ? 'eager' : 'lazy'}
                />
              </div>

              {/* Desktop starburst — clip-path star */}
              {slide.starburst && (
                <div
                  className="absolute z-20 hidden md:flex left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[130px] h-[130px] items-center justify-center"
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
                <div className="absolute z-20 top-4 right-4 md:top-8 md:right-8 w-[76px] h-[76px] md:w-[100px] md:h-[100px] rounded-full border-[3px] border-primary bg-white/95 flex items-center justify-center text-center p-2 shadow-lg">
                  <span className="text-[8px] md:text-[10px] font-bold text-primary leading-tight">
                    {slide.trustBadge}
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* ---- Arrow buttons ---- */}
      <button
        onClick={prev}
        aria-label="Previous slide"
        className="absolute left-3 md:left-5 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center shadow-lg text-gray-700 hover:bg-white transition-all opacity-80 md:opacity-0 md:group-hover:opacity-100"
      >
        <ChevronLeft size={20} />
      </button>
      <button
        onClick={next}
        aria-label="Next slide"
        className="absolute right-3 md:right-5 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center shadow-lg text-gray-700 hover:bg-white transition-all opacity-80 md:opacity-0 md:group-hover:opacity-100"
      >
        <ChevronRight size={20} />
      </button>

      {/* ---- Dot indicators ---- */}
      <div className="absolute bottom-4 md:bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-black/20 backdrop-blur-sm rounded-full px-3 py-1.5">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            aria-label={`Go to slide ${i + 1}`}
            className={clsx(
              'rounded-full transition-all duration-300',
              i === current
                ? 'w-6 h-2.5 bg-white'
                : 'w-2.5 h-2.5 border-[1.5px] border-white/80',
            )}
          />
        ))}
      </div>
    </section>
  );
}
