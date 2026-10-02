import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
export function useStories() {
    return useQuery({
        queryKey: ['stories'],
        queryFn: async () => {
            const { data } = await api.get('/stories');
            return data;
        },
        staleTime: 1000 * 60 * 30, // 30 minutes
    });
}
