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
              className="block rounded-2xl overflow-hidden hover:opacity-95 transition-opacity"
            >
              {card.image_url && (
                <img
                  src={card.image_url}
                  alt=""
                  className="w-full h-auto object-cover"
                  loading="lazy"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              )}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
