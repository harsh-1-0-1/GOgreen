import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, LayoutGrid, TrendingUp, UserCircle } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

const NAV_ITEMS = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/products', icon: LayoutGrid, label: 'Collections' },
  { to: '/products?sort_by=popular', icon: TrendingUp, label: 'Trending' },
  { to: '/account', icon: UserCircle, label: 'Account' },
];

export default function BottomNav() {
  const { pathname, search } = useLocation();
  const { user, openAuthModal } = useAuthStore();
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [visible, setVisible] = useState(true);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    function onResize() {
      setKeyboardOpen(vv!.height < window.innerHeight * 0.75);
    }
    vv.addEventListener('resize', onResize);
    return () => vv.removeEventListener('resize', onResize);
  }, []);

  const handleScroll = useCallback(() => {
    const currentY = window.scrollY;
    if (currentY < 100) {
      setVisible(true);
    } else {
      const diff = currentY - lastScrollY.current;
      if (diff > 10) setVisible(false);
      else if (diff < -10) setVisible(true);
    }
    lastScrollY.current = currentY;
  }, []);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  if (keyboardOpen) return null;
  if (pathname.startsWith('/admin')) return null;

  const fullPath = pathname + search;

  function isActive(to: string) {
    if (to === '/') return pathname === '/';
    if (to.includes('?')) return fullPath === to;
    return pathname.startsWith(to);
  }

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-100 safe-bottom transition-transform duration-300"
      style={{ transform: visible ? 'translateY(0)' : 'translateY(100%)' }}
    >
      <div className="flex items-center justify-around h-[58px]">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.to);
          const isAccount = item.to === '/account';

          if (isAccount) {
            return (
              <button
                key={item.to}
                onClick={() =>
                  user ? (window.location.href = '/orders') : openAuthModal()
                }
                className="flex flex-col items-center justify-center gap-0.5 flex-1 touch-target"
              >
                <item.icon
                  size={22}
                  strokeWidth={active ? 2.5 : 1.5}
                  className={active ? 'text-secondary' : 'text-gray-400'}
                />
                <span
                  className={`text-[10px] font-medium ${active ? 'text-secondary' : 'text-gray-400'}`}
                >
                  {item.label}
                </span>
              </button>
            );
          }

          return (
            <Link
              key={item.to}
              to={item.to}
              className="flex flex-col items-center justify-center gap-0.5 flex-1 touch-target"
            >
              <item.icon
                size={22}
                strokeWidth={active ? 2.5 : 1.5}
                className={active ? 'text-secondary' : 'text-gray-400'}
              />
              <span
                className={`text-[10px] font-medium ${active ? 'text-secondary' : 'text-gray-400'}`}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
