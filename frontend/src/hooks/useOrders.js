import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
export function useOrders(page = 1) {
    return useQuery({
        queryKey: ['orders', page],
        queryFn: async () => {
            const { data } = await api.get('/orders', { params: { page } });
            return data;
        },
    });
}
export function useOrder(id) {
    return useQuery({
        queryKey: ['order', id],
        queryFn: async () => {
            const { data } = await api.get(`/orders/${id}`);
            return data;
        },
        enabled: id > 0,
    });
}
