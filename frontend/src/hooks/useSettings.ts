import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

export interface StoreSettings {
  id: number;
  store_name: string;
  support_email: string;
  support_phone: string;
  warehouse_address: string;
  cod_enabled: boolean;
  free_shipping_threshold: number;
  flat_shipping_rate: number;
  notify_new_order: boolean;
  notify_low_stock: boolean;
  meta_title: string;
  meta_description: string;
  primary_color: string;
  accent_color: string;
  updated_at: string;
}

export type StoreSettingsUpdate = Partial<Omit<StoreSettings, 'id' | 'updated_at'>>;

export function useSettings() {
  return useQuery<StoreSettings>({
    queryKey: ['settings'],
    queryFn: async () => {
      const { data } = await api.get<StoreSettings>('/settings');
      return data;
    },
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: StoreSettingsUpdate) => {
      const { data } = await api.patch<StoreSettings>('/settings', body);
      return data;
    },
    onSuccess: (updated) => {
      qc.setQueryData(['settings'], updated);
    },
  });
}
