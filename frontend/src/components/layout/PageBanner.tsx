import { Link, useLocation } from 'react-router-dom';

import { useBanners } from '@/hooks/useBanners';
import type { Banner } from '@/types';

const FALLBACK_PAGE_BANNER: Banner = {
  id: 0,
  title: 'Gardening ka full range. Sirf idhar milega!',
  cta_link: '/products',
  image_url: '/page-banner-default.jpeg',
  bg_color: '#f4efe5',
  text_color: '#1B4332',
  placement: 'page',
  position: 0,
  is_active: true,
};

export default function PageBanner() {
  const location = useLocation();
  const { data: banners = [] } = useBanners('page');
  const banner = banners[0] || FALLBACK_PAGE_BANNER;

  if (location.pathname.startsWith('/admin')) return null;
  if (location.pathname === '/') return null;

  const isDefaultScreenshot = banner.image_url?.includes(
    'page-banner-default',
  );

  const content = (
    <div
      className="mx-auto w-full max-w-7xl overflow-hidden bg-white sm:px-4"
      aria-label={banner.title}
    >
      <div
        className="relative h-[58px] sm:h-[72px] md:h-[86px] overflow-hidden sm:rounded-md"
        style={{ backgroundColor: banner.bg_color }}
      >
        {banner.image_url ? (
          <img
            src={banner.image_url}
            alt=""
            className="h-full w-full object-cover object-center"
            style={{
              objectPosition: isDefaultScreenshot ? 'center 34%' : 'center',
            }}
            loading="lazy"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : (
          <div className="flex h-full items-center justify-center px-4 text-center">
            <span
              className="text-sm font-semibold sm:text-base"
              style={{ color: banner.text_color }}
            >
              {banner.title}
            </span>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <section className="border-b border-gray-100 bg-white py-2 sm:py-3 md:hidden">
      {banner.cta_link ? (
        <Link to={banner.cta_link} className="block">
          {content}
        </Link>
      ) : (
        content
      )}
    </section>
  );
}
