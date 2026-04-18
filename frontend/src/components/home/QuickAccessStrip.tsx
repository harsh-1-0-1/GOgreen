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
    image:
      'https://images.unsplash.com/photo-1545241047-6083a3684587?w=200',
    link: '/products?subcategory=xl-plants',
  },
  {
    type: 'category',
    label: 'Plant Stands',
    image:
      'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=200',
    link: '/products?subcategory=plant-stands',
  },
  {
    type: 'category',
    label: 'Plant Care',
    image:
      'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=200',
    link: '/products?category=plant-care',
  },
  {
    type: 'category',
    label: 'Ceramic Pots',
    image:
      'https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=200',
    link: '/products?subcategory=ceramic-pots',
  },
  {
    type: 'category',
    label: 'Ready to use sprays',
    image:
      'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=200',
    link: '/products?tag=spray',
  },
  {
    type: 'category',
    label: 'Watering Tools',
    image:
      'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=200',
    link: '/products?subcategory=watering-tools',
  },
  {
    type: 'category',
    label: 'Summer Seeds',
    image:
      'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=200',
    link: '/products?category=seeds&season=summer',
  },
];

function PromoTile({ tile }: { tile: Tile }) {
  return (
    <Link
      to={tile.link}
      className="shrink-0 w-[130px] h-[150px] md:w-[160px] md:h-[180px] rounded-xl flex items-center justify-center p-4 transition-transform hover:scale-[1.03]"
      style={{ backgroundColor: tile.bg }}
    >
      <span
        className="text-base md:text-lg font-bold italic leading-snug text-center whitespace-pre-line"
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
      className="group shrink-0 w-[130px] h-[150px] md:w-[160px] md:h-[180px] rounded-xl overflow-hidden relative"
    >
      <img
        src={tile.image}
        alt={tile.label}
        className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
        loading="lazy"
      />
      <div className="absolute inset-x-0 bottom-0 bg-white/85 backdrop-blur-sm px-2.5 py-2">
        <span className="text-xs md:text-sm font-semibold text-gray-800 leading-tight line-clamp-2">
          {tile.label}
        </span>
      </div>
    </Link>
  );
}

export default function QuickAccessStrip() {
  return (
    <section className="py-5 md:py-6">
      <div className="flex gap-3 overflow-x-auto scrollbar-hide px-4 md:px-[max(1rem,calc((100%-80rem)/2+1rem))]">
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
