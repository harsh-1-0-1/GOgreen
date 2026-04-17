import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Address } from '@/types';

export function useAddresses() {
  return useQuery({
    queryKey: ['addresses'],
    queryFn: async () => {
      const { data } = await api.get<Address[]>('/addresses');
      return data;
    },
  });
}

export function useCreateAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Omit<Address, 'id' | 'user_id'>) => {
      const { data } = await api.post<Address>('/addresses', body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['addresses'] }),
  });
}

export function useDeleteAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/addresses/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['addresses'] }),
  });
}
