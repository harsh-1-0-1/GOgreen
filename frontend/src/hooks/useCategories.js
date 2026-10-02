import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
export function useCategories() {
    return useQuery({
        queryKey: ['categories'],
        queryFn: async () => {
            const { data } = await api.get('/categories');
            return data;
        },
        staleTime: 5 * 60 * 1000,
        placeholderData: [],
    });
}
export function useCategoriesAdmin() {
    return useQuery({
        queryKey: ['categories-admin'],
        queryFn: async () => {
            const { data } = await api.get('/categories/admin');
            return data;
        },
        placeholderData: [],
    });
}
