import { Link } from 'react-router-dom';

interface Tile {
  type: 'promo' | 'category';
  label: string;
  link: string;
  image?: string;
  bg?: string;
  textColor?: string;
}

const TILES: Tile[] = [
  {
    type: 'promo',
    label: 'Next-Day\nDelivery',
    bg: '#1B4332',
    textColor: '#A3E635',
    link: '/next-day-delivery',
  },
  {
    type: 'category',
    label: 'XL Plants',
    image: 'https://images.unsplash.com/photo-1545241047-6083a3684587?w=400',
    link: '/products?subcategory=xl-plants',
  },
  {
    type: 'category',
    label: 'Plant Stands',
    image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400',
    link: '/products?subcategory=plant-stands',
  },
  {
    type: 'category',
    label: 'Plant Care',
    image: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400',
    link: '/products?category=plant-care',
  },
  {
    type: 'category',
    label: 'Ceramic Pots',
    image: 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=400',
    link: '/products?subcategory=ceramic-pots',
  },
  {
    type: 'category',
    label: 'Ready to use sprays',
    image: 'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400',
    link: '/products?tag=spray',
  },
  {
    type: 'category',
    label: 'Watering Tools',
    image: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400',
    link: '/products?subcategory=watering-tools',
  },
  {
    type: 'category',
    label: 'Summer Seeds',
    image: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=400',
    link: '/products?category=seeds&season=summer',
  },
];

function PromoTile({ tile }: { tile: Tile }) {
  return (
    <Link
      to={tile.link}
      className="shrink-0 lg:shrink lg:flex-1 w-[140px] sm:w-[160px] lg:w-auto aspect-square rounded-2xl flex items-center justify-center p-4 transition-all hover:scale-[1.02] shadow-sm hover:shadow-md"
      style={{ backgroundColor: tile.bg }}
    >
      <span
        className="text-lg sm:text-xl lg:text-2xl font-bold italic leading-tight text-center whitespace-pre-line"
        style={{ color: tile.textColor }}
      >
        {tile.label}
      </span>
    </Link>
  );
}

function CategoryTile({ tile }: { tile: Tile }) {
  return (
    <Link
      to={tile.link}
      className="group shrink-0 lg:shrink lg:flex-1 w-[140px] sm:w-[160px] lg:w-auto aspect-square rounded-2xl overflow-hidden relative shadow-sm hover:shadow-md transition-all hover:scale-[1.02]"
    >
      <img
        src={tile.image}
        alt={tile.label}
        className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
        loading="lazy"
      />
      <div className="absolute inset-x-0 bottom-0 bg-white/90 backdrop-blur-md px-3 py-2.5 border-t border-white/20">
        <span className="text-sm font-bold text-gray-800 leading-tight block text-center truncate">
          {tile.label}
        </span>
      </div>
    </Link>
  );
}

export default function QuickAccessStrip() {
  return (
    <section className="w-full py-4 sm:py-6">
      <div className="flex gap-3 sm:gap-4 lg:gap-5 overflow-x-auto lg:overflow-visible scrollbar-hide px-4 sm:px-6 lg:px-10 xl:px-16 w-full pb-2 lg:pb-0">
        {TILES.map((tile) =>
          tile.type === 'promo' ? (
            <PromoTile key={tile.label} tile={tile} />
          ) : (
            <CategoryTile key={tile.label} tile={tile} />
          ),
        )}
      </div>
    </section>
  );
}
