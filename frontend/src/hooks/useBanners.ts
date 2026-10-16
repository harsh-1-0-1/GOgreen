import { useQuery } from '@tanstack/react-query';

import api from '@/lib/api';
import type { Banner, BannerPlacement } from '@/types';

export const useBanners = (placement: BannerPlacement, categorySlug?: string) =>
  useQuery<Banner[]>({
    queryKey: ['banners', placement, categorySlug ?? ''],
    queryFn: () => {
      const params = new URLSearchParams({ placement });
      if (categorySlug) params.set('category_slug', categorySlug);
      return api.get(`/banners?${params.toString()}`).then((r) => r.data);
    },
    staleTime: 5 * 60 * 1000,
    placeholderData: [],
  });
