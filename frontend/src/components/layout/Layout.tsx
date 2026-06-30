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

  return (
    <div className="flex flex-col min-h-screen overflow-x-clip">
      <AnnouncementBar />
      <Navbar />
      <PageBanner />
      <main className="flex-1 pb-16 md:pb-0">
        <Outlet />
      </main>
      <Footer />
      <BottomNav />
      <CartDrawer />
      <AuthModal />
      {showWhatsApp && <FloatingWhatsAppButton />}
    </div>
  );
}
