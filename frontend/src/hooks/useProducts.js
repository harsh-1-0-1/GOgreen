import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
export function useProducts(filters = {}) {
    return useQuery({
        queryKey: ['products', filters],
        queryFn: async () => {
            const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== undefined && v !== ''));
            const { data } = await api.get('/products', { params });
            return data;
        },
        staleTime: 0,
        refetchOnMount: 'always',
        refetchOnWindowFocus: true,
    });
}
export function useProduct(slug) {
    return useQuery({
        queryKey: ['product', slug],
        queryFn: async () => {
            const { data } = await api.get(`/products/${slug}`);
            return data;
        },
        enabled: !!slug,
        staleTime: 0,
        refetchOnMount: 'always',
        refetchOnWindowFocus: true,
    });
}
export function useProductRaw(productId) {
    return useQuery({
        queryKey: ['product-raw', productId],
        queryFn: async () => {
            const { data } = await api.get(`/products/admin/${productId}/raw`);
            return data; // same shape as Product but image fields are relative keys
        },
        enabled: !!productId,
        // Keep the raw admin data fresh for the duration of an edit session.
        // Without staleTime, React Query refetches on every window-focus event, which causes
        // the rawProduct useEffect to re-fire, reset seededPotImagesRef, and overwrite any
        // variant images the admin has uploaded in the current session with stale server values.
        staleTime: 5 * 60 * 1000, // 5 minutes
    });
}
export function useAdminAllProducts(limit = 1000) {
    return useQuery({
        queryKey: ['admin-all-products', limit],
        queryFn: async () => {
            const { data } = await api.get('/products/admin/all', {
                params: { limit }
            });
            return data;
        },
        staleTime: 60 * 1000, // 1 minute
    });
}
export function useProductsByIds(ids) {
    return useQuery({
        queryKey: ['products-by-ids', ids],
        queryFn: async () => {
            const { data } = await api.get(`/products/by-ids`, {
                params: { ids: ids.join(',') },
            });
            return data;
        },
        enabled: ids.length > 0,
        staleTime: 5 * 60 * 1000,
    });
}
