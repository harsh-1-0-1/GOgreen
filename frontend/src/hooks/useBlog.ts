import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import type { BlogPost, BlogListResponse } from '@/types';

interface BlogFilters {
  category?: string;
  page?: number;
  limit?: number;
}

export function useBlogPosts(filters: BlogFilters = {}) {
  return useQuery({
    queryKey: ['blog', filters],
    queryFn: async () => {
      const params = Object.fromEntries(
        Object.entries(filters).filter(([, v]) => v !== undefined && v !== ''),
      );
      const { data } = await api.get<BlogListResponse>('/blog', { params });
      return data;
    },
  });
}

export function useBlogPost(slug: string) {
  return useQuery({
    queryKey: ['blog', slug],
    queryFn: async () => {
      const { data } = await api.get<BlogPost>(`/blog/${slug}`);
      return data;
    },
    enabled: !!slug,
  });
}
