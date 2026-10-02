import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { Link, Outlet, useLocation, Navigate } from 'react-router-dom';
import { FolderTree, Image, LayoutDashboard, List, MoreHorizontal, Package, ShoppingCart, Users, X, FileText, Briefcase, Tag, Settings, PlaySquare, ShieldAlert, AlertCircle, Menu as MenuIcon, Award } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
const NAV = [
    { to: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/admin/products', icon: Package, label: 'Products' },
    { to: '/admin/categories', icon: FolderTree, label: 'Categories' },
    { to: '/admin/badges', icon: Award, label: 'Image Badges' },
    { to: '/admin/orders', icon: ShoppingCart, label: 'Orders' },
    { to: '/admin/users', icon: Users, label: 'Users' },
    { to: '/admin/banners', icon: Image, label: 'Banners' },
    { to: '/admin/stories', icon: PlaySquare, label: 'Stories' },
    { to: '/admin/blog', icon: FileText, label: 'Blog' },
    { to: '/admin/corporate', icon: Briefcase, label: 'Inquiries' },
    { to: '/admin/damage-claims', icon: ShieldAlert, label: 'Damage Claims' },
    { to: '/admin/do-not-forget', icon: AlertCircle, label: 'Do Not Forget' },
    { to: '/admin/navigation', icon: MenuIcon, label: 'Navigation' },
    { to: '/admin/display-sections', icon: List, label: 'Display Sections' },
    { to: '/admin/coupons', icon: Tag, label: 'Coupons' },
    { to: '/admin/settings', icon: Settings, label: 'Settings' },
];
const MOBILE_TABS = NAV.slice(0, 3); // Dashboard, Products, Categories
const MORE_ITEMS = NAV.slice(3);
export default function AdminLayout() {
    const { user } = useAuthStore();
    const { pathname } = useLocation();
    const [moreOpen, setMoreOpen] = useState(false);
    useBodyScrollLock(moreOpen);
    if (!user?.is_admin)
        return _jsx(Navigate, { to: "/", replace: true });
    function isActive(to) {
        return pathname === to || (to !== '/admin' && pathname.startsWith(to));
    }
    return (_jsxs("div", { className: "flex min-h-[calc(100vh-8rem)]", children: [_jsxs("aside", { className: "w-56 shrink-0 bg-white border-r hidden md:block", children: [_jsx("div", { className: "p-4 border-b", children: _jsx("h2", { className: "font-bold text-primary text-sm uppercase tracking-wider", children: "Admin Panel" }) }), _jsx("nav", { className: "p-2 space-y-0.5", children: NAV.map((n) => (_jsxs(Link, { to: n.to, className: `flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition ${isActive(n.to) ? 'bg-primary-light/10 text-primary font-medium' : 'text-gray-600 hover:bg-gray-50'}`, children: [_jsx(n.icon, { size: 18 }), n.label] }, n.to))) })] }), _jsx("div", { className: "md:hidden fixed bottom-0 left-0 right-0 bg-white border-t z-40 safe-bottom", children: _jsxs("div", { className: "flex items-center justify-around h-14", children: [MOBILE_TABS.map((n) => (_jsxs(Link, { to: n.to, className: `flex flex-col items-center justify-center gap-0.5 w-16 touch-target ${isActive(n.to) ? 'text-primary' : 'text-gray-400'}`, children: [_jsx(n.icon, { size: 20, strokeWidth: isActive(n.to) ? 2.5 : 1.5 }), _jsx("span", { className: "text-[10px] font-medium", children: n.label })] }, n.to))), _jsxs("button", { onClick: () => setMoreOpen(true), className: `flex flex-col items-center justify-center gap-0.5 w-16 touch-target ${MORE_ITEMS.some((m) => isActive(m.to)) ? 'text-primary' : 'text-gray-400'}`, children: [_jsx(MoreHorizontal, { size: 20 }), _jsx("span", { className: "text-[10px] font-medium", children: "More" })] })] }) }), moreOpen && (_jsxs(_Fragment, { children: [_jsx("div", { className: "fixed inset-0 bg-black/40 z-50 md:hidden", onClick: () => setMoreOpen(false) }), _jsxs("div", { className: "fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl md:hidden safe-bottom", children: [_jsxs("div", { className: "flex items-center justify-between p-4 border-b", children: [_jsx("span", { className: "font-bold text-sm", children: "More" }), _jsx("button", { onClick: () => setMoreOpen(false), className: "p-2 touch-target", children: _jsx(X, { size: 18 }) })] }), _jsx("div", { className: "p-4 space-y-1", children: MORE_ITEMS.map((n) => (_jsxs(Link, { to: n.to, onClick: () => setMoreOpen(false), className: `flex items-center gap-3 px-4 py-3 text-sm rounded-lg transition touch-target ${isActive(n.to) ? 'bg-primary-light/10 text-primary font-medium' : 'text-gray-600 hover:bg-gray-50'}`, children: [_jsx(n.icon, { size: 18 }), n.label] }, n.to))) })] })] })), _jsx("main", { className: "flex-1 p-3 sm:p-6 bg-gray-50/50 overflow-auto mb-16 md:mb-0", children: _jsx(Outlet, {}) })] }));
}
