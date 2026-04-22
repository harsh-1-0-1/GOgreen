import { Link } from 'react-router-dom';

import { useBanners } from '@/hooks/useBanners';
import type { Banner } from '@/types';

const FALLBACK_CARDS: Banner[] = [
  {
    id: -1,
    title: 'Combos',
    subtitle: 'Get 4 at ₹699',
    cta_link: '/products?tags=combo',
    image_url:
      'https://images.unsplash.com/photo-1459411552884-841db9b3cc2a?w=800&q=80',
    bg_color: '#F5F0E8',
    text_color: '#16A34A',
    placement: 'highlight',
    position: 0,
    is_active: true,
  },
  {
    id: -2,
    title: 'Plant Care',
    subtitle: 'upto 65% off',
    cta_link: '/products?category=plant-care',
    image_url:
      'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&q=80',
    bg_color: '#F5F0E8',
    text_color: '#16A34A',
    placement: 'highlight',
    position: 1,
    is_active: true,
  },
  {
    id: -3,
    title: 'Ceramics',
    subtitle: 'upto 40% off',
    cta_link: '/products?category=ceramic-pots',
    image_url:
      'https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=800&q=80',
    bg_color: '#F5F0E8',
    text_color: '#16A34A',
    placement: 'highlight',
    position: 2,
    is_active: true,
  },
  {
    id: -4,
    title: 'Seeds',
    subtitle: 'Starting at ₹99',
    cta_link: '/products?category=seeds',
    image_url:
      'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=800&q=80',
    bg_color: '#F5F0E8',
    text_color: '#16A34A',
    placement: 'highlight',
    position: 3,
    is_active: true,
  },
];

function HighlightCardSkeleton() {
  return (
    <div className="flex flex-col gap-2 sm:gap-2.5">
      <div className="aspect-square rounded-2xl bg-gray-100 animate-pulse" />
      <div className="h-4 w-2/3 mx-auto rounded bg-gray-100 animate-pulse" />
    </div>
  );
}

export default function CategoryHighlightGrid() {
  const { data: banners = [], isLoading } = useBanners('highlight');
  const cards = banners.length > 0 ? banners : FALLBACK_CARDS;

  return (
    <section className="w-full py-6 sm:py-8 bg-white">
      <div className="mx-auto px-4 sm:px-6 lg:px-10 xl:px-16 max-w-7xl">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <HighlightCardSkeleton key={i} />
              ))
            : cards.map((card) => {
                const link = card.cta_link || '/products';
                return (
                  <Link
                    key={card.id}
                    to={link}
                    className="group flex flex-col gap-2 sm:gap-2.5"
                  >
                    <div
                      className="relative aspect-square rounded-2xl overflow-hidden shadow-sm group-hover:shadow-md transition-all"
                      style={{ backgroundColor: card.bg_color || '#F5F0E8' }}
                    >
                      {card.image_url && (
                        <img
                          src={card.image_url}
                          alt={card.title}
                          loading="lazy"
                          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-transparent" />
                      <h3 className="absolute top-3 left-3 sm:top-4 sm:left-4 text-white text-lg sm:text-2xl font-semibold drop-shadow-sm">
                        {card.title}
                      </h3>
                    </div>
                    {card.subtitle && (
                      <span
                        className="text-center text-sm sm:text-base font-semibold"
                        style={{ color: card.text_color || '#16A34A' }}
                      >
                        {card.subtitle}
                      </span>
                    )}
                  </Link>
                );
              })}
        </div>
      </div>
    </section>
  );
}
