import { Link } from 'react-router-dom';

const CATEGORIES = [
  {
    name: 'Indoor Plants',
    slug: 'indoor-plants',
    image: 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?auto=format&fit=crop&w=150&h=150',
  },
  {
    name: 'Best Sellers',
    slug: 'best-sellers',
    image: 'https://images.unsplash.com/photo-1614594975525-e45190c55d0b?auto=format&fit=crop&w=150&h=150',
  },
  {
    name: 'Plant Care',
    slug: 'plant-care',
    image: 'https://images.unsplash.com/photo-1416879598555-25e2e8e305e9?auto=format&fit=crop&w=150&h=150',
  },
  {
    name: 'Pots',
    slug: 'pots',
    image: 'https://images.unsplash.com/photo-1481349518771-20055b2a7b24?auto=format&fit=crop&w=150&h=150',
  },
  {
    name: 'Seeds',
    slug: 'seeds',
    image: 'https://images.unsplash.com/photo-1593014606132-7360706692aa?auto=format&fit=crop&w=150&h=150',
  },
  {
    name: 'Air Purifying',
    slug: 'air-purifying',
    image: 'https://images.unsplash.com/photo-1545241047-6083a3684587?auto=format&fit=crop&w=150&h=150',
  },
];

export default function MobileCategoryNav() {
  return (
    <section className="md:hidden bg-white w-full border-b border-gray-100 py-3 sm:py-4">
      <div className="overflow-x-auto scrollbar-hide px-4 sm:px-6">
        <style>{`.scrollbar-hide::-webkit-scrollbar { display: none; }`}</style>
        <div className="flex gap-4 sm:gap-6 w-max" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.name}
              to={`/products?category=${cat.slug}`}
              className="flex flex-col items-center gap-1.5 sm:gap-2 group w-[68px] sm:w-[76px]"
            >
              <div className="w-[60px] h-[60px] sm:w-[68px] sm:h-[68px] rounded-full overflow-hidden bg-gray-50 border-2 border-transparent group-hover:border-[#16A34A] transition-colors p-0.5">
                <img
                  src={cat.image}
                  alt={cat.name}
                  className="w-full h-full object-cover rounded-full"
                  loading="lazy"
                />
              </div>
              <span className="text-[10px] sm:text-xs font-medium text-center text-gray-700 leading-tight">
                {cat.name}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
