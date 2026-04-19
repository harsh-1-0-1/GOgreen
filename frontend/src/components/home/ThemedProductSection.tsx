import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ArrowRight } from 'lucide-react';
import clsx from 'clsx';
import type { Product } from '@/types';

export interface ThemedProductSectionProps {
  bgType: 'color' | 'image' | 'photo-overlay';
  bgValue: string;
  headline: string;
  subheadline?: string;
  headlineColor: string;
  products: Product[];
  cardStyle: 'discount-pill' | 'view-product' | 'grid';
  layout: 'cards-below' | 'cards-right-overlay';
}

const SERIF = "'Playfair Display', Georgia, serif";

const PRODUCT_IMAGES = [
  'https://images.unsplash.com/photo-1637967886160-fd78dc3ce3f5?w=600&h=600&fit=crop&crop=center',
  'https://images.unsplash.com/photo-1632207691143-643e2a9a9361?w=600&h=600&fit=crop&crop=center',
  'https://images.unsplash.com/photo-1459411552884-841db9b3cc2a?w=600&h=600&fit=crop&crop=center',
  'https://images.unsplash.com/photo-1509423350716-97f9360b4e09?w=600&h=600&fit=crop&crop=center',
  'https://images.unsplash.com/photo-1593482892290-f54927ae2b7a?w=600&h=600&fit=crop&crop=center',
  'https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=600&h=600&fit=crop&crop=center',
];

function getCardImage(product: Product, index: number): string {
  const src = product.images?.[0];
  if (src && !src.includes('placehold') && !src.includes('placeholder')) return src;
  return PRODUCT_IMAGES[index % PRODUCT_IMAGES.length];
}

function getDiscount(product: Product): number {
  if (product.discount_percent) return product.discount_percent;
  return [20, 25, 30, 15, 22, 18][Math.abs(product.id) % 6];
}

function ProductCard({ product, index }: { product: Product; index: number }) {
  const imgSrc = getCardImage(product, index);
  const discount = getDiscount(product);

  return (
    <Link
      to={`/products/${product.slug}`}
      className="group flex flex-col bg-white rounded-2xl overflow-hidden h-full p-3 sm:p-4"
      style={{
        boxShadow: '0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)',
      }}
    >
      <div className="relative overflow-hidden rounded-xl bg-[#f5f1ec] shrink-0 aspect-[4/3] sm:aspect-square flex items-center justify-center p-3 sm:p-4">
        <img
          src={imgSrc}
          alt={product.name}
          className="w-full h-full object-contain object-center group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />
      </div>

      <div className="pt-3 sm:pt-4 flex flex-col gap-1.5 sm:gap-2 flex-1">
        <p className="font-bold text-sm sm:text-base leading-snug line-clamp-1 text-gray-900">
          {product.name}
        </p>

        <div className="flex items-center justify-between mt-auto">
          <span
            className="inline-flex items-center gap-1 text-sm font-semibold px-3 py-1.5 rounded-full"
            style={{ backgroundColor: '#D1FAE5', color: '#065F46' }}
          >
            Get {discount}% OFF
          </span>
          <span
            className="w-8 h-8 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform"
            style={{ backgroundColor: '#059669' }}
          >
            <ArrowRight size={16} className="text-white" />
          </span>
        </div>
      </div>
    </Link>
  );
}

function useVisibleCount() {
  const getCount = () => {
    if (typeof window === 'undefined') return 3;
    if (window.innerWidth < 640) return 1;
    if (window.innerWidth < 1024) return 2;
    return 3;
  };
  const [count, setCount] = useState(getCount);
  useEffect(() => {
    const handler = () => setCount(getCount());
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return count;
}

function FullScreenCarouselLayout({
  bgValue,
  headline,
  subheadline,
  headlineColor,
  products,
}: ThemedProductSectionProps) {
  const [index, setIndex] = useState(0);
  const visibleCount = useVisibleCount();
  const maxIndex = Math.max(0, products.length - visibleCount);

  function prev() {
    setIndex((i) => (i === 0 ? maxIndex : i - 1));
  }
  function next() {
    setIndex((i) => (i >= maxIndex ? 0 : i + 1));
  }

  const dotCount = maxIndex + 1;
  const GAP = 20;

  return (
    <section className="relative w-full overflow-hidden h-dvh min-h-[640px]">
      <img
        src={bgValue}
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
        loading="lazy"
      />
      <div className="absolute inset-0 bg-black/35" />

      <div className="relative z-10 flex flex-col h-full">
        {/* Headline */}
        <div className="flex-1 flex items-center justify-center px-6 pt-6">
          <div className="text-center space-y-3 md:space-y-4 max-w-3xl">
            <h2
              className="text-5xl sm:text-6xl md:text-7xl lg:text-[80px] font-bold italic leading-[1.05]"
              style={{ fontFamily: SERIF, color: headlineColor }}
            >
              {headline}
            </h2>
            {subheadline && (
              <p className="text-xl md:text-2xl text-white/90 font-medium">
                {subheadline}
              </p>
            )}
          </div>
        </div>

        {/* Cards carousel */}
        <div className="relative px-10 sm:px-14 md:px-16 lg:px-20 pb-6 max-w-[1300px] mx-auto w-full">
          <div className="overflow-hidden">
            <div
              className="flex transition-transform duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]"
              style={{
                gap: `${GAP}px`,
                transform: `translateX(calc(-${index} * (${100 / visibleCount}% + ${GAP - (GAP / visibleCount)}px)))`,
                willChange: 'transform',
              }}
            >
              {products.map((product, i) => (
                <div
                  key={product.id}
                  className="shrink-0"
                  style={{
                    width: `calc(${100 / visibleCount}% - ${GAP * (visibleCount - 1) / visibleCount}px)`,
                  }}
                >
                  <ProductCard product={product} index={i} />
                </div>
              ))}
            </div>
          </div>

          {/* Prev */}
          <button
            onClick={prev}
            aria-label="Previous"
            className="absolute left-1 sm:left-2 md:left-4 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white shadow-xl flex items-center justify-center text-gray-700 hover:scale-110 transition-all z-20"
          >
            <ChevronLeft size={20} />
          </button>

          {/* Next */}
          <button
            onClick={next}
            aria-label="Next"
            className="absolute right-1 sm:right-2 md:right-4 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white shadow-xl flex items-center justify-center text-gray-700 hover:scale-110 transition-all z-20"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {/* Dots */}
        {dotCount > 1 && (
          <div className="flex items-center justify-center gap-2 pb-5">
            {Array.from({ length: dotCount }).map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                aria-label={`Go to slide ${i + 1}`}
                className={clsx(
                  'rounded-full transition-all duration-300',
                  i === index
                    ? 'w-6 h-2 bg-white'
                    : 'w-2 h-2 bg-white/40 hover:bg-white/70',
                )}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export default function ThemedProductSection(props: ThemedProductSectionProps) {
  if (!props.products.length) return null;
  return <FullScreenCarouselLayout {...props} />;
}
