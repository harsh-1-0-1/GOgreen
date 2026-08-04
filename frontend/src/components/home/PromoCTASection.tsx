import { Link } from 'react-router-dom';

import { useBanners } from '@/hooks/useBanners';

const FALLBACK_CARDS = [
  {
    id: -1,
    image_url:
      'https://images.unsplash.com/photo-1545241047-6083a3684587?w=400&q=80',
    title: 'Plant Subscriptions',
    subtitle:
      'Receive a curated box of handpicked plants, packaged with care, every month.',
    cta_text: 'Start Saving',
    cta_link: '/products?tags=combo',
    text_color: '#16A34A',
    bg_color: '#D1FAE5',
  },
  {
    id: -2,
    image_url:
      'https://images.unsplash.com/photo-1591958911259-bee2173bdccc?w=400&q=80',
    title: 'Corporate & Bulk Gifting',
    subtitle: 'Curated plant gift sets for your team, clients, and events.',
    cta_text: 'Explore Gifts',
    cta_link: '/products?tags=corporate-gifts',
    text_color: '#16A34A',
    bg_color: '#D1FAE5',
  },
];

export default function PromoCTASection() {
  const { data: banners = [] } = useBanners('themed');
  const cards = banners.length > 0 ? banners : FALLBACK_CARDS;

  return (
    <section className="w-full py-10 sm:py-14 bg-white">
      <div className="mx-auto px-6 sm:px-10 lg:px-16 xl:px-24 max-w-7xl">
        <div className="grid md:grid-cols-2 gap-4 sm:gap-5">
          {cards.map((card) => (
            <Link
              key={card.id}
              to={card.cta_link || '/products'}
              className="flex flex-col sm:flex-row items-center gap-5 rounded-2xl p-5 sm:p-7 hover:opacity-95 transition-opacity"
              style={{ border: `1px solid ${card.bg_color || '#D1FAE5'}`, background: card.bg_color || 'white' }}
            >
              {card.image_url && (
                <img
                  src={card.image_url}
                      alt=""
                  className="w-full sm:w-[160px] h-44 sm:h-[160px] rounded-xl object-cover shrink-0"
                  loading="lazy"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              )}
              <div className="flex flex-col gap-2.5">
                {card.title && (
                  <h3 className="text-lg sm:text-xl font-bold text-gray-900">
                    {card.title}
                  </h3>
                )}
                {card.subtitle && (
                  <p className="text-sm text-gray-600">
                    {card.subtitle}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
