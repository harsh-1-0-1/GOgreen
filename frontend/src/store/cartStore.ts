import { create } from 'zustand';
import api from '@/lib/api';
import type { Cart, CartItem, Product } from '@/types';

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
    selectedOptions?: Record<string, string> | null,
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
    set({
      ...applyCart(data),
      isDrawerOpen: true,
      lastAddedProduct: product ?? null,
    });
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
      set(applyCart(data));
    } catch (err) {
      set(previousState);
      throw err;
    }
  },

  removeItem: async (itemId) => {
    const previousState = { items: get().items, total: get().total, itemCount: get().itemCount };

    // Optimistic update
    const newItems = previousState.items.filter((i) => i.id !== itemId);
    set({
      items: newItems,
      total: newItems.reduce((sum, i) => sum + i.line_total, 0),
      itemCount: newItems.reduce((sum, i) => sum + i.quantity, 0),
    });

    try {
      const { data } = await api.delete<Cart>(`/cart/items/${itemId}`);
      set(applyCart(data));
    } catch (err) {
      set(previousState);
      throw err;
    }
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
