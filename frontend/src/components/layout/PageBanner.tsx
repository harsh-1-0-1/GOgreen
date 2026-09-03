import { Link, useLocation, useSearchParams } from 'react-router-dom';

import { useBanners } from '@/hooks/useBanners';

export default function PageBanner() {
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Respect category or subcategory filter so per-category banners work.
  // The API falls back to the global page banner when no category-specific
  // one exists.
  const categorySlug =
    searchParams.get('category') || searchParams.get('subcategory') || undefined;

  const { data: banners = [] } = useBanners('page', categorySlug);

  if (location.pathname.startsWith('/admin')) return null;
  if (location.pathname === '/') return null;

  // Pick best-matching banner: category-specific first, then global (no target_path).
  const banner =
    banners[0] ?? null;

  // Nothing configured in the DB yet — render nothing rather than a stale screenshot.
  if (!banner || !banner.image_url) return null;

  const content = (
    <div
      className="mx-auto w-full max-w-7xl overflow-hidden bg-white sm:px-4"
      aria-label={banner.title}
    >
      <div
        className="relative h-[58px] sm:h-[72px] md:h-[86px] overflow-hidden sm:rounded-md"
        style={{ backgroundColor: banner.bg_color }}
      >
        <img
          src={banner.image_url}
          alt=""
          className="h-full w-full object-cover object-center"
          loading="lazy"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      </div>
    </div>
  );

  return (
    <section className="border-b border-gray-100 bg-white py-2 sm:py-3">
      {banner.cta_link ? (
        <Link to={banner.cta_link} className="block" aria-label={banner.title}>
          {content}
        </Link>
      ) : (
        content
      )}
    </section>
  );
}
