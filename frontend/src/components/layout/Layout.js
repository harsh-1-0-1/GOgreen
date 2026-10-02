import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Outlet, useLocation } from 'react-router-dom';
import AnnouncementBar from './AnnouncementBar';
import Navbar from './Navbar';
import PageBanner from './PageBanner';
import Footer from './Footer';
import BottomNav from './BottomNav';
import CartDrawer from '@/components/cart/CartDrawer';
import AuthModal from '@/components/auth/AuthModal';
import FloatingWhatsAppButton from '@/components/corporate/FloatingWhatsAppButton';
export default function Layout() {
    const location = useLocation();
    const showWhatsApp = !location.pathname.startsWith('/admin');
    return (_jsxs("div", { className: "flex flex-col min-h-screen overflow-x-clip", children: [_jsx(AnnouncementBar, {}), _jsx(Navbar, {}), _jsx(PageBanner, {}), _jsx("main", { className: "flex-1 pb-16 md:pb-0", children: _jsx(Outlet, {}) }), _jsx(Footer, {}), _jsx(BottomNav, {}), _jsx(CartDrawer, {}), _jsx(AuthModal, {}), showWhatsApp && _jsx(FloatingWhatsAppButton, {})] }));
}
