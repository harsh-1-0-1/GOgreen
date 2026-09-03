import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { ReviewListResponse } from '@/types';

interface ReviewFilters {
  page?: number;
  limit?: number;
  sort_by?: 'top' | 'newest' | 'highest' | 'lowest';
  rating?: number;
}

export function useProductReviews(productId: number | undefined, filters: ReviewFilters = {}) {
  return useQuery({
    queryKey: ['product-reviews', productId, filters],
    queryFn: async () => {
      const { data } = await api.get<ReviewListResponse>(`/products/${productId}/reviews`, {
        params: filters,
      });
      return data;
    },
    enabled: Boolean(productId),
  });
}

export function useCreateReview(productId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      rating: number;
      title?: string;
      body?: string;
      author_name?: string;
      youtube_url?: string;
      media?: File;
    }) => {
      const formData = new FormData();
      formData.append('rating', payload.rating.toString());
      if (payload.title) formData.append('title', payload.title);
      if (payload.body) formData.append('body', payload.body);
      if (payload.author_name) formData.append('author_name', payload.author_name);
      if (payload.youtube_url) formData.append('youtube_url', payload.youtube_url);
      if (payload.media) formData.append('media', payload.media);

      const { data } = await api.post(`/products/${productId}/reviews`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-reviews', productId] });
    },
  });
}

export function useMarkReviewHelpful(productId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (reviewId: number) => {
      const { data } = await api.post(`/reviews/${reviewId}/helpful`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-reviews', productId] });
    },
  });
}
