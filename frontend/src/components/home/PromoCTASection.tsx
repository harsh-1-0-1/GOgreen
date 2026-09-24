import { Link } from 'react-router-dom';

import { useBanners } from '@/hooks/useBanners';

export default function PromoCTASection() {
  const { data: banners = [], isLoading } = useBanners('themed');

  if (isLoading) {
    return (
      <section className="w-full py-10 sm:py-14 bg-white">
        <div className="mx-auto px-6 sm:px-10 lg:px-16 xl:px-24 max-w-7xl">
          <div className="grid md:grid-cols-2 gap-4 sm:gap-5">
            <div className="aspect-[16/9] rounded-2xl bg-gray-200 animate-pulse" />
            <div className="aspect-[16/9] rounded-2xl bg-gray-200 animate-pulse" />
          </div>
        </div>
      </section>
    );
  }

  if (banners.length === 0) return null;

  const cards = banners;

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
