import { useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { useAuthStore } from '@/store/authStore';
import { useCartStore } from '@/store/cartStore';

import Layout from '@/components/layout/Layout';
import ErrorBoundary from '@/components/ui/ErrorBoundary';

import HomePage from '@/pages/HomePage';
import ProductsPage from '@/pages/ProductsPage';
import ProductDetailPage from '@/pages/ProductDetailPage';
import CartPage from '@/pages/CartPage';
import CheckoutPage from '@/pages/CheckoutPage';
import OrdersPage from '@/pages/OrdersPage';
import OrderDetailPage from '@/pages/OrderDetailPage';
import NotFoundPage from '@/pages/NotFoundPage';
import BlogListPage from '@/pages/BlogListPage';
import BlogDetailPage from '@/pages/BlogDetailPage';

import AdminLayout from '@/components/admin/AdminLayout';
import DashboardPage from '@/pages/admin/DashboardPage';
import ProductsAdminPage from '@/pages/admin/ProductsAdminPage';
import CategoriesAdminPage from '@/pages/admin/CategoriesAdminPage';
import OrdersAdminPage from '@/pages/admin/OrdersAdminPage';
import UsersAdminPage from '@/pages/admin/UsersAdminPage';
import BannersAdminPage from '@/pages/admin/BannersAdminPage';

function AppInit() {
  const hydrateFromStorage = useAuthStore((s) => s.hydrateFromStorage);
  const fetchCart = useCartStore((s) => s.fetchCart);

  useEffect(() => {
    hydrateFromStorage();
    fetchCart();
  }, [hydrateFromStorage, fetchCart]);

  return null;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppInit />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: { borderRadius: '12px', fontSize: '14px' },
            success: { iconTheme: { primary: '#2D6A4F', secondary: '#fff' } },
          }}
        />
        <ErrorBoundary>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/products" element={<ProductsPage />} />
              <Route path="/products/:slug" element={<ProductDetailPage />} />
              <Route path="/cart" element={<CartPage />} />
              <Route path="/checkout" element={<CheckoutPage />} />
              <Route path="/orders" element={<OrdersPage />} />
              <Route path="/orders/:id" element={<OrderDetailPage />} />
              <Route path="/blog" element={<BlogListPage />} />
              <Route path="/blog/:slug" element={<BlogDetailPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
            <Route element={<Layout />}>
              <Route path="/admin" element={<AdminLayout />}>
                <Route index element={<DashboardPage />} />
                <Route path="products" element={<ProductsAdminPage />} />
                <Route path="categories" element={<CategoriesAdminPage />} />
                <Route path="orders" element={<OrdersAdminPage />} />
                <Route path="users" element={<UsersAdminPage />} />
                <Route path="banners" element={<BannersAdminPage />} />
              </Route>
            </Route>
          </Routes>
        </ErrorBoundary>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
