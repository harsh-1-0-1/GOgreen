import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { DisplaySection, DisplaySectionAdmin } from '@/types';

const PUBLIC_QUERY_KEY = ['display-sections'];
const ADMIN_QUERY_KEY = ['admin-display-sections'];

function invalidateSectionQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: PUBLIC_QUERY_KEY });
  queryClient.invalidateQueries({ queryKey: ADMIN_QUERY_KEY });
}

export function useDisplaySections() {
  return useQuery<DisplaySection[]>({
    queryKey: PUBLIC_QUERY_KEY,
    queryFn: () => api.get<DisplaySection[]>('/display_sections').then((response) => response.data),
    staleTime: 5 * 60 * 1000,
  });
}

export function useAdminDisplaySections() {
  return useQuery<DisplaySectionAdmin[]>({
    queryKey: ADMIN_QUERY_KEY,
    queryFn: () => api.get<DisplaySectionAdmin[]>('/display_sections/admin').then((response) => response.data),
  });
}

export function useCreateDisplaySection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string }) =>
      api.post<DisplaySection>('/display_sections/admin', body).then((response) => response.data),
    onSuccess: () => invalidateSectionQueries(queryClient),
  });
}

export function useUpdateDisplaySection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: { name: string } }) =>
      api.put<DisplaySection>(`/display_sections/admin/${id}`, body).then((response) => response.data),
    onSuccess: () => invalidateSectionQueries(queryClient),
  });
}

export function useSetDisplaySectionActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      api
        .patch<DisplaySection>(`/display_sections/admin/${id}/active`, { is_active: isActive })
        .then((response) => response.data),
    onMutate: async ({ id, isActive }) => {
      await queryClient.cancelQueries({ queryKey: ADMIN_QUERY_KEY });
      const previous = queryClient.getQueryData<DisplaySectionAdmin[]>(ADMIN_QUERY_KEY);
      queryClient.setQueryData<DisplaySectionAdmin[]>(ADMIN_QUERY_KEY, (current) =>
        (current ?? []).map((section) =>
          section.id === id ? { ...section, is_active: isActive } : section,
        ),
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(ADMIN_QUERY_KEY, context.previous);
      }
    },
    onSettled: () => invalidateSectionQueries(queryClient),
  });
}

export function useDeleteDisplaySection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/display_sections/admin/${id}`).then(() => undefined),
    onSuccess: () => invalidateSectionQueries(queryClient),
  });
}

export function useReorderDisplaySections() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (items: Array<{ id: number; sort_order: number }>) =>
      api
        .patch<{ ok: boolean }>('/display_sections/admin/reorder', { items })
        .then((response) => response.data),
    onMutate: async (items) => {
      await queryClient.cancelQueries({ queryKey: ADMIN_QUERY_KEY });
      const previous = queryClient.getQueryData<DisplaySectionAdmin[]>(ADMIN_QUERY_KEY);
      const current = previous ?? [];
      const byId = new Map(current.map((section) => [section.id, section]));
      queryClient.setQueryData<DisplaySectionAdmin[]>(
        ADMIN_QUERY_KEY,
        items.flatMap((item) => {
          const section = byId.get(item.id);
          return section ? [{ ...section, sort_order: item.sort_order }] : [];
        }),
      );
      return { previous };
    },
    onError: (_error, _items, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(ADMIN_QUERY_KEY, context.previous);
      }
    },
    onSettled: () => invalidateSectionQueries(queryClient),
  });
}
