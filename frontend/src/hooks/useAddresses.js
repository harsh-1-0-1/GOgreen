import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
export function useAddresses() {
    return useQuery({
        queryKey: ['addresses'],
        queryFn: async () => {
            const { data } = await api.get('/addresses');
            return data;
        },
    });
}
export function useCreateAddress() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (body) => {
            const { data } = await api.post('/addresses', body);
            return data;
        },
        onSuccess: () => qc.invalidateQueries({ queryKey: ['addresses'] }),
    });
}
export function useDeleteAddress() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (id) => {
            await api.delete(`/addresses/${id}`);
        },
        onSuccess: () => qc.invalidateQueries({ queryKey: ['addresses'] }),
    });
}
