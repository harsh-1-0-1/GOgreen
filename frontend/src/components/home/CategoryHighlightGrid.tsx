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
    <div className="flex flex-col gap-2.5 sm:gap-3">
      <div className="aspect-[3/4] rounded-xl bg-gray-100 animate-pulse" />
      <div className="h-5 w-3/4 mx-auto rounded bg-gray-100 animate-pulse" />
    </div>
  );
}

export default function CategoryHighlightGrid() {
  const { data: banners = [], isLoading } = useBanners('highlight');
  const cards = banners.length > 0 ? banners : FALLBACK_CARDS;

  return (
    <section className="w-full py-7 sm:py-9 bg-white">
      <div className="mx-auto max-w-[760px] px-2 sm:px-6">
        <div className="grid grid-cols-2 gap-x-2.5 gap-y-5 sm:gap-x-5 sm:gap-y-7">
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
                    className="group flex flex-col gap-2.5 sm:gap-3"
                  >
                    <div
                      className="relative aspect-[3/4] overflow-hidden rounded-xl shadow-sm transition-all group-hover:shadow-md"
                      style={{ backgroundColor: card.bg_color || '#F5F0E8' }}
                    >
                      {card.image_url && (
                        <img
                          src={card.image_url}
                          alt=""
                          loading="lazy"
                          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      )}
                    </div>
                    {card.subtitle && (
                      <span
                        className="text-center text-[clamp(1rem,4vw,1.65rem)] font-semibold leading-tight"
                        style={{ color: card.text_color || '#16A34A' }}
                      >
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
