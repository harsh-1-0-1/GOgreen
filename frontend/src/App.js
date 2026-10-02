import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
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
import CorporateGiftingPage from '@/pages/CorporateGiftingPage';
import DamageReplacementPage from '@/pages/DamageReplacementPage';
import MyDamageClaimsPage from '@/pages/MyDamageClaimsPage';
import FaqPage from '@/pages/FaqPage';
import AdminLayout from '@/components/admin/AdminLayout';
import DashboardPage from '@/pages/admin/DashboardPage';
import ProductsAdminPage from '@/pages/admin/ProductsAdminPage';
import CategoriesAdminPage from '@/pages/admin/CategoriesAdminPage';
import ImageBadgesAdminPage from '@/pages/admin/ImageBadgesAdminPage';
import OrdersAdminPage from '@/pages/admin/OrdersAdminPage';
import UsersAdminPage from '@/pages/admin/UsersAdminPage';
import BannersAdminPage from '@/pages/admin/BannersAdminPage';
import BlogAdminPage from '@/pages/admin/BlogAdminPage';
import StoriesAdminPage from '@/pages/admin/StoriesAdminPage';
import CorporateAdminPage from '@/pages/admin/CorporateAdminPage';
import CouponsAdminPage from '@/pages/admin/CouponsAdminPage';
import DamageClaimsAdminPage from '@/pages/admin/DamageClaimsAdminPage';
import DoNotForgetAdminPage from '@/pages/admin/DoNotForgetAdminPage';
import MenuAdminPage from '@/pages/admin/MenuAdminPage';
import DisplaySectionsAdminPage from '@/pages/admin/DisplaySectionsAdminPage';
import SettingsAdminPage from '@/pages/admin/SettingsAdminPage';
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
    return (_jsx(QueryClientProvider, { client: queryClient, children: _jsxs(BrowserRouter, { children: [_jsx(AppInit, {}), _jsx(ScrollToTop, {}), _jsx(ScrollToHashElement, {}), _jsx(Toaster, { position: "top-right", toastOptions: {
                        duration: 3000,
                        style: { borderRadius: '12px', fontSize: '14px' },
                        success: { iconTheme: { primary: '#2D6A4F', secondary: '#fff' } },
                    } }), _jsx(ErrorBoundary, { children: _jsxs(Routes, { children: [_jsxs(Route, { element: _jsx(Layout, {}), children: [_jsx(Route, { path: "/", element: _jsx(HomePage, {}) }), _jsx(Route, { path: "/products", element: _jsx(ProductsPage, {}) }), _jsx(Route, { path: "/products/:slug", element: _jsx(ProductDetailPage, {}) }), _jsx(Route, { path: "/cart", element: _jsx(CartPage, {}) }), _jsx(Route, { path: "/checkout", element: _jsx(CheckoutPage, {}) }), _jsx(Route, { path: "/orders", element: _jsx(OrdersPage, {}) }), _jsx(Route, { path: "/orders/:id", element: _jsx(OrderDetailPage, {}) }), _jsx(Route, { path: "/blog", element: _jsx(BlogListPage, {}) }), _jsx(Route, { path: "/blog/:slug", element: _jsx(BlogDetailPage, {}) }), _jsx(Route, { path: "/corporate-gifting", element: _jsx(CorporateGiftingPage, {}) }), _jsx(Route, { path: "/damage-replacement", element: _jsx(DamageReplacementPage, {}) }), _jsx(Route, { path: "/damage-claims", element: _jsx(MyDamageClaimsPage, {}) }), _jsx(Route, { path: "/faqs", element: _jsx(FaqPage, {}) }), _jsx(Route, { path: "*", element: _jsx(NotFoundPage, {}) })] }), _jsx(Route, { element: _jsx(Layout, {}), children: _jsxs(Route, { path: "/admin", element: _jsx(AdminLayout, {}), children: [_jsx(Route, { index: true, element: _jsx(DashboardPage, {}) }), _jsx(Route, { path: "products", element: _jsx(ProductsAdminPage, {}) }), _jsx(Route, { path: "categories", element: _jsx(CategoriesAdminPage, {}) }), _jsx(Route, { path: "badges", element: _jsx(ImageBadgesAdminPage, {}) }), _jsx(Route, { path: "orders", element: _jsx(OrdersAdminPage, {}) }), _jsx(Route, { path: "users", element: _jsx(UsersAdminPage, {}) }), _jsx(Route, { path: "banners", element: _jsx(BannersAdminPage, {}) }), _jsx(Route, { path: "stories", element: _jsx(StoriesAdminPage, {}) }), _jsx(Route, { path: "blog", element: _jsx(BlogAdminPage, {}) }), _jsx(Route, { path: "corporate", element: _jsx(CorporateAdminPage, {}) }), _jsx(Route, { path: "coupons", element: _jsx(CouponsAdminPage, {}) }), _jsx(Route, { path: "damage-claims", element: _jsx(DamageClaimsAdminPage, {}) }), _jsx(Route, { path: "do-not-forget", element: _jsx(DoNotForgetAdminPage, {}) }), _jsx(Route, { path: "navigation", element: _jsx(MenuAdminPage, {}) }), _jsx(Route, { path: "display-sections", element: _jsx(DisplaySectionsAdminPage, {}) }), _jsx(Route, { path: "settings", element: _jsx(SettingsAdminPage, {}) })] }) })] }) })] }) }));
}
