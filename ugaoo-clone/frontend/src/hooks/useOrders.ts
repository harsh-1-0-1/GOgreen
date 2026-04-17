import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Order, OrderListResponse } from '@/types';

export function useOrders(page = 1) {
  return useQuery({
    queryKey: ['orders', page],
    queryFn: async () => {
      const { data } = await api.get<OrderListResponse>('/orders', { params: { page } });
      return data;
    },
  });
}

export function useOrder(id: number) {
  return useQuery({
    queryKey: ['order', id],
    queryFn: async () => {
      const { data } = await api.get<Order>(`/orders/${id}`);
      return data;
    },
    enabled: id > 0,
  });
}
