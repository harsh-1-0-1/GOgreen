import { create } from 'zustand';
import api from '@/lib/api';
import type { Cart, CartItem } from '@/types';

interface CartState {
  items: CartItem[];
  total: number;
  itemCount: number;
  cartId: number | null;
  isDrawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  fetchCart: () => Promise<void>;
  addItem: (productId: number, quantity?: number) => Promise<void>;
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

export const useCartStore = create<CartState>((set) => ({
  items: [],
  total: 0,
  itemCount: 0,
  cartId: null,
  isDrawerOpen: false,

  openDrawer: () => set({ isDrawerOpen: true }),
  closeDrawer: () => set({ isDrawerOpen: false }),

  fetchCart: async () => {
    try {
      const { data } = await api.get<Cart>('/cart');
      set(applyCart(data));
    } catch {
      // ignore
    }
  },

  addItem: async (productId, quantity = 1) => {
    const { data } = await api.post<Cart>('/cart/items', {
      product_id: productId,
      quantity,
    });
    set({ ...applyCart(data), isDrawerOpen: true });
  },

  updateItem: async (itemId, quantity) => {
    const { data } = await api.put<Cart>(`/cart/items/${itemId}`, { quantity });
    set(applyCart(data));
  },

  removeItem: async (itemId) => {
    const { data } = await api.delete<Cart>(`/cart/items/${itemId}`);
    set(applyCart(data));
  },

  mergeCart: async (sessionId) => {
    try {
      const { data } = await api.post<Cart>('/cart/merge', { session_id: sessionId });
      set(applyCart(data));
    } catch {
      // ignore
    }
  },

  clearLocal: () => set({ items: [], total: 0, itemCount: 0, cartId: null }),
}));
