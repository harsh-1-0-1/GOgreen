import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronDown, HelpCircle, LogOut, Menu, Package, Search, Settings, ShoppingCart, User, X } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useCartStore } from '@/store/cartStore';
import { useCategories } from '@/hooks/useCategories';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';

function CategoryAccordion({ categories, onNavigate }: { categories: any[]; onNavigate: () => void }) {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <div className="space-y-1">
      {categories.map((cat) => {
        const hasChildren = cat.children && cat.children.length > 0;
        const isOpen = expanded === cat.slug;
        return (
          <div key={cat.slug}>
            <div className="flex items-center">
              <Link
                to={`/products?category=${cat.slug}`}
                onClick={onNavigate}
                className="flex-1 py-3 text-sm font-medium hover:text-primary transition-colors"
              >
                {cat.name}
              </Link>
              {hasChildren && (
                <button
                  onClick={() => setExpanded(isOpen ? null : cat.slug)}
                  className="p-2 touch-target flex items-center justify-center"
                >
                  <ChevronDown size={16} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
              )}
            </div>
            {isOpen && hasChildren && (
              <div className="pl-4 pb-1 space-y-0.5">
                {cat.children.map((child: any) => (
                  <Link
                    key={child.slug}
                    to={`/products?category=${child.slug}`}
                    onClick={onNavigate}
                    className="block py-2 text-sm text-gray-500 hover:text-primary transition-colors"
                  >
                    {child.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function Navbar() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const navigate = useNavigate();
  const { user, openAuthModal, logout } = useAuthStore();
  const { itemCount, openDrawer } = useCartStore();
  const { data: categories } = useCategories();

  useBodyScrollLock(drawerOpen);

  const topCategories = categories?.filter((c) => !c.parent_id).slice(0, 5) ?? [];

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/products?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
      setSearchOpen(false);
      setDrawerOpen(false);
    }
  }

  function closeDrawer() {
    setDrawerOpen(false);
  }

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
      {/* Promo bar */}
      <div className="bg-primary text-white text-center text-[11px] sm:text-xs py-1.5 px-4 tracking-wide">
        Free shipping on orders above ₹499 | Use code PLANT10 for 10% off
      </div>

      <nav className="max-w-7xl mx-auto px-3 sm:px-4 h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-4">
        {/* Left: hamburger (mobile) */}
        <button
          className="lg:hidden p-2 -ml-1 touch-target"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
        >
          <Menu size={22} />
        </button>

        {/* Logo */}
        <Link to="/" className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary flex items-center justify-center">
            <span className="text-white font-bold text-xs sm:text-sm">G</span>
          </div>
          <span className="text-lg sm:text-xl font-bold text-primary">GOgreen</span>
        </Link>

        {/* Desktop category links */}
        <div className="hidden lg:flex items-center gap-6 text-sm font-medium">
          {topCategories.map((cat) => (
            <Link
              key={cat.slug}
              to={`/products?category=${cat.slug}`}
              className="text-gray-600 hover:text-primary transition-colors"
            >
              {cat.name}
            </Link>
          ))}
        </div>

        {/* Desktop search */}
        <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-md mx-4">
          <div className="relative w-full">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search plants, pots, seeds..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-full bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-light/40 focus:border-primary-light transition"
            />
          </div>
        </form>

        {/* Right icons */}
        <div className="flex items-center gap-0.5 sm:gap-1">
          <button
            className="md:hidden p-2 touch-target"
            onClick={() => setSearchOpen(!searchOpen)}
            aria-label="Search"
          >
            <Search size={20} />
          </button>

          {/* Cart — hidden on mobile since BottomNav has it */}
          <button
            className="hidden md:flex p-2 relative touch-target"
            onClick={openDrawer}
            aria-label="Cart"
          >
            <ShoppingCart size={20} />
            {itemCount > 0 && (
              <span className="absolute top-0 right-0 bg-accent text-white text-[10px] font-bold w-4.5 h-4.5 rounded-full flex items-center justify-center">
                {itemCount > 9 ? '9+' : itemCount}
              </span>
            )}
          </button>

          {/* User dropdown — desktop only */}
          {user ? (
            <div className="relative hidden md:block">
              <button
                className="p-2 flex items-center gap-1.5 touch-target"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
              >
                <div className="w-7 h-7 rounded-full bg-primary-light/20 flex items-center justify-center">
                  <User size={14} className="text-primary" />
                </div>
              </button>
              {userMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border z-50 py-1">
                    {user.is_admin && (
                      <Link to="/admin" className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-gray-50 text-primary font-medium" onClick={() => setUserMenuOpen(false)}>
                        <Settings size={15} /> Admin Panel
                      </Link>
                    )}
                    <Link to="/orders" className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-gray-50" onClick={() => setUserMenuOpen(false)}>
                      <Package size={15} /> My Orders
                    </Link>
                    <button onClick={() => { logout(); setUserMenuOpen(false); }} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-gray-50 text-red-600">
                      <LogOut size={15} /> Logout
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <button
              className="hidden md:block px-4 py-1.5 text-sm font-medium bg-primary text-white rounded-full hover:bg-primary/90 transition"
              onClick={openAuthModal}
            >
              Login
            </button>
          )}
        </div>
      </nav>

      {/* Mobile search bar (toggle) */}
      {searchOpen && (
        <form onSubmit={handleSearch} className="md:hidden px-3 pb-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              autoFocus
              placeholder="Search plants, pots, seeds..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-full bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-light/40"
            />
          </div>
        </form>
      )}

      {/* Mobile drawer */}
      {drawerOpen && (
        <>
          <div className="fixed inset-0 bg-black/40 z-50 lg:hidden" onClick={closeDrawer} />
          <div className="fixed top-0 left-0 w-[280px] h-full bg-white z-50 shadow-xl flex flex-col lg:hidden overflow-hidden">
            {/* Drawer header */}
            <div className="flex items-center justify-between p-4 border-b">
              <span className="text-lg font-bold text-primary">GOgreen</span>
              <button onClick={closeDrawer} className="p-2 touch-target"><X size={20} /></button>
            </div>

            {/* User section */}
            <div className="p-4 border-b bg-gray-50">
              {user ? (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary-light/20 flex items-center justify-center">
                    <User size={20} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{user.full_name || user.email}</p>
                    <p className="text-xs text-gray-500">{user.email}</p>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => { closeDrawer(); openAuthModal(); }}
                  className="w-full py-2.5 bg-primary text-white rounded-lg text-sm font-medium"
                >
                  Login / Register
                </button>
              )}
            </div>

            {/* Category links with accordion */}
            <div className="flex-1 overflow-y-auto p-4">
              <Link to="/" onClick={closeDrawer} className="block py-3 text-sm font-medium hover:text-primary">Home</Link>
              <CategoryAccordion categories={topCategories} onNavigate={closeDrawer} />
              <Link to="/products" onClick={closeDrawer} className="block py-3 text-sm font-medium hover:text-primary border-t mt-2 pt-4">All Products</Link>
            </div>

            {/* Bottom links */}
            <div className="border-t p-4 space-y-1">
              {user && (
                <Link to="/orders" onClick={closeDrawer} className="flex items-center gap-3 py-2.5 text-sm text-gray-600 hover:text-primary">
                  <Package size={18} /> My Orders
                </Link>
              )}
              {user?.is_admin && (
                <Link to="/admin" onClick={closeDrawer} className="flex items-center gap-3 py-2.5 text-sm text-primary font-medium">
                  <Settings size={18} /> Admin Panel
                </Link>
              )}
              {user && (
                <button onClick={() => { logout(); closeDrawer(); }} className="flex items-center gap-3 py-2.5 text-sm text-red-600 w-full">
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
