import { lazy, Suspense, useEffect, type ComponentType } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { useAuthStore } from '@/store/authStore';
import { useCartStore } from '@/store/cartStore';

import Layout from '@/components/layout/Layout';
import ErrorBoundary from '@/components/ui/ErrorBoundary';
import Spinner from '@/components/ui/Spinner';

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
import CorporateGiftingPage from '@/pages/CorporateGiftingPage';
import DamageReplacementPage from '@/pages/DamageReplacementPage';
import MyDamageClaimsPage from '@/pages/MyDamageClaimsPage';
import FaqPage from '@/pages/FaqPage';

// Admin screens are code-split so shoppers never download them: they made up
// most of the main bundle, which every storefront visit waits on before any
// image can start loading.
const AdminLayout = lazy(() => import('@/components/admin/AdminLayout'));
const DashboardPage = lazy(() => import('@/pages/admin/DashboardPage'));
const ProductsAdminPage = lazy(() => import('@/pages/admin/ProductsAdminPage'));
const CategoriesAdminPage = lazy(() => import('@/pages/admin/CategoriesAdminPage'));
const ImageBadgesAdminPage = lazy(() => import('@/pages/admin/ImageBadgesAdminPage'));
const OrdersAdminPage = lazy(() => import('@/pages/admin/OrdersAdminPage'));
const UsersAdminPage = lazy(() => import('@/pages/admin/UsersAdminPage'));
const BannersAdminPage = lazy(() => import('@/pages/admin/BannersAdminPage'));
const BlogAdminPage = lazy(() => import('@/pages/admin/BlogAdminPage'));
const StoriesAdminPage = lazy(() => import('@/pages/admin/StoriesAdminPage'));
const CorporateAdminPage = lazy(() => import('@/pages/admin/CorporateAdminPage'));
const CouponsAdminPage = lazy(() => import('@/pages/admin/CouponsAdminPage'));
const DamageClaimsAdminPage = lazy(() => import('@/pages/admin/DamageClaimsAdminPage'));
const DoNotForgetAdminPage = lazy(() => import('@/pages/admin/DoNotForgetAdminPage'));
const MenuAdminPage = lazy(() => import('@/pages/admin/MenuAdminPage'));
const DisplaySectionsAdminPage = lazy(() => import('@/pages/admin/DisplaySectionsAdminPage'));
const SettingsAdminPage = lazy(() => import('@/pages/admin/SettingsAdminPage'));

function withSuspense(Page: ComponentType) {
  return (
    <Suspense fallback={<Spinner className="py-24" />}>
      <Page />
    </Suspense>
  );
}

function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    // Don't override scroll when navigating to a hash anchor
    if (!hash) {
      window.scrollTo(0, 0);
    }
  }, [pathname, hash]);

  return null;
}

function ScrollToHashElement() {
  const { hash } = useLocation();

  useEffect(() => {
    if (hash) {
      const element = document.getElementById(hash.replace('#', ''));
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth' });
        }, 150);
      }
    }
  }, [hash]);

  return null;
}

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
        <ScrollToTop />
        <ScrollToHashElement />
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
              <Route path="/corporate-gifting" element={<CorporateGiftingPage />} />
              <Route path="/damage-replacement" element={<DamageReplacementPage />} />
              <Route path="/damage-claims" element={<MyDamageClaimsPage />} />
              <Route path="/faqs" element={<FaqPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
            <Route element={<Layout />}>
              <Route path="/admin" element={withSuspense(AdminLayout)}>
                <Route index element={withSuspense(DashboardPage)} />
                <Route path="products" element={withSuspense(ProductsAdminPage)} />
                <Route path="categories" element={withSuspense(CategoriesAdminPage)} />
                <Route path="badges" element={withSuspense(ImageBadgesAdminPage)} />
                <Route path="orders" element={withSuspense(OrdersAdminPage)} />
                <Route path="users" element={withSuspense(UsersAdminPage)} />
                <Route path="banners" element={withSuspense(BannersAdminPage)} />
                <Route path="stories" element={withSuspense(StoriesAdminPage)} />
                <Route path="blog" element={withSuspense(BlogAdminPage)} />
                <Route path="corporate" element={withSuspense(CorporateAdminPage)} />
                <Route path="coupons" element={withSuspense(CouponsAdminPage)} />
                <Route path="damage-claims" element={withSuspense(DamageClaimsAdminPage)} />
                <Route path="do-not-forget" element={withSuspense(DoNotForgetAdminPage)} />
                <Route path="navigation" element={withSuspense(MenuAdminPage)} />
                <Route path="display-sections" element={withSuspense(DisplaySectionsAdminPage)} />
                <Route path="settings" element={withSuspense(SettingsAdminPage)} />
              </Route>
            </Route>
          </Routes>
        </ErrorBoundary>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
