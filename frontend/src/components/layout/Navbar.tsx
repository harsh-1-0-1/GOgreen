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
import { useBanners } from '@/hooks/useBanners';
import type { Banner, ProductListResponse } from '@/types';

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
            { label: 'Balcony', href: '/products?tags=balcony' },
            { label: 'Workspace', href: '/products?tags=workspace' },
            { label: 'Living Room', href: '/products?tags=living-room' },
            { label: 'Bedroom', href: '/products?tags=bedroom' },
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
  { label: 'GIFTING', href: '/products?tags=gifting' },
  { label: 'CORPORATE GIFTS', href: '/products?tags=corporate-gifts' },
  { label: 'GARDEN SERVICES', href: '/products?tags=garden-services' },
  { label: 'BLOG', href: '/blog' },
  { label: 'OFFERS', href: '/products?tags=offers', highlight: true },
];

const WHATSAPP_NUMBER = '919999999999';

// Collection-style mobile menu entries — visual rows with images.
// Mirrors the main nav but flattened for thumb-first navigation.
interface MobileCollection {
  label: string;
  href: string;
  image: string;
  accent: string; // soft watercolor blob color behind image
}

const MOBILE_COLLECTIONS: MobileCollection[] = [
  {
    label: 'Plants',
    href: '/products?category=plants',
    image:
      'https://images.unsplash.com/photo-1592150621744-aca64f48394a?w=280&q=80',
    accent: '#f9c8d4', // pink
  },
  {
    label: 'Seeds',
    href: '/products?category=seeds',
    image:
      'https://images.unsplash.com/photo-1592321675774-3de57f3ee0dc?w=280&q=80',
    accent: '#f9e4a0', // yellow
  },
  {
    label: 'Planters',
    href: '/products?category=pots-planters',
    image:
      'https://images.unsplash.com/photo-1622398925373-3f91b1e275f5?w=280&q=80',
    accent: '#f9c8d4',
  },
  {
    label: 'Plant Care',
    href: '/products?category=plant-care',
    image:
      'https://images.unsplash.com/photo-1584132967334-10e028bd69f7?w=280&q=80',
    accent: '#f9e4a0',
  },
  {
    label: 'Gifting',
    href: '/products?tags=gifting',
    image:
      'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=280&q=80',
    accent: '#f9c8d4',
  },
  {
    label: 'Blog',
    href: '/blog',
    image:
      'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=280&q=80',
    accent: '#f9c8d4',
  },
  {
    label: 'Offers',
    href: '/products?tags=offers',
    image:
      'https://images.unsplash.com/photo-1560693225-b8507d6f3aa9?w=280&q=80',
    accent: '#f9e4a0',
  },
];

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

function bannerToCollection(b: Banner): MobileCollection {
  return {
    label: b.title,
    href: b.cta_link || '/products',
    image: b.image_url || '',
    accent: b.bg_color || '#f9c8d4',
  };
}

// Map collection labels to their NAV_ITEMS subcategory groups
const LABEL_TO_NAV: Record<string, NavItemDef | undefined> = {};
for (const item of NAV_ITEMS) {
  const key = item.label.charAt(0) + item.label.slice(1).toLowerCase();
  LABEL_TO_NAV[key] = item;
}
LABEL_TO_NAV['Planters'] = NAV_ITEMS.find((n) => n.label === 'POTS & PLANTERS');

