import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowUpRight,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileCheck2,
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
import { useCategories } from '@/hooks/useCategories';
import { useMenuItems } from '@/hooks/useMenuItems';
import type { ProductListResponse } from '@/types';

import {
  FALLBACK_GIFTING_SUBMENU,
  WHATSAPP_NUMBER,
  categoryLink,
  categoryTreeToNavItems,
  resolveSubcategories,
} from './navData';
import type { NavItemDef, DropdownLink } from './navData';

import { LOGO_PATH } from '@/lib/branding';
import ResponsiveBannerImage from '@/components/banner/ResponsiveBannerImage';

// ── Shop mega-menu panel ─────────────────────────────────────────────────────
interface MobileMenuItem {
  label: string;
  href: string;
  img: string;
}

interface ShopMegaMenuProps {
  menuItems: MobileMenuItem[];
  mobilePromoBanner: import('@/types').Banner | undefined;
  promoRatio: number | null;
  setPromoRatio: React.Dispatch<React.SetStateAction<number | null>>;
  user: import('@/types').User | null;
  onClose: () => void;
  onLogout: () => void;
  onLogin: () => void;
}

function ShopMegaMenu({
  menuItems,
  mobilePromoBanner,
  promoRatio,
  setPromoRatio,
  user,
  onClose,
  onLogout,
  onLogin,
}: ShopMegaMenuProps) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const hasBanner = !!(mobilePromoBanner?.image_url_web || mobilePromoBanner?.image_url);
  
  // Get categories with their subcategories
  const { data: categories = [] } = useCategories();

  const getCategorySubcategories = (categoryLabel: string): Array<{ name: string; slug: string }> => {
    const category = categories.find(c => c.name === categoryLabel);
    if (category && category.children && category.children.length > 0) {
      return category.children.map(child => ({ name: child.name, slug: child.slug }));
    }
    return [];
  };

  return (
    <div
      className="absolute top-full left-1/2 -translate-x-1/2 z-[51] bg-white rounded-b-2xl shadow-2xl border border-t-0 border-gray-100 animate-dropdown overflow-hidden overscroll-contain"
      style={{ 
        width: '580px', 
        maxHeight: '500px',
        minHeight: '200px' // Ensure panel has minimum height
      }}
    >
      <div className="flex gap-0 h-full max-h-[500px]">

        {/* ── LEFT: banner + single-column category list ── */}
        <div
          data-mega-scroll
          className="flex-1 min-w-0 p-4 overflow-y-auto overscroll-contain flex flex-col"
          style={{ maxHeight: '500px' }}
        >

          {/* Promo banner — same admin-managed banner shown in the mobile drawer */}
          {hasBanner && (
            <div
              className="mb-3 w-full rounded-xl overflow-hidden bg-gray-100 shrink-0 relative"
              style={{ 
                height: '80px',
                minHeight: '80px',
                maxHeight: '80px'
              }}
            >
              {mobilePromoBanner!.cta_link ? (
                <Link
                  to={mobilePromoBanner!.cta_link}
                  onClick={onClose}
                  className="block w-full h-full"
                  style={mobilePromoBanner!.bg_color ? { backgroundColor: mobilePromoBanner!.bg_color } : undefined}
                >
                  <img
                    src={mobilePromoBanner!.image_url_web || mobilePromoBanner!.image_url || ''}
                    alt="Promo"
                    className="w-full h-full object-cover"
                    loading="eager"
                  />
                </Link>
              ) : (
                <div
                  className="w-full h-full"
                  style={mobilePromoBanner!.bg_color ? { backgroundColor: mobilePromoBanner!.bg_color } : undefined}
                >
                  <img
                    src={mobilePromoBanner!.image_url_web || mobilePromoBanner!.image_url || ''}
                    alt="Promo"
                    className="w-full h-full object-cover"
                    loading="eager"
                  />
                </div>
              )}
            </div>
          )}

          {/* Single-column category rows — circular thumbnail + label with expandable subcategories */}
          <div className="flex flex-col">
            {menuItems.map((cat) => {
              const subcategories = getCategorySubcategories(cat.label);
              const hasSubcategories = subcategories.length > 0;
              const isExpanded = expandedCategory === cat.label;

              return (
                <div key={cat.href}>
                  <div className="flex items-center gap-3 px-2.5 py-2 rounded-lg hover:bg-emerald-50/60 active:bg-emerald-50/80 transition-all duration-150 group">
                    <Link
                      to={cat.href}
                      onClick={onClose}
                      className="flex items-center gap-3 flex-1"
                    >
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-100 border border-gray-100/60 shrink-0">
                        {cat.img ? (
                          <img
                            src={cat.img}
                            alt={cat.label}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full bg-primary/10 flex items-center justify-center text-sm">🌿</div>
                        )}
                      </div>
                      <span className="text-[16px] font-extrabold text-gray-800 group-hover:text-primary transition-colors leading-tight">
                        {cat.label}
                      </span>
                    </Link>
                    {hasSubcategories && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedCategory(isExpanded ? null : cat.label);
                        }}
                        className="p-1 hover:bg-emerald-100 rounded transition-colors"
                        aria-label={isExpanded ? 'Collapse' : 'Expand'}
                      >
                        <ChevronDown
                          size={16}
                          className={clsx(
                            'text-gray-500 transition-transform duration-200',
                            isExpanded && 'rotate-180'
                          )}
                        />
                      </button>
                    )}
                  </div>

                  {/* Subcategories list */}
                  {hasSubcategories && isExpanded && (
                    <div className="ml-12 mt-1 mb-2 space-y-0.5 animate-dropdown">
                      {subcategories.map((subcat) => (
                        <Link
                          key={subcat.slug}
                          to={`/products?category=${subcat.slug}`}
                          onClick={onClose}
                          className="block px-2 py-1 text-[12.5px] font-semibold text-gray-600 hover:text-primary hover:bg-emerald-50/40 rounded transition-all"
                        >
                          {subcat.name}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <Link
            to="/products"
            onClick={onClose}
            className="inline-flex items-center gap-1 mt-2 ml-2 text-[11px] font-bold text-primary hover:text-primary/80 transition-colors"
          >
            View all plants →
          </Link>
        </div>

        {/* ── RIGHT: account + info + support ── */}
        <div
          data-mega-scroll
          className="w-52 shrink-0 border-l border-gray-100 p-4 overflow-y-auto overscroll-contain flex flex-col"
        >

          {/* Account card / login prompt */}
          <div className="mb-3">
            {user ? (
              <div className="flex items-center gap-2.5 p-2.5 bg-gray-50 rounded-xl border border-gray-100 mb-2">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white font-bold shrink-0 text-xs">
                  {(user.full_name || 'U').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-gray-800 truncate leading-none">{user.full_name || 'Account'}</p>
                  <p className="text-[10px] text-gray-400 truncate mt-0.5">{user.email}</p>
                </div>
              </div>
            ) : (
              <button
                onClick={() => { onClose(); onLogin(); }}
                className="w-full py-2 bg-primary hover:bg-primary/90 text-white rounded-full text-xs font-bold tracking-wider uppercase shadow-sm active:scale-[0.97] transition-all duration-200 mb-2"
              >
                Login / Register
              </button>
            )}
          </div>

          {/* My Account links — only when logged in */}
          {user && (
            <div className="mb-3">
              <p className="text-[9px] font-extrabold text-gray-400 uppercase tracking-widest mb-1.5">My Account</p>
              <div>
                <Link to="/orders" onClick={onClose}
                  className="flex items-center gap-2 py-1.5 text-[12px] font-medium text-gray-700 hover:text-primary transition-colors">
                  <Package size={13} className="text-gray-400 shrink-0" /> My Orders
                </Link>
                <Link to="/damage-replacement" onClick={onClose}
                  className="flex items-center gap-2 py-1.5 text-[12px] font-medium text-gray-700 hover:text-primary transition-colors">
                  <ShieldCheck size={13} className="text-gray-400 shrink-0" /> Damage Replacement
                </Link>
                <Link to="/damage-claims" onClick={onClose}
                  className="flex items-center gap-2 py-1.5 text-[12px] font-medium text-gray-700 hover:text-primary transition-colors">
                  <FileCheck2 size={13} className="text-gray-400 shrink-0" /> My Damage Claims
                </Link>
                {user.is_admin && (
                  <Link to="/admin" onClick={onClose}
                    className="flex items-center gap-2 py-1.5 text-[12px] font-medium text-primary hover:text-primary/80 transition-colors">
                    <Settings size={13} className="shrink-0" /> Admin Panel
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* Info links — always visible */}
          <div className="mb-3">
            <p className="text-[9px] font-extrabold text-gray-400 uppercase tracking-widest mb-1.5">Info</p>
            <div>
              {([
                { label: 'About Us', href: '/#about-us' },
                { label: 'Track Your Order', href: '/orders' },
                { label: 'Corporate Gifting', href: '/corporate-gifting' },
              ] as const).map((link) => (
                <Link key={link.href} to={link.href} onClick={onClose}
                  className="flex items-center py-1.5 text-[12px] font-medium text-gray-600 hover:text-primary transition-colors">
                  {link.label}
                </Link>
              ))}
              <a
                href={`https://wa.me/${WHATSAPP_NUMBER}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onClose}
                className="flex items-center justify-between py-1.5 text-[12px] font-medium text-gray-600 hover:text-primary transition-colors group"
              >
                <span>Support</span>
                <ArrowUpRight size={12} className="text-gray-400 group-hover:text-primary" />
              </a>
            </div>
          </div>

          {/* Logout — only when logged in */}
          {user && (
            <button
              onClick={() => { onLogout(); onClose(); }}
              className="mt-auto w-full flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-red-500 hover:bg-red-50 rounded-lg transition-all duration-150"
            >
              <LogOut size={13} /> Logout
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

export default function Navbar() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [promoRatio, setPromoRatio] = useState<number | null>(null);

  const lastScrollY = useRef(0);
  const searchOpenedAtRef = useRef<number>(0);
  const headerRef = useRef<HTMLElement>(null);

  const navigate = useNavigate();
  const location = useLocation();
  const { user, openAuthModal, logout } = useAuthStore();
  const { itemCount, openDrawer } = useCartStore();

  const hoverTimeoutRef = useRef<number>(0);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const desktopSearchRef = useRef<HTMLFormElement>(null);
  const searchToggleRef = useRef<HTMLButtonElement>(null);
  // True while the pointer is held down inside a suggestions dropdown.
  // Prevents the input's onBlur from hiding suggestions before the click registers.
  const suggestionMouseDownRef = useRef(false);

  // Close mega-menu and drawer on every route change so they never get stuck
  // after a navigation (e.g. clicking a link inside the Shop mega-menu).
  useEffect(() => {
    setActiveDropdown(null);
    setDrawerOpen(false);
    setActiveSubmenu(null);
  }, [location.pathname, location.search]);

  const debouncedQuery = useDebounce(searchQuery, 300);
  const isProductPage = /^\/products\/[^/]+/.test(location.pathname);

  // Close search when leaving a product page. Adjusting state during render
  // (guarded by the previous value) replaces a synchronous setState effect.
  const [wasProductPage, setWasProductPage] = useState(isProductPage);
  if (wasProductPage !== isProductPage) {
    setWasProductPage(isProductPage);
    if (!isProductPage) setSearchOpen(false);
  }
  const { data: mobilePromoBanners = [] } = useBanners('mobile_promo');
  const mobilePromoBanner = mobilePromoBanners[0];
  useEffect(() => {
    setPromoRatio(null);
  }, [mobilePromoBanner?.id]);
  const { data: categories = [] } = useCategories();

  // DB-driven menu items. dataUpdatedAt stays 0 until a successful fetch ever
  // completes (no placeholderData), so we can distinguish "API hasn't responded
  // yet" from "admin deliberately emptied the menu".
  const menuQuery = useMenuItems();
  const { data: menuItems } = menuQuery;
  const hasFetched = menuQuery.dataUpdatedAt > 0;
  const useFallback = !hasFetched && (menuQuery.isPending || menuQuery.isError);

  // In fallback mode pass [] to the pure functions so DB-driven links stay
  // hidden until the API responds. Otherwise always prefer real (even stale)
  // DB data — including an intentionally empty array chosen by the admin.
  const effectiveMenuItems = useFallback ? [] : (menuItems ?? []);

  const categoryNavItems = useFallback
    ? categoryTreeToNavItems(categories, [])
    : categoryTreeToNavItems(categories, effectiveMenuItems);

  const dbMobileItems = effectiveMenuItems
    .filter((m) => !m.parent_id)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((m) => ({
      label: m.label,
      href: m.href,
      img: m.image_url || '',
    }));

  const mobileMenuItems = [
    ...categories.map((root) => ({
      label: root.name,
      href: categoryLink(root),
      img: root.mobile_image_url || root.image_url || '',
    })),
    ...(useFallback ? [] : dbMobileItems),
  ];

  const shopMegaOpen = activeDropdown === 'SHOP';
  // Only lock body scroll for the mobile drawer.
  // The desktop Shop mega-menu uses wheel/touchmove event handlers for scroll
  // containment (see the useEffect below), so applying a body scroll lock
  // (position:fixed) causes the page to jump and get stuck when clicked while
  // scrolled down.
  useBodyScrollLock(drawerOpen);

  // Keep wheel/trackpad scroll inside the mega-menu. Without this, reaching the
  // panel's top/bottom (or scrolling over the transparent backdrop) also moves
  // the page behind it.
  useEffect(() => {
    if (!shopMegaOpen) return;

    const shouldLockPage = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return true;
      return !target.closest('[data-mega-scroll]');
    };

    const onWheel = (e: WheelEvent) => {
      const scrollable = e.target instanceof Element
        ? e.target.closest('[data-mega-scroll]')
        : null;
      if (!(scrollable instanceof HTMLElement)) {
        e.preventDefault();
        return;
      }
      const { scrollTop, scrollHeight, clientHeight } = scrollable;
      const atTop = scrollTop <= 0 && e.deltaY < 0;
      const atBottom = scrollTop + clientHeight >= scrollHeight - 1 && e.deltaY > 0;
      if (atTop || atBottom) e.preventDefault();
    };

    const onTouchMove = (e: TouchEvent) => {
      if (shouldLockPage(e.target)) e.preventDefault();
    };

    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    return () => {
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('touchmove', onTouchMove);
    };
  }, [shopMegaOpen]);

  // Close the Shop mega-menu when the user clicks anywhere outside the header.
  // A fixed backdrop inside the sticky header's stacking context (z-50) is not
  // reliable for intercepting page-level clicks, so we use a document-level
  // pointerdown listener instead — the standard pattern for dropdowns.
  useEffect(() => {
    if (!shopMegaOpen) return;

    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      // Clicks inside the header (navbar + mega-menu) are handled by their
      // own onClick handlers; ignore them here.
      if (headerRef.current?.contains(target)) return;
      setActiveDropdown(null);
    }

    document.addEventListener('pointerdown', onPointerDown, { capture: true });
    return () => document.removeEventListener('pointerdown', onPointerDown, { capture: true });
  }, [shopMegaOpen]);

  // Cleanup hover timeout on unmount
  useEffect(() => () => clearTimeout(hoverTimeoutRef.current), []);

  // Sticky page content (product gallery) sits below the header when it is
  // visible, and flush with the viewport once the header slides away.
  useEffect(() => {
    const root = document.documentElement;
    const header = headerRef.current;
    if (!header) return;

    const updateOffset = () => {
      root.style.setProperty(
        '--sticky-header-offset',
        hidden ? '0px' : `${header.offsetHeight}px`,
      );
    };

    updateOffset();
    const observer = new ResizeObserver(updateOffset);
    observer.observe(header);
    return () => observer.disconnect();
  }, [hidden]);

  useEffect(() => {
    return () => {
      document.documentElement.style.removeProperty('--sticky-header-offset');
    };
  }, []);

  // Scroll-based shadow and hide/show on scroll
  useEffect(() => {
    function onScroll() {
      const currentScrollY = window.scrollY;
      setScrolled(currentScrollY > 60);

      // When search is open, keep the navbar visible and skip hide logic.
      // Opening the search bar adds height to the sticky header which shifts
      // page content down, causing a spurious positive-diff scroll event that
      // would otherwise hide the navbar immediately.
      setSearchOpen((searchIsOpen) => {
        if (!searchIsOpen) {
          if (currentScrollY < 100) {
            setHidden(false);
          } else {
            const diff = currentScrollY - lastScrollY.current;
            if (diff > 10) {
              setHidden(true);
            } else if (diff < -10) {
              setHidden(false);
            }
          }
        } else {
          // Search is open — ensure navbar stays visible
          setHidden(false);
        }
        return searchIsOpen; // don't actually change searchOpen
      });

      lastScrollY.current = currentScrollY;
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Click-outside to close search bar & suggestions
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      // Ignore clicks within the search toggle button itself
      const target = e.target as Node;
      if (
        searchToggleRef.current &&
        searchToggleRef.current.contains(target)
      ) {
        return;
      }
      // Ignore spurious events fired immediately after opening (e.g. focus
      // events that bubble up as synthetic pointer events on some browsers)
      if (Date.now() - searchOpenedAtRef.current < 600) {
        return;
      }
      // Ignore clicks inside either the mobile search container OR the desktop search form
      const insideMobile = searchContainerRef.current?.contains(target);
      const insideDesktop = desktopSearchRef.current?.contains(target);
      if (!insideMobile && !insideDesktop) {
        setSearchFocused(false);
        setSearchOpen(false);
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
      window.scrollTo({ top: 0, behavior: 'instant' });
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
      150,
    );
  }

  function handleDropdownLeave() {
    clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = window.setTimeout(
      () => setActiveDropdown(null),
      200,
    );
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setActiveSubmenu(null);
  }

  // Dynamic submenu resolver (DB-driven category tree + menu items)
  function getSubcategories(label: string) {
    if (useFallback) {
      if (label.toLowerCase().trim() === 'gifting') return FALLBACK_GIFTING_SUBMENU;
      return resolveSubcategories(categories, label, []);
    }
    return resolveSubcategories(categories, label, effectiveMenuItems);
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
      ref={headerRef}
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
        className="mx-auto px-4 sm:px-6 lg:px-10 xl:px-16 flex items-center gap-3 sm:gap-6 relative h-[84px] sm:h-[96px] lg:h-[90px]"
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
            className="object-contain w-auto h-[76px] sm:h-[88px] lg:h-[72px]"
          />
        </Link>

        {/* Desktop inline search bar — fills the center of the top row */}
        <form
          onSubmit={handleSearch}
          ref={desktopSearchRef}
          className="hidden lg:flex flex-1 min-w-0 mx-8 relative"
        >
          <div className="relative flex items-center w-full">
            <Search size={17} className="absolute left-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search for plants, seeds, pots..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => {
                // Don't hide suggestions if the user is clicking on one
                if (suggestionMouseDownRef.current) return;
                setSearchFocused(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setSearchFocused(false);
                  setSearchQuery('');
                }
              }}
              className="desktop-search-input w-full pl-11 pr-5 py-3 border border-gray-300 rounded-full bg-[#f5f5f5] focus:outline-none focus:border-primary focus:bg-white text-sm transition-all placeholder:text-gray-400"
            />
            <button type="submit" className="sr-only">Search</button>
          </div>
          {/* Desktop inline suggestions */}
          {showSuggestions && (
            <div
              className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50 animate-dropdown"
              onMouseDown={() => { suggestionMouseDownRef.current = true; }}
              onMouseUp={() => { suggestionMouseDownRef.current = false; }}
            >
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
                  {product.images?.[0] ? (
                    <img src={product.images[0]} alt="" className="w-10 h-10 rounded-xl object-cover shrink-0 bg-gray-100" />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-gray-100 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{product.name}</p>
                    <p className="text-xs text-primary font-semibold mt-0.5">₹{product.price}</p>
                  </div>
                </Link>
              ))}
              <Link
                to={`/products?search=${encodeURIComponent(debouncedQuery)}`}
                onClick={() => { setSearchFocused(false); setSearchQuery(''); }}
                className="flex items-center justify-center gap-2 px-4 py-3 text-sm text-primary font-semibold hover:bg-primary/5 transition-colors"
              >
                <Search size={14} /> View all results for &ldquo;{debouncedQuery}&rdquo;
              </Link>
            </div>
          )}
        </form>

        <div className="flex items-center gap-1 ml-auto lg:ml-0 shrink-0">



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
                    <Link
                      to="/damage-claims"
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-gray-50 text-gray-700 transition-colors"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <FileCheck2 size={15} /> My Damage Claims
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

          {/* Search icon — only visible on mobile/tablet; desktop uses inline bar */}
          <button
            ref={searchToggleRef}
            className="flex lg:hidden items-center justify-center w-10 h-10 rounded-full text-gray-600 hover:text-primary hover:bg-primary/5 transition-all"
            onClick={(e) => {
              e.stopPropagation();
              setSearchOpen((prev) => {
                const next = !prev;
                if (next) {
                  searchOpenedAtRef.current = Date.now();
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
      {/* ROW 2 — Category navigation (desktop only)                      */}
      {/* ================================================================ */}
      <nav className="hidden lg:block border-t border-gray-100 relative">
        <div className="mx-auto px-4 sm:px-6 lg:px-10 xl:px-16">
          <ul className="flex items-center justify-center text-[15px] font-extrabold tracking-[0.03em] gap-0">
            {categoryNavItems.map((item) => {
              const hasDropdown = item.groups && item.groups.length > 0;
              const isOpen = activeDropdown === item.label;
              const active = isNavActive(item);
              const isWide = item.groups && item.groups.length > 1;

              return (
                <li
                  key={item.label}
                  className="relative"
                  onMouseEnter={!item.isShopMenu && hasDropdown ? () => handleDropdownEnter(item.label) : undefined}
                  onMouseLeave={!item.isShopMenu && hasDropdown ? handleDropdownLeave : undefined}
                >
                  {/* For the Shop item: button that toggles/opens the mega-menu (click only).
                      For all other items: a normal Link that also shows a dropdown on hover. */}
                  {item.isShopMenu ? (
                    <button
                      type="button"
                      onClick={() =>
                        setActiveDropdown((prev) => (prev === item.label ? null : item.label))
                      }
                      className={clsx(
                        'flex items-center gap-1.5 px-5 py-4 transition-colors relative whitespace-nowrap group',
                        active ? 'text-primary' : 'text-gray-700 hover:text-primary',
                      )}
                    >
                      {item.label}
                      <ChevronDown
                        size={12}
                        className={clsx('opacity-60 transition-transform duration-200 mt-px', isOpen && 'rotate-180')}
                      />
                      <span
                        className={clsx(
                          'absolute bottom-0 left-5 right-5 h-[2px] bg-primary rounded-full transition-transform duration-200 origin-left',
                          active ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'
                        )}
                      />
                    </button>
                  ) : (
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
                      <span
                        className={clsx(
                          'absolute bottom-0 left-5 right-5 h-[2px] bg-primary rounded-full transition-transform duration-200 origin-left',
                          active ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'
                        )}
                      />
                    </Link>
                  )}

                  {/* ── Standard dropdown (non-Shop items) ── */}
                  {!item.isShopMenu && hasDropdown && isOpen && (
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

        {/* ── Shop mega-menu — outside the <li> so it can span full nav width ── */}
        {/* Close-on-outside-click is handled by the document pointerdown listener above. */}
        {activeDropdown === 'SHOP' && (
          <ShopMegaMenu
            menuItems={mobileMenuItems}
            mobilePromoBanner={mobilePromoBanner}
            promoRatio={promoRatio}
            setPromoRatio={setPromoRatio}
            user={user}
            onClose={() => setActiveDropdown(null)}
            onLogout={() => { logout(); }}
            onLogin={openAuthModal}
          />
        )}
      </nav>

      {/* ================================================================ */}
      {/* Search bar — mobile only (desktop uses inline bar in Row 1)      */}
      {/* ================================================================ */}
      <div
        ref={searchContainerRef}
        className={`${searchOpen ? 'block lg:hidden' : 'hidden'} bg-white px-4 py-3 border-t border-gray-100 relative`}
      >
        <div className="mx-auto max-w-4xl">
          <form onSubmit={handleSearch}>
            <div className="relative flex items-center">
              <Search size={16} className="absolute left-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search for plants, seeds, pots..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setSearchOpen(false);
                    setSearchFocused(false);
                  }
                }}
                className="mobile-search-input w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-full bg-gray-50 focus:outline-none focus:border-primary focus:bg-white text-sm transition-all placeholder:text-gray-400"
              />
              <button type="submit" className="sr-only">Search</button>
            </div>
          </form>

          {/* Suggestions dropdown */}
          {showSuggestions && (
            <div 
              className="absolute top-full mt-2 left-4 right-4 sm:left-6 sm:right-6 lg:left-10 lg:right-10 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50 animate-dropdown"
              onMouseDown={() => { suggestionMouseDownRef.current = true; }}
              onMouseUp={() => { suggestionMouseDownRef.current = false; }}
            >
              {suggestions!.map((product) => (
                <Link
                  key={product.id}
                  to={`/products/${product.slug}`}
                  onClick={() => {
                    setSearchOpen(false);
                    setSearchFocused(false);
                    setSearchQuery('');
                  }}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
                >
                  {product.images?.[0] ? (
                    <img
                      src={product.images?.[0]}
                      alt=""
                      className="w-10 h-10 rounded-xl object-cover shrink-0 bg-gray-100"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-gray-100 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{product.name}</p>
                    <p className="text-xs text-primary font-semibold mt-0.5">₹{product.price}</p>
                  </div>
                </Link>
              ))}
              <Link
                to={`/products?search=${encodeURIComponent(debouncedQuery)}`}
                onClick={() => {
                  setSearchOpen(false);
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

              {/* Scrollable Area: banner, account card, menu items & bottom section */}
              <div
                className="flex-1 min-h-0 overflow-y-auto scrollbar-none flex flex-col"
                style={{ WebkitOverflowScrolling: 'touch' }}
              >
               {/* Promotional Banner Card — rendered only when an active
                   mobile_promo banner with an image is configured
                   (admin-managed), so no hardcoded/seasonal content ever leaks
                   in. Full-bleed across the drawer (no side padding) with no
                   text overlay — bake any text into the image itself. */}
               {(mobilePromoBanner?.image_url || mobilePromoBanner?.image_url_web) && (
                 <div
                   className="pb-3 shrink-0 relative overflow-hidden"
                   style={
                     promoRatio
                       ? { aspectRatio: String(promoRatio) }
                       : { aspectRatio: '16/5' }
                   }
                 >
                   {mobilePromoBanner.cta_link ? (
                     <Link
                       to={mobilePromoBanner.cta_link}
                       onClick={closeDrawer}
                       className="group relative block h-full w-full overflow-hidden shadow-[0_4px_12px_rgba(45,106,79,0.06)] transition active:scale-[0.98]"
                       style={
                         mobilePromoBanner.bg_color
                           ? { backgroundColor: mobilePromoBanner.bg_color }
                           : undefined
                       }
                     >
                       <ResponsiveBannerImage
                         banner={mobilePromoBanner}
                         className="absolute inset-0 h-full w-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                         loading="eager"
                         onLoad={(e) => {
                           const img = e.currentTarget;
                           if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                             setPromoRatio((r) => r ?? img.naturalWidth / img.naturalHeight);
                           }
                         }}
                       />
                     </Link>
                   ) : (
                     <div
                       className="group relative block h-full w-full overflow-hidden shadow-[0_4px_12px_rgba(45,106,79,0.06)] transition active:scale-[0.98]"
                       style={
                         mobilePromoBanner.bg_color
                           ? { backgroundColor: mobilePromoBanner.bg_color }
                           : undefined
                       }
                     >
                       <ResponsiveBannerImage
                         banner={mobilePromoBanner}
                         className="absolute inset-0 h-full w-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                         loading="eager"
                         onLoad={(e) => {
                           const img = e.currentTarget;
                           if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                             setPromoRatio((r) => r ?? img.naturalWidth / img.naturalHeight);
                           }
                         }}
                       />
                     </div>
                   )}
                 </div>
               )}

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

              {/* Menu Items with Circular Previews */}
                <div className="px-3 py-3 space-y-1">
                  {useFallback && (
                    <>
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-3.5 px-3.5 py-2.5">
                          <div className="w-9 h-9 rounded-full bg-gray-100 animate-pulse" />
                          <div className="h-4 w-32 bg-gray-100 rounded animate-pulse" />
                        </div>
                      ))}
                    </>
                  )}
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
                          {item.img ? (
                            <img
                              src={item.img}
                              alt={item.label}
                              className="w-9 h-9 rounded-full object-cover border border-gray-100/60 shadow-xs group-hover:scale-105 transition-transform duration-300"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-gray-100 border border-gray-100/60" />
                          )}
                          <span className="text-[13.5px] font-bold text-gray-800 group-hover:text-primary transition-colors duration-200">
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
                      { label: 'Track My Claim', href: '/damage-claims' },
                    ].map((link) => {
                      const isExternal = link.href.startsWith('http');

                      return isExternal ? (
                        <a
                          key={link.label}
                          href={link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={closeDrawer}
                          className="flex items-center justify-between text-xs font-semibold text-gray-500 hover:text-primary hover:translate-x-0.5 transition-all duration-200 py-1"
                        >
                          <span>{link.label}</span>
                          <ArrowUpRight size={14} className="text-gray-400" />
                        </a>
                      ) : (
                        <Link
                          key={link.label}
                          to={link.href}
                          onClick={closeDrawer}
                          className="flex items-center justify-between text-xs font-semibold text-gray-500 hover:text-primary hover:translate-x-0.5 transition-all duration-200 py-1"
                        >
                          <span>{link.label}</span>
                          <ChevronRight size={13} className="text-gray-400" />
                        </Link>
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
              <div className="flex-1 min-h-0 overflow-y-auto scrollbar-none p-4 space-y-1" style={{ WebkitOverflowScrolling: 'touch' }}>
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
