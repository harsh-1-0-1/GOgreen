import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Leaf, ShoppingBag, UserCircle } from 'lucide-react';
import { useCartStore } from '@/store/cartStore';
import { useAuthStore } from '@/store/authStore';

const NAV_ITEMS = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/products', icon: Leaf, label: 'Shop' },
  { to: '/cart', icon: ShoppingBag, label: 'Cart' },
  { to: '/account', icon: UserCircle, label: 'Account' },
];

export default function BottomNav() {
  const { pathname } = useLocation();
  const itemCount = useCartStore((s) => s.itemCount);
  const { user, openAuthModal } = useAuthStore();
  const [visible, setVisible] = useState(true);

  // Hide when virtual keyboard opens (viewport shrinks)
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    function onResize() {
      setVisible(vv!.height > window.innerHeight * 0.75);
    }
    vv.addEventListener('resize', onResize);
    return () => vv.removeEventListener('resize', onResize);
  }, []);

  if (!visible) return null;
  // Hide on admin pages
  if (pathname.startsWith('/admin')) return null;

  function isActive(to: string) {
    if (to === '/') return pathname === '/';
    return pathname.startsWith(to);
  }

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 safe-bottom">
      <div className="flex items-center justify-around h-14">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.to);
          const isAccount = item.to === '/account';

          if (isAccount) {
            const dest = user ? '/orders' : undefined;
            return (
              <button
                key={item.to}
                onClick={() => dest ? window.location.href = dest : openAuthModal()}
                className={`flex flex-col items-center justify-center gap-0.5 w-16 touch-target ${active ? 'text-primary' : 'text-gray-400'}`}
              >
                <item.icon size={22} strokeWidth={active ? 2.5 : 1.5} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </button>
            );
          }

          return (
            <Link
              key={item.to}
              to={item.to}
              className={`relative flex flex-col items-center justify-center gap-0.5 w-16 touch-target ${active ? 'text-primary' : 'text-gray-400'}`}
            >
              <item.icon size={22} strokeWidth={active ? 2.5 : 1.5} />
              {item.to === '/cart' && itemCount > 0 && (
                <span className="absolute top-0.5 right-2 bg-accent text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {itemCount > 9 ? '9+' : itemCount}
                </span>
              )}
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
