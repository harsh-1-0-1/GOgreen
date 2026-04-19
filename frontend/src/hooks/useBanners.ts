import { useQuery } from '@tanstack/react-query';

import api from '@/lib/api';
import type { Banner } from '@/types';

export const useBanners = (placement: string) =>
  useQuery<Banner[]>({
    queryKey: ['banners', placement],
    queryFn: () =>
      api.get(`/banners?placement=${placement}`).then((r) => r.data),
    staleTime: 5 * 60 * 1000,
    placeholderData: [],
  });
