import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowUpRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Leaf,
  LogOut,
  Menu,
  Package,
  Search,
  Settings,
  ShieldCheck,
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
import { useBanners } from '@/hooks/useBanners';
import type { ProductListResponse } from '@/types';

import { NAV_ITEMS, WHATSAPP_NUMBER } from './navData';
import type { NavItemDef } from './navData';

import { MobileCollectionList } from './MobileCollectionList';
import { LOGO_PATH } from '@/lib/branding';

const FALLBACK_MOBILE_MENU_ITEMS = [
  { label: 'Plants', href: '/products?category=plants', img: 'https://images.unsplash.com/photo-1545241047-6083a3684587?w=80&h=80&fit=crop&q=80' },
  { label: 'Seeds', href: '/products?category=seeds', img: 'https://images.unsplash.com/photo-1599599810769-bcde5a160d32?w=80&h=80&fit=crop&q=80' },
  { label: 'Pots & Planters', href: '/products?category=pots-planters', img: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=80&h=80&fit=crop&q=80' },
  { label: 'Plant Care', href: '/products?category=plant-care', img: 'https://images.unsplash.com/photo-1584132967334-10e028bd69f7?w=80&h=80&fit=crop&q=80' },
  { label: 'Gifting', href: '/products?tags=gifting', img: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=80&h=80&fit=crop&q=80' },
  { label: 'Corporate / Bulk Gifting', href: '/corporate-gifting', img: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=80&h=80&fit=crop&q=80' },
  { label: 'Vastu Plants', href: '/products?tags=vastu-friendly', img: 'https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=80&h=80&fit=crop&q=80' },
  { label: 'Air Purifying Plants', href: '/products?category=air-purifying-plants', img: 'https://images.unsplash.com/photo-1596547609652-9cf5d8d76921?w=80&h=80&fit=crop&q=80' },
  { label: 'Offers', href: '/products?tags=offers', img: 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?w=80&h=80&fit=crop&q=80' },
  { label: 'Blog', href: '/blog', img: 'https://images.unsplash.com/photo-1506880018603-83d5b814b5a6?w=80&h=80&fit=crop&q=80' },
];

export default function Navbar() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
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
  const isProductPage = /^\/products\/[^/]+/.test(location.pathname);

  // Close mobile search when leaving a product page
  useEffect(() => {
    if (!isProductPage) setMobileSearchOpen(false);
  }, [isProductPage]);
  const { data: mobilePromoBanners = [] } = useBanners('mobile_promo');
  const { data: menuBanners = [] } = useBanners('menu_banner');
  const mobilePromoBanner = mobilePromoBanners[0];
  const mobileMenuItems =
    menuBanners.length > 0
      ? menuBanners.map((banner) => ({
          label: banner.title,
          href: banner.cta_link || '/products',
          img: banner.image_url || '',
        }))
      : FALLBACK_MOBILE_MENU_ITEMS;

  useBodyScrollLock(drawerOpen);

  // Cleanup hover timeout on unmount
  useEffect(() => () => clearTimeout(hoverTimeoutRef.current), []);

  // Scroll-based shadow and hide/show on scroll
  useEffect(() => {
    function onScroll() {
      const currentScrollY = window.scrollY;
      setScrolled(currentScrollY > 60);

      if (currentScrollY < 100) {
        setHidden(false);
      } else {
        const diff = currentScrollY - lastScrollY.current;
        if (diff > 10) setHidden(true);   // scroll down → hide top navbar
        else if (diff < -10) setHidden(false); // scroll up → show top navbar
      }

      // Hide mobile search bar on any scroll
      if (Math.abs(currentScrollY - lastScrollY.current) > 5) {
        setMobileSearchOpen(false);
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
    setActiveSubmenu(null);
  }

  // Dynamic submenu resolver
  function getSubcategories(label: string) {
    const cleanLabel = label.toLowerCase().trim();
    
    // Find matching nav item in desktop NAV_ITEMS
    const navItem = NAV_ITEMS.find(
      (item) => {
        const itemLabel = item.label.toLowerCase().trim();
        return itemLabel === cleanLabel || 
               (cleanLabel === 'plants' && itemLabel === 'plants') ||
               (cleanLabel === 'seeds' && itemLabel === 'seeds') ||
               (cleanLabel === 'pots & planters' && itemLabel === 'pots & planters') ||
               (cleanLabel === 'plant care' && itemLabel === 'plant care');
      }
    );

    if (navItem && navItem.groups) {
      const flatLinks: { label: string; href: string }[] = [];
      
      // Prepend an "All [Label]" link
      flatLinks.push({ label: `All ${label}`, href: navItem.href });
      
      navItem.groups.forEach((column) => {
        column.forEach((group) => {
          group.links.forEach((link) => {
            if (!flatLinks.some((l) => l.label.toLowerCase() === link.label.toLowerCase())) {
              flatLinks.push(link);
            }
          });
        });
      });
      return flatLinks;
    }

    // Fallback/Custom list for Gifting
    if (cleanLabel === 'gifting') {
      return [
        { label: 'All Gifts', href: '/products?tags=gifting' },
        { label: 'Plant Gifting', href: '/products?tags=gifting' },
        { label: 'Corporate Gifting', href: '/corporate-gifting' },
        { label: 'Vastu Gifting', href: '/products?tags=vastu-friendly' },
      ];
    }

    return null;
  }

  function isNavActive(item: NavItemDef): boolean {
    const params = new URLSearchParams(location.search);
    const currentCategory = params.get('category') || '';
    const currentTag = params.get('tags') || params.get('tag') || '';

    const [itemPath, itemSearch] = item.href.split('?');
    const itemParams = new URLSearchParams(itemSearch || '');

    if (itemParams.get('category') === currentCategory && currentCategory)
      return true;
    if ((itemParams.get('tags') || itemParams.get('tag')) === currentTag && currentTag) return true;

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
        'sticky top-0 z-50 bg-white transition-transform duration-300 ease-in-out',
        scrolled && 'shadow-[0_2px_12px_rgba(0,0,0,0.08)] border-b border-gray-100',
        hidden && '-translate-y-full'
      )}
    >
      {/* ================================================================ */}
      {/* ROW 1 â€” Logo Â· Search Â· Icons (Ugaoo-style)                      */}
      {/* ================================================================ */}
      <div
        className="mx-auto px-4 sm:px-6 lg:px-10 xl:px-16 flex items-center gap-3 sm:gap-6 relative h-[84px] sm:h-[96px] lg:h-[104px]"
      >

        {/* Hamburger â€” visible on every breakpoint */}
        <button
          className="p-2 -ml-1 text-gray-700 hover:text-primary transition-colors touch-target lg:hidden"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
        >
          <Menu size={24} />
        </button>

        {/* Logo — centered on mobile, in-flow on desktop */}
        <Link
          to="/"
          className="absolute left-1/2 -translate-x-1/2 lg:relative lg:left-auto lg:translate-x-0 flex items-center shrink-0 group z-10"
        >
          <img
            src={LOGO_PATH}
            alt="Plantoga"
            className="object-contain w-auto h-[76px] sm:h-[88px] lg:h-[96px]"
          />
        </Link>

        {/* Desktop Search â€” centered, wide pill with embedded button */}
        <div
          ref={searchContainerRef}
          className="hidden lg:block flex-1 min-w-0 max-w-4xl mx-auto relative"
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

        <div className="flex items-center gap-1 ml-auto shrink-0">



          {/* Account */}
          {user ? (
            <div className="relative hidden lg:block">
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
                    <Link
                      to="/damage-replacement"
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-gray-50 text-gray-700 transition-colors"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <ShieldCheck size={15} /> Damage Replacement
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
              className="hidden lg:flex items-center justify-center w-11 h-11 rounded-full text-gray-600 hover:text-primary hover:bg-primary/5 transition-all"
              onClick={openAuthModal}
              aria-label="Login"
            >
              <User size={22} />
            </button>
          )}

          {/* Search icon — mobile product pages only */}
          {isProductPage && (
            <button
              className="lg:hidden flex items-center justify-center w-10 h-10 rounded-full text-gray-600 hover:text-primary hover:bg-primary/5 transition-all"
              onClick={() => {
                setMobileSearchOpen((prev) => {
                  const next = !prev;
                  if (next) {
                    // Focus the input after state update + DOM paint
                    setTimeout(() => {
                      document.querySelector<HTMLInputElement>('.mobile-search-input')?.focus();
                    }, 50);
                  }
                  return next;
                });
              }}
              aria-label="Search"
            >
              <Search size={21} />
            </button>
          )}

          {/* Cart â€” visible on all breakpoints */}
          <button
            className="flex items-center justify-center w-10 h-10 lg:w-11 lg:h-11 rounded-full relative text-gray-600 hover:text-primary hover:bg-primary/5 transition-all"
            onClick={openDrawer}
            aria-label="Cart"
          >
            <ShoppingBag size={21} />
            {itemCount > 0 && (
              <span className="absolute top-0 right-0 lg:top-0.5 lg:right-0.5 bg-accent text-white text-[9px] font-bold w-[17px] h-[17px] rounded-full flex items-center justify-center shadow-sm">
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
      {/* Visible when product images move downward                        */}
      {/* ================================================================ */}
      <div className={`${isProductPage ? (mobileSearchOpen ? 'block' : 'hidden') : 'lg:hidden'} bg-white px-4 py-3 border-t border-gray-100`}>
          <form onSubmit={handleSearch}>
            <div className="relative flex items-center">
              <Search size={16} className="absolute left-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                autoFocus={!isHome}
                placeholder="Search for plants, seeds, pots..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="mobile-search-input w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-full bg-gray-50 focus:outline-none focus:border-secondary text-sm transition-all placeholder:text-gray-400"
              />
              <button type="submit" className="sr-only">Search</button>
            </div>
          </form>
        </div>

      {/* ================================================================ */}
      {/* Mobile drawer (Sidebar)                                          */}
      {/* ================================================================ */}
      <div
        className={clsx(
          "fixed inset-0 z-50 transition-all duration-500",
          drawerOpen ? "visible" : "invisible pointer-events-none"
        )}
      >
        {/* Backdrop overlay */}
        <div
          className={clsx(
            "absolute inset-0 bg-black/60 backdrop-blur-[3px] transition-opacity duration-500 ease-in-out",
            drawerOpen ? "opacity-100" : "opacity-0"
          )}
          onClick={closeDrawer}
        />
        {/* Drawer Panel */}
        <div
          className={clsx(
            "fixed top-0 left-0 w-[82vw] max-w-[360px] sm:max-w-[380px] h-full bg-[#FAFBF9] shadow-[20px_0_40px_rgba(0,0,0,0.12)] flex flex-col overflow-hidden transition-transform duration-500",
            drawerOpen ? "translate-x-0" : "-translate-x-full"
          )}
          style={{ transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
        >
          {/* Sliding panels track */}
          <div
            className="w-[200%] h-full flex transition-transform duration-500"
            style={{
              transform: activeSubmenu ? 'translateX(-50%)' : 'translateX(0)',
              transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            {/* SCREEN 1: Main Menu Panel */}
            <div className="w-1/2 h-full flex flex-col shrink-0 overflow-hidden">
              {/* Mobile Drawer Header */}
              <div className="relative flex items-center justify-center px-5 py-4 shrink-0">
                <Link to="/" onClick={closeDrawer} className="flex items-center group">
                  <img src={LOGO_PATH} alt="Plantoga" className="h-14 object-contain" />
                </Link>
                <button
                  onClick={closeDrawer}
                  className="absolute right-5 w-9 h-9 flex items-center justify-center rounded-full bg-gray-50 text-gray-500 hover:bg-gray-100 active:scale-90 transition-all duration-200"
                  aria-label="Close menu"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Promotional Banner Card */}
              <div className="px-5 pb-3 shrink-0">
                <Link
                  to={mobilePromoBanner?.cta_link || '/products?tags=vastu-friendly'}
                  onClick={closeDrawer}
                  className="relative flex items-center gap-3.5 p-3.5 rounded-2xl overflow-hidden bg-gradient-to-br from-emerald-50/90 to-teal-50/30 border border-emerald-100/50 shadow-[0_4px_12px_rgba(45,106,79,0.04)] group transition active:scale-[0.98]"
                  style={
                    mobilePromoBanner?.bg_color
                      ? { background: mobilePromoBanner.bg_color }
                      : undefined
                  }
                >
                  <div className="absolute -right-6 -bottom-6 w-16 h-16 rounded-full bg-emerald-100/30 blur-md pointer-events-none" />
                  
                  <img 
                    src={mobilePromoBanner?.image_url || 'https://images.unsplash.com/photo-1545241047-6083a3684587?w=100&h=100&fit=crop'}
                    className="w-12 h-12 rounded-xl object-cover border-2 border-white shadow-sm shrink-0 group-hover:scale-105 transition-transform duration-300" 
                    alt=""
                  />
                  <div className="flex-1 min-w-0">
                    <span className="inline-block px-1.5 py-0.5 rounded-md bg-emerald-600/10 text-[9px] font-bold text-emerald-800 uppercase tracking-wider leading-none">
                      {mobilePromoBanner?.badge_text || 'Vastu Collection'}
                    </span>
                    <p
                      className="text-xs font-bold text-emerald-950 truncate mt-1 leading-snug"
                      style={{ color: mobilePromoBanner?.text_color }}
                    >
                      {mobilePromoBanner?.title || 'Bring Home Positivity'}
                    </p>
                    <p
                      className="text-[11px] font-semibold text-emerald-700 mt-0.5"
                      style={{ color: mobilePromoBanner?.text_color }}
                    >
                      {mobilePromoBanner?.subtitle || mobilePromoBanner?.cta_text || 'Live plants from just ₹299'}
                    </p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm shrink-0 group-hover:bg-primary group-hover:text-white transition-colors duration-300">
                    <ChevronRight size={14} className="text-emerald-800 group-hover:text-inherit transition-colors" />
                  </div>
                </Link>
              </div>

              {/* Login / Register Button or User Profile Card */}
              <div className="px-5 pb-4 border-b border-gray-100/80 shrink-0">
                {user ? (
                  <div className="flex items-center justify-between p-3.5 bg-gray-50/70 rounded-2xl border border-gray-100">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-extrabold shadow-sm shrink-0 text-sm">
                        {(user.full_name || 'U').charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-gray-800 truncate leading-none">
                          {user.full_name || 'Account'}
                        </p>
                        <p className="text-[10px] text-gray-400 truncate mt-1 leading-none">
                          {user.email}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        logout();
                        closeDrawer();
                      }}
                      className="text-[11px] font-bold text-red-600 bg-red-50 hover:bg-red-100 active:scale-95 px-3 py-1.5 rounded-full transition-all shrink-0"
                    >
                      Logout
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      closeDrawer();
                      openAuthModal();
                    }}
                    className="w-full py-3.5 bg-primary hover:bg-primary/95 text-white rounded-full text-xs font-bold tracking-wider uppercase shadow-sm active:scale-[0.97] transition-all duration-200"
                  >
                    Login / Register
                  </button>
                )}
              </div>

              {/* Scrollable Area: Menu Items & Bottom Section */}
              <div className="flex-1 overflow-y-auto scrollbar-none scroll-smooth flex flex-col justify-between" style={{ WebkitOverflowScrolling: 'touch' }}>
                {/* Strictly ordered 10 Menu Items with Circular Previews */}
                <div className="px-3 py-3 space-y-1">
                  {mobileMenuItems.map((item) => {
                    const subcategories = getSubcategories(item.label);
                    const hasSubmenu = subcategories !== null;
                    
                    return (
                      <Link
                        key={item.label}
                        to={item.href}
                        onClick={(e) => {
                          if (hasSubmenu) {
                            e.preventDefault();
                            setActiveSubmenu(item.label);
                          } else {
                            closeDrawer();
                          }
                        }}
                        className="flex items-center justify-between px-3.5 py-2.5 rounded-xl hover:bg-emerald-50/40 active:bg-emerald-50/60 transition-all duration-200 group"
                      >
                        <div className="flex items-center gap-3.5">
                          <img
                            src={item.img || 'https://images.unsplash.com/photo-1545241047-6083a3684587?w=80&h=80&fit=crop&q=80'}
                            alt={item.label}
                            className="w-9 h-9 rounded-full object-cover border border-gray-100/60 shadow-xs group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />
                          <span className="text-[13.5px] font-semibold text-gray-800 group-hover:text-primary transition-colors duration-200">
                            {item.label}
                          </span>
                        </div>
                        {hasSubmenu && (
                          <ChevronRight size={14} className="text-gray-400 group-hover:text-primary group-hover:translate-x-0.5 transition-all duration-200" />
                        )}
                      </Link>
                    );
                  })}
                </div>

                {/* Bottom Info & Contact Section */}
                <div className="px-6 py-5 bg-gray-50/50 space-y-4 border-t border-gray-100/80">
                  <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest leading-none">
                    Customer Support & Info
                  </p>
                  <div className="grid grid-cols-1 gap-2.5">
                    {[
                      { label: 'About Us', href: '/#about-us' },
                      { label: 'Track Your Order', href: '/orders' },
                      { label: 'Support', href: `https://wa.me/${WHATSAPP_NUMBER}` },
                      { label: 'Damage Replacement Form', href: '/damage-replacement' },
                    ].map((link) => {
                      const isExternal = link.href.startsWith('http');
                      const Component = isExternal ? 'a' : Link;
                      const props = isExternal 
                        ? { href: link.href, target: '_blank', rel: 'noopener noreferrer' } 
                        : { to: link.href };
                      
                      return (
                        <Component
                          key={link.label}
                          {...(props as any)}
                          onClick={closeDrawer}
                          className="flex items-center justify-between text-xs font-semibold text-gray-500 hover:text-primary hover:translate-x-0.5 transition-all duration-200 py-1"
                        >
                          <span>{link.label}</span>
                          {isExternal ? (
                            <ArrowUpRight size={14} className="text-gray-400" />
                          ) : (
                            <ChevronRight size={13} className="text-gray-400" />
                          )}
                        </Component>
                      );
                    })}
                  </div>

                  {/* Extra admin navigation link if needed */}
                  {user?.is_admin && (
                    <div className="pt-1.5">
                      <Link
                        to="/admin"
                        onClick={closeDrawer}
                        className="w-full flex items-center justify-center gap-1.5 py-3 bg-primary/5 hover:bg-primary/10 text-primary rounded-xl text-xs font-bold transition-all duration-200"
                      >
                        <Settings size={14} /> Admin Panel
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* SCREEN 2: Submenu Panel */}
            <div className="w-1/2 h-full flex flex-col shrink-0 bg-[#FAFBF9] overflow-hidden">
              {/* Submenu Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
                <div className="flex flex-col">
                  <button
                    onClick={() => setActiveSubmenu(null)}
                    className="flex items-center gap-1 text-gray-500 hover:text-primary active:scale-95 transition-all duration-150 -ml-1"
                  >
                    <ChevronLeft size={18} className="text-gray-600" />
                    <span className="text-xs font-extrabold uppercase tracking-widest text-gray-500">Back</span>
                  </button>
                  <h2 className="text-base font-extrabold text-primary tracking-tight mt-1 uppercase">
                    {activeSubmenu}
                  </h2>
                </div>
                <button
                  onClick={closeDrawer}
                  className="w-9 h-9 flex items-center justify-center rounded-full bg-gray-50 text-gray-500 hover:bg-gray-100 active:scale-90 transition-all duration-200"
                  aria-label="Close menu"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Submenu category list body */}
              <div className="flex-1 overflow-y-auto scrollbar-none p-4 space-y-1" style={{ WebkitOverflowScrolling: 'touch' }}>
                {activeSubmenu && getSubcategories(activeSubmenu)?.map((sub) => (
                  <Link
                    key={sub.label}
                    to={sub.href}
                    onClick={closeDrawer}
                    className="flex items-center justify-between px-4 py-3 rounded-xl hover:bg-emerald-50/40 active:bg-emerald-50/60 transition-all duration-200 group border-b border-gray-100/30 last:border-0"
                  >
                    <span className="text-[13.5px] font-semibold text-gray-700 group-hover:text-primary transition-colors duration-150">
                      {sub.label}
                    </span>
                    {getSubcategories(sub.label) !== null && (
                      <ChevronRight size={14} className="text-gray-400 group-hover:text-primary group-hover:translate-x-0.5 transition-all duration-150" />
                    )}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
