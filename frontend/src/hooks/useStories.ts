import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Story } from '@/types';

export function useStories() {
  return useQuery<Story[]>({
    queryKey: ['stories'],
    queryFn: async () => {
      const { data } = await api.get('/stories');
      return data;
    },
    staleTime: 1000 * 60 * 30, // 30 minutes
  });
}
