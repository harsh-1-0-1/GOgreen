import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
import type { DamageClaim, DamageClaimListResponse, Order, OrderListResponse } from '@/types';

// ---------------------------------------------------------------------------
// Customer hooks
// ---------------------------------------------------------------------------

/**
 * Fetch the current user's delivered orders that are eligible for a damage claim
 * (delivered status, no active claim already on them).
 * Reuses the existing GET /orders endpoint — filtering to delivered is done here.
 */
export function useDeliveredOrders() {
  return useQuery({
    queryKey: ['orders', 'delivered'],
    queryFn: async () => {
      const { data } = await api.get<OrderListResponse>('/orders', {
        params: { limit: 50 },
      });
      // Filter client-side to only delivered orders
      return data.items.filter((o: Order) => o.status === 'delivered');
    },
  });
}

/**
 * Submit a new damage claim. Accepts FormData so photos can be included.
 * Returns the created DamageClaim with the real ticket_id from the server.
 */
export function useSubmitDamageClaim() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (formData: FormData) => {
      const { data } = await api.post<DamageClaim>('/damage-claims', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    },
    onSuccess: () => {
      // Invalidate the user's claims list so it refreshes if they navigate to it
      qc.invalidateQueries({ queryKey: ['damage-claims', 'my'] });
    },
  });
}

/**
 * Fetch the current user's own damage claims.
 */
export function useMyDamageClaims(page = 1) {
  return useQuery({
    queryKey: ['damage-claims', 'my', page],
    queryFn: async () => {
      const { data } = await api.get<DamageClaimListResponse>('/damage-claims/my', {
        params: { page },
      });
      return data;
    },
  });
}

/**
 * Fetch a single claim by ticket ID (scoped to current user).
 */
export function useDamageClaimByTicket(ticketId: string | null) {
  return useQuery({
    queryKey: ['damage-claims', 'ticket', ticketId],
    queryFn: async () => {
      const { data } = await api.get<DamageClaim>(`/damage-claims/ticket/${ticketId}`);
      return data;
    },
    enabled: !!ticketId,
  });
}

// ---------------------------------------------------------------------------
// Admin hooks
// ---------------------------------------------------------------------------

/**
 * Fetch all damage claims for the admin panel, with optional status filter.
 */
export function useAdminDamageClaims(status?: string, page = 1) {
  return useQuery({
    queryKey: ['admin', 'damage-claims', status, page],
    queryFn: async () => {
      const params: Record<string, string | number> = { page };
      if (status) params.status = status;
      const { data } = await api.get<DamageClaimListResponse>('/damage-claims/admin', { params });
      return data;
    },
  });
}

/**
 * Fetch full details for a single claim (admin).
 */
export function useAdminDamageClaim(claimId: number | null) {
  return useQuery({
    queryKey: ['admin', 'damage-claims', claimId],
    queryFn: async () => {
      const { data } = await api.get<DamageClaim>(`/damage-claims/admin/${claimId}`);
      return data;
    },
    enabled: !!claimId,
  });
}

/**
 * Update claim status and optional admin notes (admin).
 */
export function useUpdateDamageClaimStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      status,
      admin_notes,
    }: {
      id: number;
      status: string;
      admin_notes?: string;
    }) => {
      const { data } = await api.patch<DamageClaim>(`/damage-claims/admin/${id}`, {
        status,
        admin_notes,
      });
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'damage-claims'] });
    },
  });
}
