import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { DoNotForgetProduct, DoNotForgetListResponse } from '@/types';

// Public hook to fetch Do Not Forget products
export const useDoNotForgetProducts = () =>
  useQuery<DoNotForgetListResponse>({
    queryKey: ['do-not-forget-products'],
    queryFn: () => api.get('/do-not-forget').then((r) => r.data),
    staleTime: 5 * 60 * 1000,
    placeholderData: { items: [], total: 0 },
    retry: 2,
    retryDelay: 1000,
  });

// Admin hook to list all Do Not Forget products
export const useAdminDoNotForgetList = () =>
  useQuery<DoNotForgetListResponse>({
    queryKey: ['admin-do-not-forget-list'],
    queryFn: () => api.get('/do-not-forget/admin/list').then((r) => r.data),
    staleTime: 0,
    placeholderData: { items: [], total: 0 },
    retry: 1,
    retryDelay: 500,
  });

// Add product to Do Not Forget list
export const useAddDoNotForgetProduct = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (productId: number) =>
      api.post('/do-not-forget', { product_id: productId, sort_order: 0, is_active: true }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-do-not-forget-list'] });
      queryClient.invalidateQueries({ queryKey: ['do-not-forget-products'] });
    },
  });
};

// Remove product from Do Not Forget list
export const useRemoveDoNotForgetProduct = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: number) => api.delete(`/do-not-forget/${itemId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-do-not-forget-list'] });
      queryClient.invalidateQueries({ queryKey: ['do-not-forget-products'] });
    },
  });
};

// Update Do Not Forget product
export const useUpdateDoNotForgetProduct = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, data }: { itemId: number; data: { sort_order?: number; is_active?: boolean } }) =>
      api.put(`/do-not-forget/${itemId}`, data).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-do-not-forget-list'] });
      queryClient.invalidateQueries({ queryKey: ['do-not-forget-products'] });
    },
  });
};

// Reorder Do Not Forget products
export const useReorderDoNotForgetProducts = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (items: number[]) =>
      api.post('/do-not-forget/reorder', { items }).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-do-not-forget-list'] });
      queryClient.invalidateQueries({ queryKey: ['do-not-forget-products'] });
    },
    onError: (error: any) => {
      console.error('Reorder failed:', error);
    },
  });
};
