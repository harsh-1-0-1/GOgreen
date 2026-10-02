import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
export function useCoupons() {
    return useQuery({
        queryKey: ['admin', 'coupons'],
        queryFn: async () => {
            const { data } = await api.get('/admin/coupons');
            return data;
        },
    });
}
export function useCreateCoupon() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (body) => {
            const { data } = await api.post('/admin/coupons', body);
            return data;
        },
        onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'coupons'] }),
    });
}
export function useUpdateCoupon() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, body }) => {
            const { data } = await api.patch(`/admin/coupons/${id}`, body);
            return data;
        },
        onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'coupons'] }),
    });
}
export function useDeleteCoupon() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (id) => {
            await api.delete(`/admin/coupons/${id}`);
        },
        onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'coupons'] }),
    });
}
export function useValidateCoupon() {
    return useMutation({
        mutationFn: async ({ code, subtotal }) => {
            const { data } = await api.post('/coupons/validate', { code, subtotal });
            return data;
        },
    });
}
