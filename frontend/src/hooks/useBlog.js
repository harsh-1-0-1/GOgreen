import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
export function useBlogPosts(filters = {}) {
    return useQuery({
        queryKey: ['blog', filters],
        queryFn: async () => {
            const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== undefined && v !== ''));
            const { data } = await api.get('/blog', { params });
            return data;
        },
    });
}
export function useBlogPost(slug) {
    return useQuery({
        queryKey: ['blog', slug],
        queryFn: async () => {
            const { data } = await api.get(`/blog/${slug}`);
            return data;
        },
        enabled: !!slug,
    });
}
