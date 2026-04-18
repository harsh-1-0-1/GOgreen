import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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

const TAG_CONFIG: { key: string; label: string; bg: string; text: string }[] = [
  { key: 'medicinal', label: 'Reduces Stress Levels', bg: '#E8F5E9', text: '#2E7D32' },
  { key: 'air-purifying', label: 'Cleans Air', bg: '#E3F2FD', text: '#1565C0' },
  { key: 'beginner-friendly', label: 'Easy Care Bundle', bg: '#FFF3E0', text: '#E65100' },
  { key: 'low-maintenance', label: 'Easy to Maintain', bg: '#F3E5F5', text: '#7B1FA2' },
  { key: 'pet-safe', label: 'Pet Friendly', bg: '#E0F7FA', text: '#00838F' },
  { key: 'bedroom', label: 'Perfect for Bedroom', bg: '#FCE4EC', text: '#C62828' },
];

const FALLBACK_TAGS = [
  { label: 'Reduces Stress Levels', bg: '#E8F5E9', text: '#2E7D32' },
  { label: 'Cleans Air', bg: '#E3F2FD', text: '#1565C0' },
  { label: 'Easy Care Bundle', bg: '#FFF3E0', text: '#E65100' },
];

function getTagStyle(product: Product, index: number) {
  for (const cfg of TAG_CONFIG) {
    if (product.tags?.includes(cfg.key)) {
      return { label: cfg.label, bg: cfg.bg, text: cfg.text };
    }
  }
  return FALLBACK_TAGS[index % FALLBACK_TAGS.length];
}

function getDiscountPercent(product: Product): number {
  if (!product.original_price || product.original_price <= product.price) return 0;
  return Math.round(
    ((product.original_price - product.price) / product.original_price) * 100,
  );
}

const PLACEHOLDER = 'https://placehold.co/300x400?text=Plant';

// ---------------------------------------------------------------------------
// Card: Discount Pill (for "Less care. More green.")
// ---------------------------------------------------------------------------

