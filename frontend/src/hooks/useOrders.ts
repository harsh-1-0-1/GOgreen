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

export function useOrder(id: number, poll = false) {
  return useQuery({
    queryKey: ['order', id],
    queryFn: async () => {
      const { data } = await api.get<Order>(`/orders/${id}`);
      return data;
    },
    enabled: id > 0,
    // Poll every 3 s while `poll` is requested AND payment is still pending.
    // Returns false (stops) once the webhook has updated the status.
    refetchInterval: poll
      ? (query) => {
          const order = query.state.data;
          if (!order) return 3000; // keep polling until we have data
          return order.payment_status === 'pending' ? 3000 : false;
        }
      : false,
  });
}
