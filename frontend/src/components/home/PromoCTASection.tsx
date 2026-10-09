import { Link } from 'react-router-dom';

import { useBanners } from '@/hooks/useBanners';

export default function PromoCTASection() {
  const { data: banners = [], isLoading } = useBanners('themed');

  if (isLoading) {
    return (
      <section className="w-full py-10 sm:py-14 bg-white">
        <div className="mx-auto px-6 sm:px-10 lg:px-16 xl:px-24 max-w-7xl">
          <div className="grid md:grid-cols-2 gap-4 sm:gap-5">
            <div className="rounded-2xl bg-gray-200 animate-pulse" style={{ aspectRatio: '800 / 480' }} />
            <div className="rounded-2xl bg-gray-200 animate-pulse" style={{ aspectRatio: '800 / 480' }} />
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
        <div className="grid md:grid-cols-2 items-start gap-4 sm:gap-5">
          {cards.map((card) => {
            const content = (
              <>
                {card.image_url && (
                  <div className="relative overflow-hidden" style={{ aspectRatio: '800 / 480' }}>
                    <img
                      src={card.image_url}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        (e.currentTarget.parentElement as HTMLElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}
              </>
            );
            const className =
              'block rounded-2xl overflow-hidden bg-gray-50 hover:opacity-95 transition-opacity';

            return card.cta_link ? (
              <Link key={card.id} to={card.cta_link} className={className}>
                {content}
              </Link>
            ) : (
              <div key={card.id} className={className}>
                {content}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
