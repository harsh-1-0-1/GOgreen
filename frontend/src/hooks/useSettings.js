import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
export const DEFAULT_SHIPPING_SETTINGS = {
    free_shipping_threshold: 999,
    flat_shipping_rate: 75,
};
export function getShippingFee(subtotal, settings = DEFAULT_SHIPPING_SETTINGS) {
    return subtotal >= settings.free_shipping_threshold ? 0 : settings.flat_shipping_rate;
}
export function useShippingSettings() {
    return useQuery({
        queryKey: ['shipping-settings'],
        queryFn: async () => {
            const { data } = await api.get('/settings/shipping');
            return data;
        },
    });
}
export function useSettings() {
    return useQuery({
        queryKey: ['settings'],
        queryFn: async () => {
            const { data } = await api.get('/settings');
            return data;
        },
    });
}
export function useUpdateSettings() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (body) => {
            const { data } = await api.patch('/settings', body);
            return data;
        },
        onSuccess: (updated) => {
            qc.setQueryData(['settings'], updated);
            qc.invalidateQueries({ queryKey: ['shipping-settings'] });
        },
    });
}
