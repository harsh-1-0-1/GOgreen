import { Link } from 'react-router-dom';

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
    <section className="w-full py-4 sm:py-6">
      <div className="flex gap-2 sm:gap-3 lg:gap-4 overflow-x-auto scrollbar-hide px-4 sm:px-6 lg:px-10 xl:px-16 w-full pb-2 lg:pb-0">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="shrink-0 w-[140px] sm:w-[160px] lg:w-auto lg:flex-1 aspect-[3/4] rounded-2xl bg-gray-200 animate-pulse"
          />
        ))}
      </div>
    </section>
  );
}

function PromoTile({ tile }: { tile: Tile }) {
  const className =
    'shrink-0 lg:shrink lg:flex-1 w-[140px] sm:w-[160px] lg:w-auto aspect-[3/4] rounded-2xl flex items-center justify-center p-4 transition-all hover:scale-[1.02] shadow-sm hover:shadow-md';
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
    'group shrink-0 lg:shrink lg:flex-1 w-[140px] sm:w-[160px] lg:w-auto aspect-[3/4] rounded-2xl overflow-hidden relative flex flex-col shadow-sm hover:shadow-md transition-all hover:scale-[1.02]';
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

export default function QuickAccessStrip() {
  const { data: banners = [], isLoading } = useBanners('strip');

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
    <section className="w-full py-4 sm:py-6">
      <div className="flex gap-2 sm:gap-3 lg:gap-4 overflow-x-auto lg:overflow-visible scrollbar-hide px-4 sm:px-6 lg:px-10 xl:px-16 w-full pb-2 lg:pb-0">
        {tiles.map((tile) =>
          tile.type === 'promo' ? (
            <PromoTile key={tile.id} tile={tile} />
          ) : (
            <CategoryTile key={tile.id} tile={tile} />
          ),
        )}
      </div>
    </section>
  );
}
