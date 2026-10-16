import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { toTagKey } from '@/lib/tagKey';
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

/** All tags including inactive ones — for the admin tag manager. */
export function useAdminTags() {
  return useQuery({
    queryKey: ['tags-admin'],
    queryFn: async () => {
      const { data } = await api.get<CatalogTag[]>('/tags/admin');
      return data;
    },
    staleTime: 30 * 1000,
    placeholderData: [],
  });
}

export function useDeleteTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/tags/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tags'] });
      qc.invalidateQueries({ queryKey: ['tags-admin'] });
    },
  });
}

/**
 * Build a lookup of tag key → colour for the catalog badges.
 *
 * The resolver in `productTagBadges.utils.ts` looks values up by `toTagKey`, so
 * the admin label "Vastu friendly" and the slug `vastu-friendly` both resolve.
 */
export function useTagColorMap(): Record<string, string> {
  const { data } = useTags();
  const map: Record<string, string> = {};
  (data ?? []).forEach((t) => {
    if (!t.color) return;
    map[toTagKey(t.name)] = t.color;
  });
  return map;
}
