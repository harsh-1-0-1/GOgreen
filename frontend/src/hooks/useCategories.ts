import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Category } from '@/types';

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data } = await api.get<Category[]>('/categories');
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
      const { data } = await api.get<Category[]>('/categories/admin');
      return data;
    },
    placeholderData: [],
  });
}
