import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useBanners } from '@/hooks/useBanners';

interface Tile {
  id: number;
  type: 'promo' | 'category';
  label: string;
  link?: string;
  image?: string;
  bg?: string;
  textColor?: string;
}

function QuickAccessSkeleton() {
  return (
    <section className="w-full pt-2 pb-4 sm:pt-3 sm:pb-6 relative">
      <div className="flex gap-2 sm:gap-3 lg:gap-4 overflow-x-auto scrollbar-hide px-4 sm:px-6 lg:px-10 xl:px-16 w-full pb-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="shrink-0 w-[140px] sm:w-[160px] lg:w-[180px] h-[170px] sm:h-auto aspect-[3/4] rounded-2xl bg-gray-200 animate-pulse"
          />
        ))}
      </div>
    </section>
  );
}

function PromoTile({ tile }: { tile: Tile }) {
  const className =
    'shrink-0 w-[140px] sm:w-[160px] lg:w-[180px] h-[170px] sm:h-auto aspect-[3/4] rounded-2xl flex items-center justify-center p-4 transition-all hover:scale-[1.02] shadow-sm hover:shadow-md';
  const content = (
    <span
      className="text-lg sm:text-xl lg:text-2xl font-bold italic leading-tight text-center whitespace-pre-line"
      style={{ color: tile.textColor }}
    >
      {tile.label}
    </span>
  );

  if (!tile.link) {
    return (
      <div className={className} style={{ backgroundColor: tile.bg }}>
        {content}
      </div>
    );
  }
  return (
    <Link to={tile.link} className={className} style={{ backgroundColor: tile.bg }}>
      {content}
    </Link>
  );
}

function CategoryTile({ tile }: { tile: Tile }) {
  const className =
    'group shrink-0 w-[140px] sm:w-[160px] lg:w-[180px] h-[170px] sm:h-auto aspect-[3/4] rounded-2xl overflow-hidden relative flex flex-col shadow-sm hover:shadow-md transition-all hover:scale-[1.02]';
  const content = (
    <>
      <div className="relative flex-1 min-h-0">
        <img
          src={tile.image}
          alt={tile.label}
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover"
        />
      </div>
      <div className="relative bg-white px-3 py-1 sm:py-1.5 border-t">
        <span className="text-[11px] sm:text-sm font-bold text-gray-800 leading-tight block text-center truncate">
          {tile.label}
        </span>
      </div>
    </>
  );

  if (!tile.link) {
    return <div className={className}>{content}</div>;
  }
  return (
    <Link to={tile.link} className={className}>
      {content}
    </Link>
  );
}

export default function PromotionalStrip() {
  const { data: banners = [], isLoading } = useBanners('strip');
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollLeft = () => {
    if (scrollRef.current) {
      const cardWidth = 160; // approximate card width including gap
      scrollRef.current.scrollBy({ left: -cardWidth * 3, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (scrollRef.current) {
      const cardWidth = 160; // approximate card width including gap
      scrollRef.current.scrollBy({ left: cardWidth * 3, behavior: 'smooth' });
    }
  };

  if (isLoading) return <QuickAccessSkeleton />;
  if (banners.length === 0) return null;

  const tiles: Tile[] = banners.map((b) => ({
    id: b.id,
    type: b.image_url ? 'category' : 'promo',
    label: b.title.replace('\\n', '\n'),
    link: b.cta_link || undefined,
    image: b.image_url || undefined,
    bg: b.bg_color,
    textColor: b.text_color,
  }));

  return (
    <section className="w-full pt-2 pb-4 sm:pt-3 sm:pb-6 relative">
      <div className="relative px-4 sm:px-6 lg:px-10 xl:px-16">
        <div
          ref={scrollRef}
          className="flex gap-2 sm:gap-3 lg:gap-4 overflow-x-auto scrollbar-hide w-full pb-2 scroll-smooth"
        >
          {tiles.map((tile) =>
            tile.type === 'promo' ? (
              <PromoTile key={tile.id} tile={tile} />
            ) : (
              <CategoryTile key={tile.id} tile={tile} />
            ),
          )}
        </div>
        
        {/* Scroll buttons - only show on larger screens when there are enough items */}
        {tiles.length > 5 && (
          <>
            <button
              onClick={scrollLeft}
              aria-label="Scroll left"
              className="hidden lg:flex absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white shadow-xl items-center justify-center text-gray-700 hover:scale-110 hover:bg-gray-50 transition-all z-10"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              onClick={scrollRight}
              aria-label="Scroll right"
              className="hidden lg:flex absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-white shadow-xl items-center justify-center text-gray-700 hover:scale-110 hover:bg-gray-50 transition-all z-10"
            >
              <ChevronRight size={20} />
            </button>
          </>
        )}
      </div>
    </section>
  );
}
