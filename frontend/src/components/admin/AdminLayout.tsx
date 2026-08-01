import { useState } from 'react';
import { Link, Outlet, useLocation, Navigate } from 'react-router-dom';
import { FolderTree, Image, LayoutDashboard, MoreHorizontal, Package, ShoppingCart, Users, X, FileText, Briefcase, Tag, Settings, PlaySquare, ShieldAlert } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';

const NAV = [
  { to: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/admin/products', icon: Package, label: 'Products' },
  { to: '/admin/categories', icon: FolderTree, label: 'Categories' },
  { to: '/admin/orders', icon: ShoppingCart, label: 'Orders' },
  { to: '/admin/users', icon: Users, label: 'Users' },
  { to: '/admin/banners', icon: Image, label: 'Banners' },
  { to: '/admin/stories', icon: PlaySquare, label: 'Stories' },
  { to: '/admin/blog', icon: FileText, label: 'Blog' },
  { to: '/admin/corporate', icon: Briefcase, label: 'Inquiries' },
  { to: '/admin/damage-claims', icon: ShieldAlert, label: 'Damage Claims' },
  { to: '/admin/coupons', icon: Tag, label: 'Coupons' },
  { to: '/admin/settings', icon: Settings, label: 'Settings' },
];

const MOBILE_TABS = NAV.slice(0, 3); // Dashboard, Products, Categories
const MORE_ITEMS = NAV.slice(3); // Orders, Users, Banners, Blog, Corporate, Coupons, Settings

export default function AdminLayout() {
  const { user } = useAuthStore();
  const { pathname } = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  useBodyScrollLock(moreOpen);

  if (!user?.is_admin) return <Navigate to="/" replace />;

  function isActive(to: string) {
    return pathname === to || (to !== '/admin' && pathname.startsWith(to));
  }

  return (
    <div className="flex min-h-[calc(100vh-8rem)]">
      {/* Desktop sidebar */}
      <aside className="w-56 shrink-0 bg-white border-r hidden md:block">
        <div className="p-4 border-b">
          <h2 className="font-bold text-primary text-sm uppercase tracking-wider">Admin Panel</h2>
        </div>
        <nav className="p-2 space-y-0.5">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className={`flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition ${isActive(n.to) ? 'bg-primary-light/10 text-primary font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              <n.icon size={18} />{n.label}
            </Link>
          ))}
        </nav>
      </aside>

      {/* Mobile bottom tab bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t z-40 safe-bottom">
        <div className="flex items-center justify-around h-14">
          {MOBILE_TABS.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className={`flex flex-col items-center justify-center gap-0.5 w-16 touch-target ${isActive(n.to) ? 'text-primary' : 'text-gray-400'}`}
            >
              <n.icon size={20} strokeWidth={isActive(n.to) ? 2.5 : 1.5} />
              <span className="text-[10px] font-medium">{n.label}</span>
            </Link>
          ))}
          <button
            onClick={() => setMoreOpen(true)}
            className={`flex flex-col items-center justify-center gap-0.5 w-16 touch-target ${MORE_ITEMS.some((m) => isActive(m.to)) ? 'text-primary' : 'text-gray-400'}`}
          >
            <MoreHorizontal size={20} />
            <span className="text-[10px] font-medium">More</span>
          </button>
        </div>
      </div>

      {/* More sheet */}
      {moreOpen && (
        <>
          <div className="fixed inset-0 bg-black/40 z-50 md:hidden" onClick={() => setMoreOpen(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl shadow-2xl md:hidden safe-bottom">
            <div className="flex items-center justify-between p-4 border-b">
              <span className="font-bold text-sm">More</span>
              <button onClick={() => setMoreOpen(false)} className="p-2 touch-target"><X size={18} /></button>
            </div>
            <div className="p-4 space-y-1">
              {MORE_ITEMS.map((n) => (
                <Link
                  key={n.to}
                  to={n.to}
                  onClick={() => setMoreOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 text-sm rounded-lg transition touch-target ${isActive(n.to) ? 'bg-primary-light/10 text-primary font-medium' : 'text-gray-600 hover:bg-gray-50'}`}
                >
                  <n.icon size={18} />{n.label}
                </Link>
              ))}
            </div>
          </div>
        </>
      )}

      <main className="flex-1 p-3 sm:p-6 bg-gray-50/50 overflow-auto mb-16 md:mb-0">
        <Outlet />
      </main>
    </div>
  );
}
