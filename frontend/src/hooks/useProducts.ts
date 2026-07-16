import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import type { Product, ProductListResponse } from '@/types';

interface ProductFilters {
  category_slug?: string;
  search?: string;
  min_price?: number;
  max_price?: number;
  tags?: string;
  sort_by?: string;
  page?: number;
  limit?: number;
}

export function useProducts(filters: ProductFilters = {}) {
  return useQuery({
    queryKey: ['products', filters],
    queryFn: async () => {
      const params = Object.fromEntries(
        Object.entries(filters).filter(([, v]) => v !== undefined && v !== ''),
      );
      const { data } = await api.get<ProductListResponse>('/products', { params });
      return data;
    },
  });
}

export function useProduct(slug: string) {
  return useQuery({
    queryKey: ['product', slug],
    queryFn: async () => {
      const { data } = await api.get<Product>(`/products/${slug}`);
      return data;
    },
    enabled: !!slug,
  });
}

export function useProductRaw(productId: number | null) {
  return useQuery({
    queryKey: ['product-raw', productId],
    queryFn: async () => {
      const { data } = await api.get(`/products/admin/${productId}/raw`);
      return data as Product;  // same shape as Product but image fields are relative keys
    },
    enabled: !!productId,
    // Keep the raw admin data fresh for the duration of an edit session.
    // Without staleTime, React Query refetches on every window-focus event, which causes
    // the rawProduct useEffect to re-fire, reset seededPotImagesRef, and overwrite any
    // variant images the admin has uploaded in the current session with stale server values.
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
