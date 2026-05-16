import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ChevronDown,
  Leaf,
  LogOut,
  Menu,
  Package,
  Search,
  Settings,
  ShoppingBag,
  User,
  X,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import api from '@/lib/api';
import { useAuthStore } from '@/store/authStore';
import { useCartStore } from '@/store/cartStore';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { useDebounce } from '@/hooks/useDebounce';
import type { ProductListResponse } from '@/types';

import { NAV_ITEMS, WHATSAPP_NUMBER } from './navData';
import type { NavItemDef } from './navData';
import { WhatsAppIcon } from './WhatsAppIcon';
import { MobileCollectionList } from './MobileCollectionList';
export default function Navbar() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  const lastScrollY = useRef(0);

  const navigate = useNavigate();
  const location = useLocation();
  const { user, openAuthModal, logout } = useAuthStore();
  const { itemCount, openDrawer } = useCartStore();

  const hoverTimeoutRef = useRef<number>(0);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const debouncedQuery = useDebounce(searchQuery, 300);
  const isHome = location.pathname === '/';

  useBodyScrollLock(drawerOpen);

  // Cleanup hover timeout on unmount
  useEffect(() => () => clearTimeout(hoverTimeoutRef.current), []);

  // Scroll-based sticky shadow and hide/show on scroll
  useEffect(() => {
    function onScroll() {
      const currentScrollY = window.scrollY;
      setScrolled(currentScrollY > 60);

      // Handle hide/show logic based on scroll direction
      if (currentScrollY < 100) {
        setHidden(false);
      } else {
        const diff = currentScrollY - lastScrollY.current;
        if (diff > 10) {
          // Scrolling down deliberately
          setHidden(true);
        } else if (diff < -10) {
          // Scrolling up deliberately
          setHidden(false);
        }
      }
      
      lastScrollY.current = currentScrollY;
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Click-outside to close search suggestions
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(e.target as Node)
      ) {
        setSearchFocused(false);
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  // Live search suggestions
  const { data: suggestions } = useQuery({
    queryKey: ['search-suggestions', debouncedQuery],
    queryFn: async () => {
      const { data } = await api.get<ProductListResponse>('/products', {
        params: { search: debouncedQuery, limit: 5 },
      });
      return data.items;
    },
    enabled: debouncedQuery.length >= 2,
  });

  const showSuggestions =
    searchFocused &&
    debouncedQuery.length >= 2 &&
    suggestions &&
    suggestions.length > 0;

  // ---- Handlers ----------------------------------------------------------

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(
        `/products?search=${encodeURIComponent(searchQuery.trim())}`,
      );
      setSearchQuery('');
      setSearchFocused(false);
      setSearchOpen(false);
      setDrawerOpen(false);
    }
  }

  function handleDropdownEnter(label: string) {
    clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = window.setTimeout(
      () => setActiveDropdown(label),
      200,
    );
  }

  function handleDropdownLeave() {
    clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = window.setTimeout(
      () => setActiveDropdown(null),
      150,
    );
  }

  function closeDrawer() {
    setDrawerOpen(false);
  }

  function isNavActive(item: NavItemDef): boolean {
    const params = new URLSearchParams(location.search);
    const currentCategory = params.get('category') || '';
    const currentTag = params.get('tag') || '';

    const [itemPath, itemSearch] = item.href.split('?');
    const itemParams = new URLSearchParams(itemSearch || '');

    if (itemParams.get('category') === currentCategory && currentCategory)
      return true;
    if (itemParams.get('tag') === currentTag && currentTag) return true;

    if (
      !item.href.startsWith('/products') &&
      location.pathname === itemPath
    )
      return true;

    if (item.groups) {
      for (const col of item.groups) {
        for (const group of col) {
          for (const link of group.links) {
            const lp = new URLSearchParams(link.href.split('?')[1] || '');
            if (lp.get('category') === currentCategory && currentCategory)
              return true;
          }
        }
      }
    }

    return false;
  }

  // ---- Render ------------------------------------------------------------

  return (
    <header
      className={clsx(
        'sticky top-0 z-50 bg-white transition-all duration-300 ease-in-out',
        scrolled && 'shadow-[0_2px_12px_rgba(0,0,0,0.08)] border-b border-gray-100',
        hidden && '-translate-y-full'
      )}
    >
      {/* ================================================================ */}
      {/* ROW 1 â€” Logo Â· Search Â· Icons (Ugaoo-style)                      */}
      {/* ================================================================ */}
      <div className="mx-auto px-4 sm:px-6 lg:px-10 xl:px-16 h-[64px] sm:h-[76px] flex items-center gap-3 sm:gap-6">

        {/* Hamburger â€” visible on every breakpoint */}
        <button
          className="p-2 -ml-1 text-gray-700 hover:text-primary transition-colors touch-target"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
        >
          <Menu size={24} />
        </button>

        {/* Logo â€” left-aligned, prominent */}
        <Link to="/" className="flex items-center gap-2.5 shrink-0 group">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-primary flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
            <Leaf size={22} className="text-white" />
          </div>
          <span className="text-2xl sm:text-[28px] font-bold text-primary tracking-tight leading-none">
            Plantoga
          </span>
        </Link>

        {/* Desktop Search â€” centered, wide pill with embedded button */}
        <div
          ref={searchContainerRef}
          className="hidden md:block flex-1 mx-auto relative"
        >
          <form onSubmit={handleSearch}>
            <div className="relative flex items-center">
              <input
                type="text"
                placeholder="Search plants, seeds, pots & more..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setSearchFocused(false);
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                className="w-full pl-5 pr-14 py-3 text-sm border-2 border-gray-200 rounded-full bg-gray-50 focus:outline-none focus:border-primary focus:bg-white transition-all duration-200 placeholder:text-gray-400 text-gray-800"
              />
              <button
                type="submit"
                className="absolute right-1.5 h-8 w-8 bg-primary hover:bg-primary/90 text-white rounded-full flex items-center justify-center transition-colors shadow-sm"
                aria-label="Search"
              >
                <Search size={15} />
              </button>
            </div>
          </form>

          {/* Suggestions dropdown */}
          {showSuggestions && (
            <div className="absolute top-full mt-2 left-0 right-0 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50 animate-dropdown">
              {suggestions!.map((product) => (
                <Link
                  key={product.id}
                  to={`/products/${product.slug}`}
                  onClick={() => {
                    setSearchFocused(false);
                    setSearchQuery('');
                  }}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
                >
                  <img
                    src={product.images?.[0] || 'https://placehold.co/40x40?text=ðŸŒ±'}
                    alt=""
                    className="w-10 h-10 rounded-xl object-cover shrink-0 bg-gray-100"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{product.name}</p>
                    <p className="text-xs text-primary font-semibold mt-0.5">â‚¹{product.price}</p>
                  </div>
                </Link>
              ))}
              <Link
                to={`/products?search=${encodeURIComponent(debouncedQuery)}`}
                onClick={() => {
                  setSearchFocused(false);
                  setSearchQuery('');
                }}
                className="flex items-center justify-center gap-2 px-4 py-3 text-sm text-primary font-semibold hover:bg-primary/5 transition-colors"
              >
                <Search size={14} /> View all results for &ldquo;{debouncedQuery}&rdquo;
              </Link>
            </div>
          )}
        </div>

        {/* Right Icons â€” clean, spaced */}
        <div className="flex items-center gap-1 ml-auto">


          {/* WhatsApp */}
          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}`}
            target="_blank"
            rel="noopener noreferrer"
            className={clsx(
              "items-center justify-center w-12 h-12 rounded-full text-green-600 hover:text-green-700 hover:bg-green-50 transition-all",
              isHome ? "flex" : "hidden sm:flex"
            )}
            aria-label="WhatsApp"
          >
            <WhatsAppIcon size={40} />
          </a>

          {/* Account */}
          {user ? (
            <div className="relative hidden md:block">
              <button
                className="flex items-center justify-center w-11 h-11 rounded-full text-gray-600 hover:text-primary hover:bg-primary/5 transition-all"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                aria-label="Account menu"
              >
                <User size={21} />
              </button>
              {userMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setUserMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 py-2 overflow-hidden animate-dropdown">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="text-sm font-semibold text-gray-900 truncate">{user.full_name || 'Account'}</p>
                      <p className="text-xs text-gray-400 truncate mt-0.5">{user.email}</p>
                    </div>
                    {user.is_admin && (
                      <Link
                        to="/admin"
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-gray-50 text-primary font-medium transition-colors"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <Settings size={15} /> Admin Panel
                      </Link>
                    )}
                    <Link
                      to="/orders"
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-gray-50 text-gray-700 transition-colors"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <Package size={15} /> My Orders
                    </Link>
                    <button
                      onClick={() => {
                        logout();
                        setUserMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-red-50 text-red-500 transition-colors"
                    >
                      <LogOut size={15} /> Logout
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <button
              className="hidden md:flex items-center justify-center w-11 h-11 rounded-full text-gray-600 hover:text-primary hover:bg-primary/5 transition-all"
              onClick={openAuthModal}
              aria-label="Login"
            >
              <User size={22} />
            </button>
          )}

          {/* Cart â€” visible on all breakpoints */}
          <button
            className="flex items-center justify-center w-10 h-10 md:w-11 md:h-11 rounded-full relative text-gray-600 hover:text-primary hover:bg-primary/5 transition-all"
            onClick={openDrawer}
            aria-label="Cart"
          >
            <ShoppingBag size={21} />
            {itemCount > 0 && (
              <span className="absolute top-0 right-0 md:top-0.5 md:right-0.5 bg-accent text-white text-[9px] font-bold w-[17px] h-[17px] rounded-full flex items-center justify-center shadow-sm">
                {itemCount > 9 ? '9+' : itemCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ================================================================ */}
      {/* ROW 2 â€” Category navigation (desktop only)                       */}
      {/* ================================================================ */}
      {/* ================================================================ */}
      {/* ROW 2 â€” Category navigation (desktop only, Ugaoo-style)          */}
      {/* ================================================================ */}
      <nav className="hidden lg:block border-t border-gray-100">
        <div className="mx-auto px-4 sm:px-6 lg:px-10 xl:px-16">
          <ul className="flex items-center justify-center text-[14px] font-semibold tracking-[0.03em] gap-0">
            {NAV_ITEMS.map((item) => {
              const hasDropdown = item.groups && item.groups.length > 0;
              const isOpen = activeDropdown === item.label;
              const active = isNavActive(item);
              const isWide = item.groups && item.groups.length > 1;

              return (
                <li
                  key={item.label}
                  className="relative"
                  onMouseEnter={hasDropdown ? () => handleDropdownEnter(item.label) : undefined}
                  onMouseLeave={hasDropdown ? handleDropdownLeave : undefined}
                >
                  <Link
                    to={item.href}
                    className={clsx(
                      'flex items-center gap-1.5 px-5 py-4 transition-colors relative whitespace-nowrap group',
                      item.highlight
                        ? 'text-accent hover:text-accent/80'
                        : active
                          ? 'text-primary'
                          : 'text-gray-700 hover:text-primary',
                    )}
                  >
                    {item.label}
                    {hasDropdown && (
                      <ChevronDown
                        size={12}
                        className={clsx('opacity-60 transition-transform duration-200 mt-px', isOpen && 'rotate-180')}
                      />
                    )}
                    {/* Active underline */}
                    <span
                      className={clsx(
                        'absolute bottom-0 left-5 right-5 h-[2px] bg-primary rounded-full transition-transform duration-200 origin-left',
                        active ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'
                      )}
                    />
                  </Link>

                  {/* Mega Dropdown */}
                  {hasDropdown && isOpen && (
                    <div
                      className={clsx(
                        'absolute top-full left-0 bg-white rounded-b-2xl shadow-2xl border border-t-0 border-gray-100 z-50 animate-dropdown',
                        isWide
                          ? 'grid grid-cols-2 gap-8 p-6 w-[540px]'
                          : 'p-5 w-64',
                      )}
                      onMouseEnter={() => {
                        clearTimeout(hoverTimeoutRef.current);
                        setActiveDropdown(item.label);
                      }}
                      onMouseLeave={handleDropdownLeave}
                    >
                      {item.groups!.map((col, ci) => (
                        <div key={ci} className="space-y-5">
                          {col.map((group, gi) => (
                            <div key={gi}>
                              {group.title && (
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2.5 pb-1.5 border-b border-gray-100">
                                  {group.title}
                                </p>
                              )}
                              <div className="space-y-0">
                                {group.links.map((link) => (
                                  <Link
                                    key={link.href}
                                    to={link.href}
                                    onClick={() => setActiveDropdown(null)}
                                    className="flex items-center gap-1.5 py-1.5 text-[13px] font-normal text-gray-600 hover:text-primary hover:translate-x-1 transition-all duration-150"
                                  >
                                    <span className="w-1 h-1 rounded-full bg-gray-300 group-hover:bg-primary transition-colors shrink-0" />
                                    {link.label}
                                  </Link>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </nav>

      {/* ================================================================ */}
      {/* Mobile search bar                                                */}
      {/* Always visible on all pages                                      */}
      {/* ================================================================ */}
      <div className="md:hidden px-4 pb-3 pt-1 bg-white border-t border-gray-100">
          <form onSubmit={handleSearch}>
            <div className="relative flex items-center">
              <Search size={16} className="absolute left-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                autoFocus={!isHome}
                placeholder="Search for plants, seeds, pots..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-full bg-gray-50 focus:outline-none focus:border-secondary text-sm transition-all placeholder:text-gray-400"
              />
              <button type="submit" className="sr-only">Search</button>
            </div>
          </form>
        </div>

      {/* ================================================================ */}
      {/* Mobile drawer                                                    */}
      {/* ================================================================ */}
      {drawerOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-50"
            onClick={closeDrawer}
          />
          <div className="fixed top-0 left-0 w-[88vw] max-w-[400px] sm:max-w-[440px] lg:max-w-[480px] h-full bg-white z-50 shadow-2xl flex flex-col overflow-hidden">
            {/* Mobile Drawer Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <Link
                to="/"
                onClick={closeDrawer}
                className="flex items-center gap-2"
              >
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-sm">
                  <Leaf size={16} className="text-white" />
                </div>
                <span className="text-lg font-bold text-primary tracking-tight">Plantoga</span>
              </Link>
              <button onClick={closeDrawer} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* User section */}
            <div className="p-4 border-b bg-gray-50">
              {user ? (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary-light/20 flex items-center justify-center">
                    <User size={20} className="text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">
                      {user.full_name || user.email}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {user.email}
                    </p>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => {
                    closeDrawer();
                    openAuthModal();
                  }}
                  className="w-full py-2.5 bg-primary text-white rounded-lg text-sm font-medium"
                >
                  Login / Register
                </button>
              )}
            </div>

            {/* Collection-style nav rows */}
            <div className="flex-1 overflow-y-auto">
              {/* Promo Banner */}
              <div className="px-4 pt-4 pb-2">
                <Link
                  to="/products?sort_by=popular"
                  onClick={closeDrawer}
                  className="block w-full bg-[#4A2F1D] rounded-2xl p-3 sm:p-4 shadow-md flex items-center justify-between group"
                >
                  <div className="flex -space-x-3 sm:-space-x-4">
                    <img src="https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=100&h=100&fit=crop" className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 border-[#4A2F1D] object-cover group-hover:-translate-y-1 transition-transform" alt="" />
                    <img src="https://images.unsplash.com/photo-1501004318641-b39e6451bec6?w=100&h=100&fit=crop" className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 border-[#4A2F1D] object-cover group-hover:-translate-y-1 transition-transform delay-75" alt="" />
                    <img src="https://images.unsplash.com/photo-1545241047-6083a3684587?w=100&h=100&fit=crop" className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 border-[#4A2F1D] object-cover group-hover:-translate-y-1 transition-transform delay-100" alt="" />
                    <img src="https://images.unsplash.com/photo-1477554193778-9562c28588c0?w=100&h=100&fit=crop" className="w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 border-[#4A2F1D] object-cover group-hover:-translate-y-1 transition-transform delay-150" alt="" />
                  </div>
                  <div className="text-right ml-2 flex-1">
                    <p className="text-white text-[11px] sm:text-xs font-medium leading-tight">Buy any 4 Plants for just</p>
                    <p className="text-[#F4A261] text-lg sm:text-xl font-extrabold mt-0.5 tracking-wide">₹699/-</p>
                  </div>
                </Link>
              </div>

              <MobileCollectionList onNavigate={closeDrawer} />
            </div>

            {/* Bottom actions */}
            <div className="border-t p-4 space-y-1">
              <a
                href={`https://wa.me/${WHATSAPP_NUMBER}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 py-3 text-sm font-semibold text-gray-700 hover:text-green-600"
              >
                <WhatsAppIcon size={30} /> WhatsApp Us
              </a>
              {user && (
                <Link
                  to="/orders"
                  onClick={closeDrawer}
                  className="flex items-center gap-3 py-2.5 text-sm text-gray-600 hover:text-primary"
                >
                  <Package size={18} /> My Orders
                </Link>
              )}
              {user?.is_admin && (
                <Link
                  to="/admin"
                  onClick={closeDrawer}
                  className="flex items-center gap-3 py-2.5 text-sm text-primary font-medium"
                >
                  <Settings size={18} /> Admin Panel
                </Link>
              )}
              {user && (
                <button
                  onClick={() => {
                    logout();
                    closeDrawer();
                  }}
                  className="flex items-center gap-3 py-2.5 text-sm text-red-600 w-full"
                >
                  <LogOut size={18} /> Logout
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </header>
  );
}
