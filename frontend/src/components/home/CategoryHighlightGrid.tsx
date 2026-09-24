import { Link } from 'react-router-dom';

import { useBanners } from '@/hooks/useBanners';

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
  const cards = banners;

  if (!isLoading && cards.length === 0) return null;

  return (
    <section className="w-full py-7 sm:py-9 bg-white">
      <div className="mx-auto max-w-[760px] px-2 sm:px-6">
        <div className="grid grid-cols-2 gap-x-2.5 gap-y-5 sm:gap-x-5 sm:gap-y-7">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <HighlightCardSkeleton key={i} />
              ))
            : cards.map((card) => {
                const content = (
                  <div className="group flex flex-col gap-2.5 sm:gap-3">
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
                    {card.title && (
                      <span
                        className="text-center text-[clamp(1rem,4vw,1.65rem)] font-semibold leading-tight"
                        style={{ color: card.text_color || '#16A34A' }}
                      >
                        {card.title}
                      </span>
                    )}
                    {card.subtitle && (
                      <span
                        className="text-center text-[clamp(0.75rem,3vw,1rem)] text-gray-500 leading-tight"
                      >
                        {card.subtitle}
                      </span>
                    )}
                  </div>
                );

                return card.cta_link ? (
                  <Link key={card.id} to={card.cta_link}>
                    {content}
                  </Link>
                ) : (
                  <div key={card.id}>{content}</div>
                );
              })}
        </div>
      </div>
    </section>
  );
}
