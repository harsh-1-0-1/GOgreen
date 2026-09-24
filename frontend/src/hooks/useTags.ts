import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { CatalogTag } from '@/types';

export function useTags() {
  return useQuery({
    queryKey: ['tags'],
    queryFn: async () => {
      const { data } = await api.get<CatalogTag[]>('/tags');
      return data;
    },
    staleTime: 5 * 60 * 1000,
    placeholderData: [],
  });
}

export function useUpsertTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...body }: { id?: number } & Partial<CatalogTag> & { name: string }) => {
      const { data } = id
        ? await api.put<CatalogTag>(`/tags/${id}`, body)
        : await api.post<CatalogTag>('/tags', body);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tags'] });
      qc.invalidateQueries({ queryKey: ['tags-admin'] });
    },
  });
}

/** Build a slug → colour map from the global tag list. */
export function useTagColorMap(): Record<string, string> {
  const { data } = useTags();
  const map: Record<string, string> = {};
  (data ?? []).forEach((t) => {
    if (t.color) map[t.slug] = t.color;
  });
  return map;
}