function DiscountPillCard({ product }: { product: Product }) {
  const discount = getDiscountPercent(product);
  return (
    <Link
      to={`/products/${product.slug}`}
      className="shrink-0 w-[200px] sm:w-[220px] md:w-[240px] h-[300px] md:h-[340px] rounded-2xl overflow-hidden relative group"
    >
      <img
        src={product.images?.[0] || PLACEHOLDER}
        alt={product.name}
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        loading="lazy"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-4 space-y-2">
        <p className="text-white font-semibold text-sm leading-snug drop-shadow">
          {product.name}
        </p>
        {discount > 0 && (
          <span className="inline-block px-3 py-1.5 bg-[#5DCAA5] text-[#0B3D2E] text-xs font-bold rounded-full">
            Get {discount}% OFF →
          </span>
        )}
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Card: Grid (for "Plant care made simple")
// ---------------------------------------------------------------------------

function GridCard({ product }: { product: Product }) {
  return (
    <Link to={`/products/${product.slug}`} className="group text-center">
      <div className="aspect-square rounded-xl overflow-hidden bg-white/10 mb-3">
        <img
          src={product.images?.[0] || PLACEHOLDER}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />
      </div>
      <p className="text-white font-medium text-sm">{product.name}</p>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Card: View Product (for "New to plants?") — compact, horizontal 3-up
// ---------------------------------------------------------------------------

function ViewProductCard({
  product,
  index,
}: {
  product: Product;
  index: number;
}) {
  const tag = getTagStyle(product, index);
  return (
    <Link
      to={`/products/${product.slug}`}
      className="flex flex-col bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-lg transition-shadow min-w-0"
    >
      <div className="px-3 pt-3">
        <span
          className="inline-block px-2.5 py-1 text-[11px] font-bold rounded-full"
          style={{ backgroundColor: tag.bg, color: tag.text }}
        >
          {tag.label}
        </span>
      </div>
      <div className="flex-1 flex items-center justify-center p-2">
        <img
          src={product.images?.[0] || PLACEHOLDER}
          alt={product.name}
          className="w-full h-48 sm:h-56 md:h-64 object-contain"
          loading="lazy"
        />
      </div>
      <div className="px-4 pb-4 space-y-1.5">
        <p className="font-bold text-[15px] leading-snug line-clamp-2">
          {product.name}
        </p>
        <p className="text-xs text-gray-400">Delivers in 48 hrs</p>
        <span className="block w-full text-center py-2.5 bg-[#2E7D32] text-white text-sm font-semibold rounded-full">
          View Product
        </span>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Headline
// ---------------------------------------------------------------------------

function SectionHeadline({
  headline,
  subheadline,
  headlineColor,
  centered,
}: {
  headline: string;
  subheadline?: string;
  headlineColor: string;
  centered?: boolean;
}) {
  return (
    <div
      className={clsx(
        'space-y-2 md:space-y-3',
        centered && 'max-w-2xl mx-auto text-center',
      )}
    >
      <h2
        className="text-3xl md:text-4xl lg:text-5xl font-bold italic leading-tight"
        style={{ fontFamily: SERIF, color: headlineColor }}
      >
        {headline}
      </h2>
      {subheadline && (
        <p className="text-base md:text-lg text-white/80">{subheadline}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Layout: cards-below
// ---------------------------------------------------------------------------

function CardsBelowLayout({
  bgType,
  bgValue,
  headline,
  subheadline,
  headlineColor,
  products,
  cardStyle,
}: ThemedProductSectionProps) {
  const isImage = bgType === 'image';
  const isPhotoOverlay = bgType === 'photo-overlay';
  const isGrid = cardStyle === 'grid';

  return (
    <section className="relative overflow-hidden">
      {isPhotoOverlay && (
        <>
          <div className="absolute inset-0" style={{ backgroundColor: bgValue }} />
          <div
            className="absolute inset-0 opacity-[0.12] bg-cover bg-center blur-sm"
            style={{
              backgroundImage:
                "url('https://images.unsplash.com/photo-1459411552884-841db9b3cc2a?w=1400&q=60')",
            }}
          />
        </>
      )}
      {isImage && (
        <>
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url('${bgValue}')` }}
          />
          <div className="absolute inset-0 bg-black/60" />
        </>
      )}
      {bgType === 'color' && (
        <div className="absolute inset-0" style={{ backgroundColor: bgValue }} />
      )}

      <div
        className={clsx(
          'relative z-10 py-12 md:py-16',
          isImage && 'text-center',
        )}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-8 md:space-y-10">
          <SectionHeadline
            headline={headline}
            subheadline={subheadline}
            headlineColor={headlineColor}
            centered={isImage}
          />

          {isGrid ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              {products.map((p) => (
                <GridCard key={p.id} product={p} />
              ))}
            </div>
          ) : (
            <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2 -mx-4 sm:-mx-6 px-4 sm:px-6">
              {products.map((p) => (
                <DiscountPillCard key={p.id} product={p} />
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Layout: cards-right-overlay — full background image, content floats on top
// ---------------------------------------------------------------------------

function RightOverlayLayout({
  bgValue,
  headline,
  subheadline,
  headlineColor,
  products,
}: ThemedProductSectionProps) {
  const PAGE_SIZE = 3;
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(products.length / PAGE_SIZE));
  const visible = products.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  function next() {
    setPage((p) => (p + 1) % totalPages);
  }
  function prev() {
    setPage((p) => (p - 1 + totalPages) % totalPages);
  }

  return (
    <section className="relative overflow-hidden min-h-[600px] md:min-h-[75vh]">
      {/* Full-width background image */}
      <img
        src={bgValue}
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
        loading="lazy"
      />
      <div className="absolute inset-0 bg-black/40" />

      {/* Content overlay */}
      <div className="relative z-10 h-full min-h-[600px] md:min-h-[75vh] flex flex-col md:flex-row items-center">
        {/* Left: headline */}
        <div className="md:w-[40%] p-6 md:p-10 lg:p-14 flex items-center">
          <div className="space-y-3 md:space-y-4">
            <h2
              className="text-4xl md:text-5xl lg:text-[60px] font-bold italic leading-[1.05]"
              style={{ fontFamily: SERIF, color: headlineColor }}
            >
              {headline}
            </h2>
            {subheadline && (
              <p className="text-lg md:text-xl text-white/90 font-medium">
                {subheadline}
              </p>
            )}
          </div>
        </div>

        {/* Right: 3 product cards over the background */}
        <div className="md:w-[60%] p-4 sm:p-6 md:p-8 lg:p-10 relative flex flex-col justify-center">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 relative">
            {visible.map((product, i) => (
              <ViewProductCard key={product.id} product={product} index={page * PAGE_SIZE + i} />
            ))}
          </div>

          {/* Arrows */}
          <button
            onClick={prev}
            aria-label="Previous"
            className="absolute left-0 sm:-left-1 top-1/2 -translate-y-1/2 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/90 shadow-lg flex items-center justify-center text-gray-700 hover:bg-white transition z-20"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={next}
            aria-label="Next"
            className="absolute right-0 sm:-right-1 top-1/2 -translate-y-1/2 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/90 shadow-lg flex items-center justify-center text-gray-700 hover:bg-white transition z-20"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export default function ThemedProductSection(props: ThemedProductSectionProps) {
  if (!props.products.length) return null;

  if (props.layout === 'cards-right-overlay') {
    return <RightOverlayLayout {...props} />;
  }
  return <CardsBelowLayout {...props} />;
}
