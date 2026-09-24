import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Coupon, CouponValidationResult } from '@/types';

export function useCoupons() {
  return useQuery({
    queryKey: ['admin', 'coupons'],
    queryFn: async () => {
      const { data } = await api.get<Coupon[]>('/admin/coupons');
      return data;
    },
  });
}

export function useCreateCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { code: string; type: 'percent' | 'fixed'; value: number; min_amount: number; is_active: boolean }) => {
      const { data } = await api.post<Coupon>('/admin/coupons', body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'coupons'] }),
  });
}

export function useUpdateCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: number; body: Partial<Pick<Coupon, 'code' | 'type' | 'value' | 'min_amount' | 'is_active'>> }) => {
      const { data } = await api.patch<Coupon>(`/admin/coupons/${id}`, body);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'coupons'] }),
  });
}

export function useDeleteCoupon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/admin/coupons/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'coupons'] }),
  });
}

export function useValidateCoupon() {
  return useMutation({
    mutationFn: async ({ code, subtotal }: { code: string; subtotal: number }) => {
      const { data } = await api.post<CouponValidationResult>('/coupons/validate', { code, subtotal });
      return data;
    },
  });
}