import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';

export interface ShippingSettings {
  free_shipping_threshold: number;
  flat_shipping_rate: number;
}

export const DEFAULT_SHIPPING_SETTINGS: ShippingSettings = {
  free_shipping_threshold: 999,
  flat_shipping_rate: 75,
};

export function getShippingFee(subtotal: number, settings: ShippingSettings = DEFAULT_SHIPPING_SETTINGS): number {
  return subtotal >= settings.free_shipping_threshold ? 0 : settings.flat_shipping_rate;
}

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

export function useShippingSettings() {
  return useQuery<ShippingSettings>({
    queryKey: ['shipping-settings'],
    queryFn: async () => {
      const { data } = await api.get<ShippingSettings>('/settings/shipping');
      return data;
    },
  });
}

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
      qc.invalidateQueries({ queryKey: ['shipping-settings'] });
    },
  });
}
