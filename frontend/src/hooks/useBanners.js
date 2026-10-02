import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
export const useBanners = (placement, categorySlug) => useQuery({
    queryKey: ['banners', placement, categorySlug ?? ''],
    queryFn: () => {
        const params = new URLSearchParams({ placement });
        if (categorySlug)
            params.set('category_slug', categorySlug);
        return api.get(`/banners?${params.toString()}`).then((r) => r.data);
    },
    staleTime: 5 * 60 * 1000,
    placeholderData: [],
});