function CollectionAccordionRow({
  item,
  navItem,
  expanded,
  onToggle,
  onNavigate,
}: {
  item: MobileCollection;
  navItem?: NavItemDef;
  expanded: boolean;
  onToggle: () => void;
  onNavigate: () => void;
}) {
  const hasGroups = navItem?.groups && navItem.groups.length > 0;

  return (
    <li className="bg-white rounded-xl overflow-hidden">
      {/* Main row — image card */}
      <div className="relative flex items-center overflow-hidden">
        <Link
          to={item.href}
          onClick={onNavigate}
          className="flex-1 flex items-center active:bg-[#f5f5f5] transition-colors"
          style={{ height: 100, paddingLeft: 20 }}
        >
          <span
            className="relative z-10"
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: '#16A34A',
              lineHeight: 1.1,
            }}
          >
            {item.label}
          </span>
        </Link>

        {/* Right side: image + optional expand button */}
        <div className="flex items-center shrink-0" style={{ height: 100 }}>
          {hasGroups && (
            <button
              onClick={onToggle}
              className="relative z-10 w-10 h-10 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
              aria-label={expanded ? 'Collapse' : 'Expand'}
            >
              <ChevronDown
                size={18}
                className={clsx(
                  'transition-transform duration-200',
                  expanded && 'rotate-180',
                )}
              />
            </button>
          )}
          <span className="relative shrink-0" style={{ width: 90, height: 100 }}>
            <span
              aria-hidden
              className="absolute"
              style={{
                top: 10,
                left: -25,
                width: 70,
                height: 70,
                opacity: 0.3,
                borderRadius: '40% 60% 70% 30% / 50% 40% 60% 50%',
                backgroundColor: item.accent,
              }}
            />
            {item.image && (
              <img
                src={item.image}
                alt=""
                loading="lazy"
                className="absolute"
                style={{
                  top: 0,
                  right: 0,
                  width: 90,
                  height: 100,
                  objectFit: 'cover',
                  zIndex: 1,
                  borderTopRightRadius: 12,
                  borderBottomRightRadius: 12,
                }}
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            )}
          </span>
        </div>
      </div>

      {/* Expanded subcategories */}
      {expanded && hasGroups && (
        <div className="px-5 pb-4 pt-1 border-t border-gray-100">
          {navItem!.groups!.flat().map((group, gi) => (
            <div key={gi} className={gi > 0 ? 'mt-3' : ''}>
              {group.title && (
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 pb-1 border-b border-gray-50">
                  {group.title}
                </p>
              )}
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                {group.links.map((link) => (
                  <Link
                    key={link.href}
                    to={link.href}
                    onClick={onNavigate}
                    className="py-2 text-[13px] text-gray-600 hover:text-secondary active:text-secondary transition-colors truncate"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
          <Link
            to={navItem!.href}
            onClick={onNavigate}
            className="inline-flex items-center gap-1 mt-3 text-xs font-semibold text-secondary hover:underline"
          >
            View All {item.label} →
          </Link>
        </div>
      )}
    </li>
  );
}

function MobileCollectionList({ onNavigate }: { onNavigate: () => void }) {
  const { data: banners = [] } = useBanners('collection');
  const rows: MobileCollection[] =
    banners.length > 0
      ? banners.map(bannerToCollection)
      : MOBILE_COLLECTIONS;

  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <ul className="flex flex-col gap-2.5 px-3 py-3 bg-[#fafafa]">
      {rows.map((item) => {
        const navItem = LABEL_TO_NAV[item.label];
        return (
          <CollectionAccordionRow
            key={item.label}
            item={item}
            navItem={navItem}
            expanded={expanded === item.label}
            onToggle={() =>
              setExpanded(expanded === item.label ? null : item.label)
            }
            onNavigate={onNavigate}
          />
        );
      })}
    </ul>
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
      {/* ROW 1 — Logo · Search · Icons (Ugaoo-style)                      */}
      {/* ================================================================ */}
      <div className="mx-auto px-4 sm:px-6 lg:px-10 xl:px-16 h-[64px] sm:h-[76px] flex items-center gap-3 sm:gap-6">

        {/* Hamburger — visible on every breakpoint */}
        <button
          className="p-2 -ml-1 text-gray-700 hover:text-primary transition-colors touch-target"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
        >
          <Menu size={24} />
        </button>

        {/* Logo — left-aligned, prominent */}
        <Link to="/" className="flex items-center gap-2.5 shrink-0 group">
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-primary flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
            <Leaf size={22} className="text-white" />
          </div>
          <span className="text-2xl sm:text-[28px] font-bold text-primary tracking-tight leading-none">
            Plantoga
          </span>
        </Link>

        {/* Desktop Search — centered, wide pill with embedded button */}
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
                    src={product.images?.[0] || 'https://placehold.co/40x40?text=🌱'}
                    alt=""
                    className="w-10 h-10 rounded-xl object-cover shrink-0 bg-gray-100"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{product.name}</p>
                    <p className="text-xs text-primary font-semibold mt-0.5">₹{product.price}</p>
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

        {/* Right Icons — clean, spaced */}
        <div className="flex items-center gap-1 ml-auto">
          {/* Mobile search toggle — hidden on home (home has persistent bar below) */}
          {!isHome && (
            <button
              className="md:hidden p-2 text-gray-700 hover:text-primary transition-colors touch-target"
              onClick={() => setSearchOpen(!searchOpen)}
              aria-label="Search"
            >
              <Search size={22} />
            </button>
          )}

          {/* WhatsApp */}
          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center justify-center w-10 h-10 rounded-full text-gray-600 hover:text-green-600 hover:bg-green-50 transition-all"
            aria-label="WhatsApp"
          >
            <WhatsAppIcon size={22} />
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

          {/* Cart — visible on all breakpoints */}
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
      {/* ROW 2 — Category navigation (desktop only)                       */}
      {/* ================================================================ */}
      {/* ================================================================ */}
      {/* ROW 2 — Category navigation (desktop only, Ugaoo-style)          */}
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
      {/* Home: always visible | Other pages: toggle via icon              */}
      {/* ================================================================ */}
      {(isHome || searchOpen) && (
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
                className="w-full pl-10 pr-12 py-3 border-2 border-gray-200 rounded-full bg-gray-50 focus:outline-none focus:border-secondary text-sm transition-all placeholder:text-gray-400"
              />
              <button
                type="submit"
                className="absolute right-1.5 h-9 w-9 rounded-full flex items-center justify-center text-white transition-colors"
                style={{ backgroundColor: '#16A34A' }}
              >
                <Search size={15} />
              </button>
            </div>
          </form>
        </div>
      )}

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
              <MobileCollectionList onNavigate={closeDrawer} />
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
