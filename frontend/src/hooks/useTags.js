import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import { toTagKey } from '@/lib/tagKey';
export function useTags() {
    return useQuery({
        queryKey: ['tags'],
        queryFn: async () => {
            const { data } = await api.get('/tags');
            return data;
        },
        staleTime: 5 * 60 * 1000,
        placeholderData: [],
    });
}
export function useUpsertTag() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, ...body }) => {
            const { data } = id
                ? await api.put(`/tags/${id}`, body)
                : await api.post('/tags', body);
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
            const { data } = await api.get('/tags/admin');
            return data;
        },
        staleTime: 30 * 1000,
        placeholderData: [],
    });
}
export function useDeleteTag() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (id) => {
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
export function useTagColorMap() {
    const { data } = useTags();
    const map = {};
    (data ?? []).forEach((t) => {
        if (!t.color)
            return;
        map[toTagKey(t.name)] = t.color;
    });
    return map;
}
