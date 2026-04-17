import { Link, Outlet, useLocation, Navigate } from 'react-router-dom';
import { BarChart3, FolderTree, LayoutDashboard, Package, ShoppingCart, Users } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

const NAV = [
  { to: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/admin/products', icon: Package, label: 'Products' },
  { to: '/admin/categories', icon: FolderTree, label: 'Categories' },
  { to: '/admin/orders', icon: ShoppingCart, label: 'Orders' },
  { to: '/admin/users', icon: Users, label: 'Users' },
];

export default function AdminLayout() {
  const { user } = useAuthStore();
  const { pathname } = useLocation();

  if (!user?.is_admin) return <Navigate to="/" replace />;

  return (
    <div className="flex min-h-[calc(100vh-8rem)]">
      <aside className="w-56 shrink-0 bg-white border-r hidden md:block">
        <div className="p-4 border-b">
          <h2 className="font-bold text-primary text-sm uppercase tracking-wider">Admin Panel</h2>
        </div>
        <nav className="p-2 space-y-0.5">
          {NAV.map((n) => {
            const active = pathname === n.to || (n.to !== '/admin' && pathname.startsWith(n.to));
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition ${
                  active ? 'bg-primary-light/10 text-primary font-medium' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <n.icon size={18} />
                {n.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Mobile nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t z-40 flex justify-around py-2">
        {NAV.map((n) => {
          const active = pathname === n.to || (n.to !== '/admin' && pathname.startsWith(n.to));
          return (
            <Link key={n.to} to={n.to} className={`flex flex-col items-center gap-0.5 text-[10px] ${active ? 'text-primary font-medium' : 'text-gray-400'}`}>
              <n.icon size={18} />
              {n.label}
            </Link>
          );
        })}
      </div>

      <main className="flex-1 p-6 bg-gray-50/50 overflow-auto mb-16 md:mb-0">
        <Outlet />
      </main>
    </div>
  );
}
