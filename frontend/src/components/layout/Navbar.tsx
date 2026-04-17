import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, Search, ShoppingCart, User, X, LogOut, Package } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useCartStore } from '@/store/cartStore';
import { useCategories } from '@/hooks/useCategories';

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const navigate = useNavigate();
  const { user, openAuthModal, logout } = useAuthStore();
  const { itemCount, openDrawer } = useCartStore();
  const { data: categories } = useCategories();

  const topCategories = categories
    ?.filter((c) => !c.parent_id)
    .slice(0, 5) ?? [];

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/products?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
      setSearchOpen(false);
      setMobileOpen(false);
    }
  }

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
      {/* Top bar */}
      <div className="bg-primary text-white text-center text-xs py-1.5 tracking-wide">
        Free shipping on orders above ₹499 | Use code PLANT10 for 10% off
      </div>

      <nav className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        {/* Mobile menu toggle */}
        <button
          className="lg:hidden p-2 -ml-2"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X size={22} /> : <Menu size={22} />}
        </button>

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <span className="text-white font-bold text-sm">G</span>
          </div>
          <span className="text-xl font-bold text-primary hidden sm:block">GOgreen</span>
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
        <form
          onSubmit={handleSearch}
          className="hidden md:flex flex-1 max-w-md mx-4"
        >
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
        <div className="flex items-center gap-2">
          <button
            className="md:hidden p-2"
            onClick={() => setSearchOpen(!searchOpen)}
            aria-label="Search"
          >
            <Search size={20} />
          </button>

          {/* Cart */}
          <button
            className="p-2 relative"
            onClick={openDrawer}
            aria-label="Cart"
          >
            <ShoppingCart size={20} />
            {itemCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-accent text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                {itemCount > 9 ? '9+' : itemCount}
              </span>
            )}
          </button>

          {/* User */}
          {user ? (
            <div className="relative">
              <button
                className="p-2 flex items-center gap-1.5"
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
                    <Link
                      to="/orders"
                      className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-gray-50"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <Package size={15} /> My Orders
                    </Link>
                    <button
                      onClick={() => { logout(); setUserMenuOpen(false); }}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-gray-50 text-red-600"
                    >
                      <LogOut size={15} /> Logout
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <button
              className="px-4 py-1.5 text-sm font-medium bg-primary text-white rounded-full hover:bg-primary/90 transition"
              onClick={openAuthModal}
            >
              Login
            </button>
          )}
        </div>
      </nav>

      {/* Mobile search bar */}
      {searchOpen && (
        <form onSubmit={handleSearch} className="md:hidden px-4 pb-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              autoFocus
              placeholder="Search plants, pots, seeds..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-full bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-light/40"
            />
          </div>
        </form>
      )}

      {/* Mobile menu drawer */}
      {mobileOpen && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />
          <div className="fixed top-0 left-0 w-72 h-full bg-white z-50 shadow-xl p-6 lg:hidden overflow-y-auto">
            <div className="flex items-center justify-between mb-8">
              <span className="text-xl font-bold text-primary">GOgreen</span>
              <button onClick={() => setMobileOpen(false)}><X size={20} /></button>
            </div>
            <nav className="flex flex-col gap-3">
              <Link to="/" className="py-2 text-sm font-medium hover:text-primary" onClick={() => setMobileOpen(false)}>
                Home
              </Link>
              {topCategories.map((cat) => (
                <Link
                  key={cat.slug}
                  to={`/products?category=${cat.slug}`}
                  className="py-2 text-sm font-medium hover:text-primary"
                  onClick={() => setMobileOpen(false)}
                >
                  {cat.name}
                </Link>
              ))}
              <Link to="/products" className="py-2 text-sm font-medium hover:text-primary" onClick={() => setMobileOpen(false)}>
                All Products
              </Link>
            </nav>
          </div>
        </>
      )}
    </header>
  );
}
