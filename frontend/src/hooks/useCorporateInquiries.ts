import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type {
  CorporateInquiry,
  CorporateInquiryListResponse,
  CorporateInquiryPayload,
} from '@/types';

/**
 * Submit a new corporate/bulk inquiry (public form).
 * Returns the created inquiry with the real ticket_id from the server.
 */
export function useCreateCorporateInquiry() {
  return useMutation({
    mutationFn: async (payload: CorporateInquiryPayload) => {
      const { data } = await api.post<CorporateInquiry>('/corporate-inquiries', payload);
      return data;
    },
  });
}

/**
 * Fetch all corporate inquiries for the admin panel, with optional status filter.
 */
export function useCorporateInquiries(status?: string, page = 1) {
  return useQuery({
    queryKey: ['admin', 'corporate-inquiries', status, page],
    queryFn: async () => {
      const params: Record<string, string | number> = { page };
      if (status) params.status = status;
      const { data } = await api.get<CorporateInquiryListResponse>(
        '/corporate-inquiries/admin',
        { params },
      );
      return data;
    },
  });
}

/**
 * Fetch a single corporate inquiry by id (admin).
 */
export function useCorporateInquiry(inquiryId: number | null) {
  return useQuery({
    queryKey: ['admin', 'corporate-inquiries', inquiryId],
    queryFn: async () => {
      const { data } = await api.get<CorporateInquiry>(
        `/corporate-inquiries/admin/${inquiryId}`,
      );
      return data;
    },
    enabled: !!inquiryId,
  });
}

/**
 * Update inquiry status (admin).
 */
export function useUpdateCorporateInquiryStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      const { data } = await api.patch<CorporateInquiry>(
        `/corporate-inquiries/admin/${id}`,
        { status },
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'corporate-inquiries'] });
    },
  });
}

/**
 * Delete a corporate inquiry (admin cleanup — cancels it out of the list).
 */
export function useDeleteCorporateInquiry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/corporate-inquiries/admin/${id}`);
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'corporate-inquiries'] });
    },
  });
}