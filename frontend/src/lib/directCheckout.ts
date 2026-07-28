import type { Product } from '@/types';

export const DIRECT_CHECKOUT_KEY = 'plantoga_direct_checkout';

export interface DirectCheckoutItem {
  product_id: number;
  quantity: number;
  // New format: string[] of option IDs. Old format: Record<string, string>. Both supported.
  selected_options: string[] | Record<string, string> | null;
  product: Product;
  unit_price: number;
  line_total: number;
  resolved_image_url: string;
}

export interface DirectCheckoutSession {
  mode: 'buy-now';
  created_at: number;
  items: DirectCheckoutItem[];
}

export function saveDirectCheckoutSession(session: DirectCheckoutSession) {
  sessionStorage.setItem(DIRECT_CHECKOUT_KEY, JSON.stringify(session));
}

export function readDirectCheckoutSession(): DirectCheckoutSession | null {
  const raw = sessionStorage.getItem(DIRECT_CHECKOUT_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as DirectCheckoutSession;
    if (parsed.mode !== 'buy-now' || !Array.isArray(parsed.items) || parsed.items.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearDirectCheckoutSession() {
  sessionStorage.removeItem(DIRECT_CHECKOUT_KEY);
}
