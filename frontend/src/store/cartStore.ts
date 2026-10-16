import { create } from 'zustand';
import api from '@/lib/api';
import type { Cart, CartItem, Product } from '@/types';

const CART_SESSION_KEY = 'cart_session_id';
const pendingRemovals = new Set<number>();

function isNotFoundError(err: unknown): boolean {
  const detail =
    typeof err === 'object' &&
    err !== null &&
    'response' in err &&
    typeof (err as { response?: { data?: { detail?: unknown } } }).response?.data?.detail === 'string'
      ? ((err as { response: { data: { detail: string } } }).response.data.detail as string)
      : '';
  return detail.toLowerCase().includes('not found');
}

function persistGuestSession(data: Cart) {
  if (data.session_id) {
    localStorage.setItem(CART_SESSION_KEY, data.session_id);
  }
}

interface CartState {
  items: CartItem[];
  total: number;
  itemCount: number;
  cartId: number | null;
  isDrawerOpen: boolean;
  lastAddedProduct: Product | null;
  openDrawer: () => void;
  closeDrawer: () => void;
  fetchCart: () => Promise<void>;
  addItem: (
    productId: number,
    quantity?: number,
    product?: Product,
    // New format: string[] of option IDs. Old format: Record<string, string>. Both supported.
    selectedOptions?: string[] | Record<string, string> | null,
  ) => Promise<void>;
  updateItem: (itemId: number, quantity: number) => Promise<void>;
  removeItem: (itemId: number) => Promise<void>;
  mergeCart: (sessionId: string) => Promise<void>;
  clearLocal: () => void;
}

function applyCart(data: Cart) {
  return {
    items: data.items,
    total: data.subtotal,
    itemCount: data.item_count,
    cartId: data.id,
  };
}

export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  total: 0,
  itemCount: 0,
  cartId: null,
  isDrawerOpen: false,
  lastAddedProduct: null,

  openDrawer: () => set({ isDrawerOpen: true }),
  closeDrawer: () => set({ isDrawerOpen: false, lastAddedProduct: null }),

  fetchCart: async () => {
    try {
      const { data } = await api.get<Cart>('/cart');
      persistGuestSession(data);
      set(applyCart(data));
    } catch {
      // ignore
    }
  },

  addItem: async (productId, quantity = 1, product, selectedOptions = null) => {
    const { data } = await api.post<Cart>('/cart/items', {
      product_id: productId,
      quantity,
      selected_options: selectedOptions,
    });
    persistGuestSession(data);
    set({
      ...applyCart(data),
      isDrawerOpen: true,
      lastAddedProduct: product ?? null,
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  updateItem: async (itemId, quantity) => {
    const previousState = { items: get().items, total: get().total, itemCount: get().itemCount };

    // Optimistic update
    const newItems = previousState.items.map((i) =>
      i.id === itemId
        ? { ...i, quantity, line_total: i.unit_price * quantity }
        : i
    );
    set({
      items: newItems,
      total: newItems.reduce((sum, i) => sum + i.line_total, 0),
      itemCount: newItems.reduce((sum, i) => sum + i.quantity, 0),
    });

    try {
      const { data } = await api.put<Cart>(`/cart/items/${itemId}`, { quantity });
      persistGuestSession(data);
      set(applyCart(data));
    } catch (err) {
      set(previousState);
      throw err;
    }
  },

  removeItem: async (itemId) => {
    if (pendingRemovals.has(itemId)) return;
    pendingRemovals.add(itemId);

    const previousState = { items: get().items, total: get().total, itemCount: get().itemCount };

    const newItems = previousState.items.filter((i) => i.id !== itemId);
    set({
      items: newItems,
      total: newItems.reduce((sum, i) => sum + i.line_total, 0),
      itemCount: newItems.reduce((sum, i) => sum + i.quantity, 0),
    });

    try {
      const { data } = await api.delete<Cart>(`/cart/items/${itemId}`);
      persistGuestSession(data);
      set(applyCart(data));
    } catch (err) {
      try {
        const { data } = await api.get<Cart>('/cart');
        persistGuestSession(data);
        set(applyCart(data));
      } catch {
        if (!isNotFoundError(err)) {
          set(previousState);
        }
      }
      if (!isNotFoundError(err)) throw err;
    } finally {
      pendingRemovals.delete(itemId);
    }
  },

  mergeCart: async (sessionId) => {
    try {
      const { data } = await api.post<Cart>('/cart/merge', { session_id: sessionId });
      localStorage.removeItem(CART_SESSION_KEY);
      set(applyCart(data));
    } catch {
      // ignore
    }
  },

  clearLocal: () => set({ items: [], total: 0, itemCount: 0, cartId: null }),
}));
