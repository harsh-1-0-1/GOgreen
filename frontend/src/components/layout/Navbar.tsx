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

// ---------------------------------------------------------------------------
// Types & Data
// ---------------------------------------------------------------------------

interface DropdownLink {
  label: string;
  href: string;
}

interface DropdownGroup {
  title?: string;
  links: DropdownLink[];
}

interface NavItemDef {
  label: string;
  href: string;
  highlight?: boolean;
  groups?: DropdownGroup[][];
}

const NAV_ITEMS: NavItemDef[] = [
  {
    label: 'PLANTS',
    href: '/products?category=plants',
    groups: [
      [
        {
          links: [
            { label: 'XL Plants', href: '/products?category=xl-plants' },
            { label: 'Indoor Plants', href: '/products?category=indoor-plants' },
            { label: 'Flowering Plants', href: '/products?category=flowering-plants' },
            { label: 'Low Maintenance Plants', href: '/products?category=low-maintenance-plants' },
            { label: 'Air Purifying Plants', href: '/products?category=air-purifying-plants' },
            { label: 'Cacti & Succulents', href: '/products?category=cacti-succulents' },
            { label: 'Hanging Plants', href: '/products?category=hanging-plants' },
            { label: 'Pet-Friendly Plants', href: '/products?category=pet-friendly-plants' },
            { label: 'Fruit Plants', href: '/products?category=fruit-plants' },
          ],
        },
      ],
      [
        {
          title: 'Shop by Location',
          links: [
            { label: 'Balcony', href: '/products?tag=balcony' },
            { label: 'Workspace', href: '/products?tag=workspace' },
            { label: 'Living Room', href: '/products?tag=living-room' },
            { label: 'Bedroom', href: '/products?tag=bedroom' },
          ],
        },
        {
          title: 'Shop by Name',
          links: [
            { label: 'Money Plant', href: '/products?search=money+plant' },
            { label: 'Snake Plant', href: '/products?search=snake+plant' },
            { label: 'Jade Plant', href: '/products?search=jade+plant' },
            { label: 'Areca Palm', href: '/products?search=areca+palm' },
          ],
        },
      ],
    ],
  },
  {
    label: 'SEEDS',
    href: '/products?category=seeds',
    groups: [
      [
        {
          links: [
            { label: 'Flower Seeds', href: '/products?category=flower-seeds' },
            { label: 'Vegetable Seeds', href: '/products?category=vegetable-seeds' },
            { label: 'Microgreen Seeds', href: '/products?category=microgreen-seeds' },
            { label: 'Herb Seeds', href: '/products?category=herb-seeds' },
            { label: 'Flower Bulbs', href: '/products?category=flower-bulbs' },
            { label: 'Seeds Kits', href: '/products?category=seeds-kits' },
          ],
        },
      ],
    ],
  },
  {
    label: 'POTS & PLANTERS',
    href: '/products?category=pots-planters',
    groups: [
      [
        {
          links: [
            { label: 'Plastic Pots', href: '/products?category=plastic-pots' },
            { label: 'Ceramic Pots', href: '/products?category=ceramic-pots' },
            { label: 'Metal Planters', href: '/products?category=metal-planters' },
            { label: 'Wooden Planters', href: '/products?category=wooden-planters' },
            { label: 'Hanging Planters', href: '/products?category=hanging-planters' },
            { label: 'Plant Stands', href: '/products?category=plant-stands' },
          ],
        },
      ],
    ],
  },
  {
    label: 'PLANT CARE',
    href: '/products?category=plant-care',
    groups: [
      [
        {
          links: [
            { label: 'Potting Mix & Fertilizers', href: '/products?category=potting-mix-fertilizers' },
            { label: 'Garden Tools', href: '/products?category=garden-tools' },
            { label: 'Watering Tools', href: '/products?category=watering-tools' },
            { label: 'Pest Control', href: '/products?category=pest-control' },
          ],
        },
      ],
    ],
  },
  { label: 'GIFTING', href: '/products?tag=gifting' },
  { label: 'CORPORATE GIFTS', href: '/pages/corporate-gifts' },
  { label: 'GARDEN SERVICES', href: '/pages/garden-services' },
  { label: 'BLOG', href: '/blog' },
  { label: 'OFFERS', href: '/products?tag=offers', highlight: true },
];

const WHATSAPP_NUMBER = '919999999999';

// ---------------------------------------------------------------------------
// Small components
// ---------------------------------------------------------------------------

function WhatsAppIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function MobileNavAccordion({
  items,
  onNavigate,
}: {
  items: NavItemDef[];
  onNavigate: () => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="space-y-0.5">
      {items.map((item) => {
        const hasGroups = item.groups && item.groups.length > 0;
        const isOpen = expanded === item.label;

        return (
          <div key={item.label}>
            <div className="flex items-center">
              <Link
                to={item.href}
                onClick={onNavigate}
                className={clsx(
                  'flex-1 py-3 text-sm font-medium transition-colors',
                  item.highlight ? 'text-accent' : 'hover:text-primary',
                )}
              >
                {item.label}
              </Link>
              {hasGroups && (
                <button
                  onClick={() => setExpanded(isOpen ? null : item.label)}
                  className="p-2 touch-target flex items-center justify-center"
                >
                  <ChevronDown
                    size={16}
                    className={clsx(
                      'transition-transform duration-200',
                      isOpen && 'rotate-180',
                    )}
                  />
                </button>
              )}
            </div>
            {isOpen && hasGroups && (
              <div className="pl-4 pb-2 space-y-3">
                {item.groups!.flat().map((group, gi) => (
                  <div key={gi}>
                    {group.title && (
                      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                        {group.title}
                      </p>
                    )}
                    {group.links.map((link) => (
                      <Link
                        key={link.href}
                        to={link.href}
                        onClick={onNavigate}
                        className="block py-1.5 text-sm text-gray-500 hover:text-primary transition-colors"
                      >
                        {link.label}
                      </Link>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Navbar
// ---------------------------------------------------------------------------

export default function Navbar() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  const navigate = useNavigate();
  const location = useLocation();
  const { user, openAuthModal, logout } = useAuthStore();
  const { itemCount, openDrawer } = useCartStore();

  const hoverTimeoutRef = useRef<number>(0);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  const debouncedQuery = useDebounce(searchQuery, 300);

  useBodyScrollLock(drawerOpen);

  // Cleanup hover timeout on unmount
  useEffect(() => () => clearTimeout(hoverTimeoutRef.current), []);

  // Scroll-based sticky shadow
  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 60);
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
        'sticky top-0 z-50 bg-white transition-shadow duration-200',
        scrolled && 'shadow-md border-b border-gray-100',
      )}
    >
      {/* ================================================================ */}
      {/* ROW 1 — Logo · Search · Icons                                    */}
      {/* ================================================================ */}
      <div className="max-w-7xl mx-auto px-3 sm:px-4 h-14 sm:h-16 flex items-center gap-3 sm:gap-4">
        {/* Hamburger (mobile) */}
        <button
          className="lg:hidden p-2 -ml-1 touch-target"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
        >
          <Menu size={22} />
        </button>

        {/* Logo */}
        <Link to="/" className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-primary flex items-center justify-center">
            <Leaf size={18} className="text-white" />
          </div>
          <span className="text-lg sm:text-xl font-bold text-primary tracking-tight">
            Plantoga
          </span>
        </Link>

        {/* Desktop search */}
        <div
          ref={searchContainerRef}
          className="hidden md:block flex-1 max-w-xl mx-4 relative"
        >
          <form onSubmit={handleSearch}>
            <div className="relative">
              <Search
                size={18}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                placeholder="Search for Garden..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setSearchFocused(false);
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-full bg-gray-50/80 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary-light transition placeholder:text-gray-400"
              />
            </div>
          </form>

          {/* Suggestions dropdown */}
          {showSuggestions && (
            <div className="absolute top-full mt-1.5 left-0 right-0 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50 animate-dropdown">
              {suggestions!.map((product) => (
                <Link
                  key={product.id}
                  to={`/products/${product.slug}`}
                  onClick={() => {
                    setSearchFocused(false);
                    setSearchQuery('');
                  }}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors"
                >
                  <img
                    src={
                      product.images?.[0] ||
                      'https://placehold.co/40x40?text=🌱'
                    }
                    alt=""
                    className="w-10 h-10 rounded-lg object-cover shrink-0 bg-gray-100"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {product.name}
                    </p>
                    <p className="text-xs text-primary font-semibold">
                      ₹{product.price}
                    </p>
                  </div>
                </Link>
              ))}
              <Link
                to={`/products?search=${encodeURIComponent(debouncedQuery)}`}
                onClick={() => {
                  setSearchFocused(false);
                  setSearchQuery('');
                }}
                className="block px-4 py-2.5 text-sm text-primary font-medium border-t hover:bg-gray-50 text-center"
              >
                See all results for &ldquo;{debouncedQuery}&rdquo;
              </Link>
            </div>
          )}
        </div>

        {/* Right icons */}
        <div className="flex items-center gap-0.5 sm:gap-1 ml-auto">
          {/* Mobile search toggle */}
          <button
            className="md:hidden p-2 touch-target"
            onClick={() => setSearchOpen(!searchOpen)}
            aria-label="Search"
          >
            <Search size={20} />
          </button>

          {/* WhatsApp */}
          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex p-2 text-gray-600 hover:text-green-600 transition-colors touch-target"
            aria-label="WhatsApp"
          >
            <WhatsAppIcon size={20} />
          </a>

          {/* Account */}
          {user ? (
            <div className="relative hidden md:block">
              <button
                className="p-2 flex items-center gap-1.5 text-gray-600 hover:text-primary transition-colors touch-target"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                aria-label="Account menu"
              >
                <User size={20} />
              </button>
              {userMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setUserMenuOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-1.5 w-52 bg-white rounded-xl shadow-xl border border-gray-100 z-50 py-1.5 overflow-hidden animate-dropdown">
                    <div className="px-4 py-2.5 border-b border-gray-100">
                      <p className="text-sm font-semibold text-gray-800 truncate">
                        {user.full_name || 'Account'}
                      </p>
                      <p className="text-xs text-gray-400 truncate">
                        {user.email}
                      </p>
                    </div>
                    {user.is_admin && (
                      <Link
                        to="/admin"
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-gray-50 text-primary font-medium"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <Settings size={15} /> Admin Panel
                      </Link>
                    )}
                    <Link
                      to="/orders"
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-gray-50 text-gray-700"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <Package size={15} /> My Orders
                    </Link>
                    <button
                      onClick={() => {
                        logout();
                        setUserMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-gray-50 text-red-500"
                    >
                      <LogOut size={15} /> Logout
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <button
              className="hidden md:flex p-2 text-gray-600 hover:text-primary transition-colors touch-target"
              onClick={openAuthModal}
              aria-label="Login"
            >
              <User size={20} />
            </button>
          )}

          {/* Cart */}
          <button
            className="hidden md:flex p-2 relative text-gray-600 hover:text-primary transition-colors touch-target"
            onClick={openDrawer}
            aria-label="Cart"
          >
            <ShoppingBag size={20} />
            {itemCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-accent text-white text-[10px] font-bold w-[18px] h-[18px] rounded-full flex items-center justify-center">
                {itemCount > 9 ? '9+' : itemCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ================================================================ */}
      {/* ROW 2 — Category navigation (desktop only)                       */}
      {/* ================================================================ */}
      <nav className="hidden lg:block border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4">
          <ul className="flex items-center text-[13px] font-semibold tracking-wide">
            {NAV_ITEMS.map((item) => {
              const hasDropdown = item.groups && item.groups.length > 0;
              const isOpen = activeDropdown === item.label;
              const active = isNavActive(item);
              const isWide = item.groups && item.groups.length > 1;

              return (
                <li
                  key={item.label}
                  className="relative"
                  onMouseEnter={
                    hasDropdown
                      ? () => handleDropdownEnter(item.label)
                      : undefined
                  }
                  onMouseLeave={hasDropdown ? handleDropdownLeave : undefined}
                >
                  <Link
                    to={item.href}
                    className={clsx(
                      'block px-3 xl:px-4 py-3 transition-colors relative whitespace-nowrap',
                      item.highlight
                        ? 'text-accent hover:text-accent/80'
                        : active
                          ? 'text-primary'
                          : 'text-gray-700 hover:text-primary',
                    )}
                  >
                    {item.label}
                    {active && (
                      <span className="absolute bottom-0 left-3 right-3 xl:left-4 xl:right-4 h-0.5 bg-primary rounded-full" />
                    )}
                  </Link>

                  {/* Dropdown */}
                  {hasDropdown && isOpen && (
                    <div
                      className={clsx(
                        'absolute top-full left-0 bg-white rounded-b-xl shadow-xl border border-t-0 border-gray-100 z-50 animate-dropdown',
                        isWide
                          ? 'grid grid-cols-2 gap-8 p-6 w-[520px]'
                          : 'p-5 w-60',
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
                                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                                  {group.title}
                                </p>
                              )}
                              <div className="space-y-0.5">
                                {group.links.map((link) => (
                                  <Link
                                    key={link.href}
                                    to={link.href}
                                    onClick={() => setActiveDropdown(null)}
                                    className="block py-1.5 text-sm font-normal text-gray-600 hover:text-primary hover:translate-x-0.5 transition-all"
                                  >
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
      {/* Mobile search bar (toggle)                                       */}
      {/* ================================================================ */}
      {searchOpen && (
        <form onSubmit={handleSearch} className="md:hidden px-3 pb-3">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              autoFocus
              placeholder="Search for Garden..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-full bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-light/40"
            />
          </div>
        </form>
      )}

      {/* ================================================================ */}
      {/* Mobile drawer                                                    */}
      {/* ================================================================ */}
      {drawerOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-50 lg:hidden"
            onClick={closeDrawer}
          />
          <div className="fixed top-0 left-0 w-[300px] h-full bg-white z-50 shadow-2xl flex flex-col lg:hidden overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b">
              <Link
                to="/"
                onClick={closeDrawer}
                className="flex items-center gap-2"
              >
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                  <Leaf size={16} className="text-white" />
                </div>
                <span className="text-lg font-bold text-primary">Plantoga</span>
              </Link>
              <button onClick={closeDrawer} className="p-2 touch-target">
                <X size={20} />
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

            {/* Nav links */}
            <div className="flex-1 overflow-y-auto p-4">
              <Link
                to="/"
                onClick={closeDrawer}
                className="block py-3 text-sm font-medium hover:text-primary"
              >
                Home
              </Link>
              <MobileNavAccordion items={NAV_ITEMS} onNavigate={closeDrawer} />
            </div>

            {/* Bottom actions */}
            <div className="border-t p-4 space-y-1">
              <a
                href={`https://wa.me/${WHATSAPP_NUMBER}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 py-2.5 text-sm text-gray-600 hover:text-green-600"
              >
                <WhatsAppIcon size={18} /> WhatsApp Us
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
