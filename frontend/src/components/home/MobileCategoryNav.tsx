import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { useCategories } from '@/hooks/useCategories';
import { categoryLink, sortByMenuOrder } from '@/components/layout/Navbar/navData';

const MAX_CHIPS = 12;

export default function MobileCategoryNav() {
  const { data: categories = [] } = useCategories();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [centered, setCentered] = useState(true);

  const chips = [
    ...categories,
    ...categories.flatMap((root) => sortByMenuOrder(root.children ?? [])),
  ].slice(0, MAX_CHIPS);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const check = () => setCentered(el.scrollWidth <= el.clientWidth);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    window.addEventListener('resize', check);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', check);
    };
  }, [chips.length]);

  return (
    <section className="bg-white w-full border-b border-gray-100 py-3 sm:py-4">
      <div
        ref={scrollRef}
        className="overflow-x-auto scrollbar-hide px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <style>{`.scrollbar-hide::-webkit-scrollbar { display: none; }`}</style>
        <div
          className={`flex gap-4 sm:gap-4 lg:gap-4 flex-nowrap w-max min-w-full ${centered ? 'mx-auto justify-center' : ''}`}
        >
          {chips.map((cat) => (
            <Link
              key={cat.slug}
              to={categoryLink(cat)}
              className="flex flex-col items-center gap-1.5 sm:gap-2 group flex-shrink-0 w-[68px] sm:w-[76px] lg:w-[84px]"
            >
              <div className="w-[60px] h-[60px] sm:w-[68px] sm:h-[68px] lg:w-[76px] lg:h-[76px] rounded-full overflow-hidden bg-gray-50 border-2 border-transparent group-hover:border-[#16A34A] transition-colors p-0.5">
                <img
                  src={cat.mobile_image_url || cat.image_url || 'https://images.unsplash.com/photo-1545241047-6083a3684587?auto=format&fit=crop&w=150&h=150'}
                  alt={cat.name}
                  className="w-full h-full object-cover rounded-full"
                  loading="lazy"
                />
              </div>
              <span className="text-[10px] sm:text-xs lg:text-sm font-medium text-center text-gray-700 leading-tight">
                {cat.name}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
