import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useRef } from 'react';

import { useBanners } from '@/hooks/useBanners';

export default function HappyPlanters({ fallbackImages }: { fallbackImages: string[] }) {
  const { data: banners = [] } = useBanners('happy_planters');
  const scrollerRef = useRef<HTMLDivElement>(null);

  const managedImages = banners
    .filter((banner) => banner.image_url)
    .map((banner) => ({ src: banner.image_url!, alt: '' }));
  const images = managedImages.length
    ? managedImages
    : fallbackImages.map((src, index) => ({ src, alt: `Plantoga plant ${index + 1}` }));

  if (!images.length) return null;

  const scrollLeft = () => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollBy({ left: -160 * 3, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollBy({ left: 160 * 3, behavior: 'smooth' });
    }
  };

  return (
    <section className="mt-6 sm:mt-8" aria-labelledby="happy-planters-title">
      <div className="mb-4">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">Growing together</p>
        <h2
          id="happy-planters-title"
          className="text-2xl font-bold text-gray-900 sm:text-3xl"
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
        >
          Happy Planters
        </h2>
      </div>

      {/* Outer: relative for arrow buttons, no overflow clip */}
      <div className="relative">
        <div
          ref={scrollerRef}
          className="flex gap-2 sm:gap-3 lg:gap-4 overflow-x-auto scrollbar-hide pb-2 scroll-smooth -mx-3 px-3 sm:-mx-4 sm:px-4"
        >
          {images.map((image, index) => (
            <figure
              key={`${image.src}-${index}`}
              className="relative aspect-[4/5] w-[68vw] max-w-[300px] shrink-0 overflow-hidden rounded-2xl bg-[#EAF3ED] sm:w-72 md:w-80 lg:w-[300px]"
            >
              <img
                src={image.src}
                alt={image.alt}
                className="h-full w-full object-cover transition duration-500 hover:scale-[1.03]"
                loading="lazy"
              />
            </figure>
          ))}
        </div>

        {images.length > 3 && (
          <>
            <button
              type="button"
              onClick={scrollLeft}
              aria-label="Previous images"
              className="hidden lg:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white shadow-xl items-center justify-center text-gray-700 hover:scale-110 hover:bg-gray-50 transition-all z-10"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              onClick={scrollRight}
              aria-label="Next images"
              className="hidden lg:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white shadow-xl items-center justify-center text-gray-700 hover:scale-110 hover:bg-gray-50 transition-all z-10"
            >
              <ChevronRight size={20} />
            </button>
          </>
        )}
      </div>
    </section>
  );
}
