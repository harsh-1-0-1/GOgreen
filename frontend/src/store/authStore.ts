import { create } from 'zustand';
import api from '@/lib/api';
import type { User, TokenResponse } from '@/types';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  isAuthModalOpen: boolean;
  openAuthModal: () => void;
  closeAuthModal: () => void;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, full_name: string, phone?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  fetchUser: () => Promise<void>;
  setTokens: (data: TokenResponse) => void;
  hydrateFromStorage: () => void;
  guestCheckoutAuth: (email: string, full_name: string, phone?: string) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: localStorage.getItem('access_token'),
  isLoading: false,
  isAuthModalOpen: false,

  openAuthModal: () => set({ isAuthModalOpen: true }),
  closeAuthModal: () => set({ isAuthModalOpen: false }),

  setTokens: (data) => {
    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('refresh_token', data.refresh_token);
    set({ accessToken: data.access_token });
  },

  hydrateFromStorage: () => {
    const token = localStorage.getItem('access_token');
    if (token) {
      set({ accessToken: token });
      get().fetchUser();
    }
  },

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const { data } = await api.post<TokenResponse>('/auth/login', { email, password });
      get().setTokens(data);
      await get().fetchUser();
      set({ isAuthModalOpen: false });
    } finally {
      set({ isLoading: false });
    }
  },

  register: async (email, password, full_name, phone) => {
    set({ isLoading: true });
    try {
      const { data } = await api.post<TokenResponse>('/auth/register', {
        email, password, full_name, phone,
      });
      get().setTokens(data);
      await get().fetchUser();
      set({ isAuthModalOpen: false });
    } finally {
      set({ isLoading: false });
    }
  },

  logout: async () => {
    try {
      await api.post('/auth/logout', {
        refresh_token: localStorage.getItem('refresh_token'),
      });
    } catch {
      // ignore
    }
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    set({ user: null, accessToken: null });
  },

  refreshToken: async () => {
    const refresh = localStorage.getItem('refresh_token');
    if (!refresh) return;
    try {
      const { data } = await api.post<TokenResponse>('/auth/refresh', {
        refresh_token: refresh,
      });
      get().setTokens(data);
    } catch {
      get().logout();
    }
  },

  fetchUser: async () => {
    try {
      const { data } = await api.get<User>('/auth/me');
      set({ user: data });
    } catch {
      set({ user: null });
    }
  },

  guestCheckoutAuth: async (email, full_name, phone) => {
    set({ isLoading: true });
    try {
      const { data } = await api.post<TokenResponse>('/auth/guest', {
        email,
        full_name,
        phone,
      });
      get().setTokens(data);
      await get().fetchUser();
      
      const sessionId = localStorage.getItem('cart_session_id');
      if (sessionId) {
        const { useCartStore } = await import('./cartStore');
        await useCartStore.getState().mergeCart(sessionId);
      }
    } finally {
      set({ isLoading: false });
    }
  },
}));
