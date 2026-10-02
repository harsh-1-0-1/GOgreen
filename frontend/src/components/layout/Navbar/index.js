import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowUpRight, ChevronDown, ChevronLeft, ChevronRight, FileCheck2, LogOut, Menu, Package, Search, Settings, ShieldCheck, ShoppingBag, User, X, } from 'lucide-react';
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
import { FALLBACK_GIFTING_SUBMENU, WHATSAPP_NUMBER, categoryLink, categoryTreeToNavItems, resolveSubcategories, } from './navData';
import { LOGO_PATH } from '@/lib/branding';
export default function Navbar() {
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [activeSubmenu, setActiveSubmenu] = useState(null);
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchFocused, setSearchFocused] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const [hidden, setHidden] = useState(false);
    const [activeDropdown, setActiveDropdown] = useState(null);
    const lastScrollY = useRef(0);
    const navigate = useNavigate();
    const location = useLocation();
    const { user, openAuthModal, logout } = useAuthStore();
    const { itemCount, openDrawer } = useCartStore();
    const hoverTimeoutRef = useRef(0);
    const searchContainerRef = useRef(null);
    const debouncedQuery = useDebounce(searchQuery, 300);
    const isProductPage = /^\/products\/[^/]+/.test(location.pathname);
    // Close search when leaving a product page. Adjusting state during render
    // (guarded by the previous value) replaces a synchronous setState effect.
    const [wasProductPage, setWasProductPage] = useState(isProductPage);
    if (wasProductPage !== isProductPage) {
        setWasProductPage(isProductPage);
        if (!isProductPage)
            setSearchOpen(false);
    }
    const { data: mobilePromoBanners = [] } = useBanners('mobile_promo');
    const mobilePromoBanner = mobilePromoBanners[0];
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
            }
            else {
                const diff = currentScrollY - lastScrollY.current;
                if (diff > 10)
                    setHidden(true); // scroll down → hide top navbar
                else if (diff < -10)
                    setHidden(false); // scroll up → show top navbar
            }
            // Hide search bar on any scroll
            if (Math.abs(currentScrollY - lastScrollY.current) > 5) {
                setSearchOpen(false);
            }
            lastScrollY.current = currentScrollY;
        }
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);
    // Click-outside to close search bar & suggestions
    useEffect(() => {
        function onPointerDown(e) {
            if (searchContainerRef.current &&
                !searchContainerRef.current.contains(e.target)) {
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
            const { data } = await api.get('/products', {
                params: { search: debouncedQuery, limit: 5 },
            });
            return data.items;
        },
        enabled: debouncedQuery.length >= 2,
    });
    const showSuggestions = searchFocused &&
        debouncedQuery.length >= 2 &&
        suggestions &&
        suggestions.length > 0;
    // ---- Handlers ----------------------------------------------------------
    function handleSearch(e) {
        e.preventDefault();
        if (searchQuery.trim()) {
            navigate(`/products?search=${encodeURIComponent(searchQuery.trim())}`);
            setSearchQuery('');
            setSearchFocused(false);
            setSearchOpen(false);
            setDrawerOpen(false);
        }
    }
    function handleDropdownEnter(label) {
        clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = window.setTimeout(() => setActiveDropdown(label), 200);
    }
    function handleDropdownLeave() {
        clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = window.setTimeout(() => setActiveDropdown(null), 150);
    }
    function closeDrawer() {
        setDrawerOpen(false);
        setActiveSubmenu(null);
    }
    // Dynamic submenu resolver (DB-driven category tree + menu items)
    function getSubcategories(label) {
        if (useFallback) {
            if (label.toLowerCase().trim() === 'gifting')
                return FALLBACK_GIFTING_SUBMENU;
            return resolveSubcategories(categories, label, []);
        }
        return resolveSubcategories(categories, label, effectiveMenuItems);
    }
    function isNavActive(item) {
        const params = new URLSearchParams(location.search);
        const currentCategory = params.get('category') || '';
        const currentTag = params.get('tags') || params.get('tag') || '';
        const [itemPath, itemSearch] = item.href.split('?');
        const itemParams = new URLSearchParams(itemSearch || '');
        if (itemParams.get('category') === currentCategory && currentCategory)
            return true;
        if ((itemParams.get('tags') || itemParams.get('tag')) === currentTag && currentTag)
            return true;
        if (!item.href.startsWith('/products') &&
            location.pathname === itemPath)
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
    return (_jsxs("header", { className: clsx('sticky top-0 z-50 bg-white transition-transform duration-300 ease-in-out', scrolled && 'shadow-[0_2px_12px_rgba(0,0,0,0.08)] border-b border-gray-100', hidden && '-translate-y-full'), children: [_jsxs("div", { className: "mx-auto px-4 sm:px-6 lg:px-10 xl:px-16 flex items-center gap-3 sm:gap-6 relative h-[84px] sm:h-[96px] lg:h-[104px]", children: [_jsx("button", { className: "p-2 -ml-1 text-gray-700 hover:text-primary transition-colors touch-target lg:hidden", onClick: () => setDrawerOpen(true), "aria-label": "Open menu", children: _jsx(Menu, { size: 24 }) }), _jsx(Link, { to: "/", className: "absolute left-1/2 -translate-x-1/2 lg:relative lg:left-auto lg:translate-x-0 flex items-center shrink-0 group z-10", children: _jsx("img", { src: LOGO_PATH, alt: "Plantoga", className: "object-contain w-auto h-[76px] sm:h-[88px] lg:h-[96px]" }) }), _jsxs("div", { className: "flex items-center gap-1 ml-auto shrink-0", children: [user ? (_jsxs("div", { className: "relative hidden lg:block", children: [_jsx("button", { className: "flex items-center justify-center w-11 h-11 rounded-full text-gray-600 hover:text-primary hover:bg-primary/5 transition-all", onClick: () => setUserMenuOpen(!userMenuOpen), "aria-label": "Account menu", children: _jsx(User, { size: 21 }) }), userMenuOpen && (_jsxs(_Fragment, { children: [_jsx("div", { className: "fixed inset-0 z-40", onClick: () => setUserMenuOpen(false) }), _jsxs("div", { className: "absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 py-2 overflow-hidden animate-dropdown", children: [_jsxs("div", { className: "px-4 py-3 border-b border-gray-100", children: [_jsx("p", { className: "text-sm font-semibold text-gray-900 truncate", children: user.full_name || 'Account' }), _jsx("p", { className: "text-xs text-gray-400 truncate mt-0.5", children: user.email })] }), user.is_admin && (_jsxs(Link, { to: "/admin", className: "flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-gray-50 text-primary font-medium transition-colors", onClick: () => setUserMenuOpen(false), children: [_jsx(Settings, { size: 15 }), " Admin Panel"] })), _jsxs(Link, { to: "/orders", className: "flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-gray-50 text-gray-700 transition-colors", onClick: () => setUserMenuOpen(false), children: [_jsx(Package, { size: 15 }), " My Orders"] }), _jsxs(Link, { to: "/damage-replacement", className: "flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-gray-50 text-gray-700 transition-colors", onClick: () => setUserMenuOpen(false), children: [_jsx(ShieldCheck, { size: 15 }), " Damage Replacement"] }), _jsxs(Link, { to: "/damage-claims", className: "flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-gray-50 text-gray-700 transition-colors", onClick: () => setUserMenuOpen(false), children: [_jsx(FileCheck2, { size: 15 }), " My Damage Claims"] }), _jsxs("button", { onClick: () => {
                                                            logout();
                                                            setUserMenuOpen(false);
                                                        }, className: "w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-red-50 text-red-500 transition-colors", children: [_jsx(LogOut, { size: 15 }), " Logout"] })] })] }))] })) : (_jsx("button", { className: "hidden lg:flex items-center justify-center w-11 h-11 rounded-full text-gray-600 hover:text-primary hover:bg-primary/5 transition-all", onClick: openAuthModal, "aria-label": "Login", children: _jsx(User, { size: 22 }) })), _jsx("button", { className: "flex items-center justify-center w-10 h-10 lg:w-11 lg:h-11 rounded-full text-gray-600 hover:text-primary hover:bg-primary/5 transition-all", onClick: () => {
                                    setSearchOpen((prev) => {
                                        const next = !prev;
                                        if (next) {
                                            // Focus the input after state update + DOM paint
                                            setTimeout(() => {
                                                document.querySelector('.mobile-search-input')?.focus();
                                            }, 50);
                                        }
                                        return next;
                                    });
                                }, "aria-label": "Search", children: _jsx(Search, { size: 21 }) }), _jsxs("button", { className: "flex items-center justify-center w-10 h-10 lg:w-11 lg:h-11 rounded-full relative text-gray-600 hover:text-primary hover:bg-primary/5 transition-all", onClick: openDrawer, "aria-label": "Cart", children: [_jsx(ShoppingBag, { size: 21 }), itemCount > 0 && (_jsx("span", { className: "absolute top-0 right-0 lg:top-0.5 lg:right-0.5 bg-accent text-white text-[9px] font-bold w-[17px] h-[17px] rounded-full flex items-center justify-center shadow-sm", children: itemCount > 9 ? '9+' : itemCount }))] })] })] }), _jsx("nav", { className: "hidden lg:block border-t border-gray-100", children: _jsxs("div", { className: "mx-auto px-4 sm:px-6 lg:px-10 xl:px-16 overflow-x-auto scrollbar-hide", style: { scrollbarWidth: 'none', msOverflowStyle: 'none' }, children: [_jsx("style", { children: `.scrollbar-hide::-webkit-scrollbar { display: none; }` }), _jsx("ul", { className: "flex items-center justify-center text-[14px] font-semibold tracking-[0.03em] gap-0 min-w-max", children: categoryNavItems.map((item) => {
                                const hasDropdown = item.groups && item.groups.length > 0;
                                const isOpen = activeDropdown === item.label;
                                const active = isNavActive(item);
                                const isWide = item.groups && item.groups.length > 1;
                                return (_jsxs("li", { className: "relative", onMouseEnter: hasDropdown ? () => handleDropdownEnter(item.label) : undefined, onMouseLeave: hasDropdown ? handleDropdownLeave : undefined, children: [_jsxs(Link, { to: item.href, className: clsx('flex items-center gap-1.5 px-5 py-4 transition-colors relative whitespace-nowrap group', item.highlight
                                                ? 'text-accent hover:text-accent/80'
                                                : active
                                                    ? 'text-primary'
                                                    : 'text-gray-700 hover:text-primary'), children: [item.label, hasDropdown && (_jsx(ChevronDown, { size: 12, className: clsx('opacity-60 transition-transform duration-200 mt-px', isOpen && 'rotate-180') })), _jsx("span", { className: clsx('absolute bottom-0 left-5 right-5 h-[2px] bg-primary rounded-full transition-transform duration-200 origin-left', active ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100') })] }), hasDropdown && isOpen && (_jsx("div", { className: clsx('absolute top-full left-0 bg-white rounded-b-2xl shadow-2xl border border-t-0 border-gray-100 z-50 animate-dropdown', isWide
                                                ? 'grid grid-cols-2 gap-8 p-6 w-[540px]'
                                                : 'p-5 w-64'), onMouseEnter: () => {
                                                clearTimeout(hoverTimeoutRef.current);
                                                setActiveDropdown(item.label);
                                            }, onMouseLeave: handleDropdownLeave, children: item.groups.map((col, ci) => (_jsx("div", { className: "space-y-5", children: col.map((group, gi) => (_jsxs("div", { children: [group.title && (_jsx("p", { className: "text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2.5 pb-1.5 border-b border-gray-100", children: group.title })), _jsx("div", { className: "space-y-0", children: group.links.map((link) => (_jsxs(Link, { to: link.href, onClick: () => setActiveDropdown(null), className: "flex items-center gap-1.5 py-1.5 text-[13px] font-normal text-gray-600 hover:text-primary hover:translate-x-1 transition-all duration-150", children: [_jsx("span", { className: "w-1 h-1 rounded-full bg-gray-300 group-hover:bg-primary transition-colors shrink-0" }), link.label] }, link.href))) })] }, gi))) }, ci))) }))] }, item.label));
                            }) })] }) }), _jsx("div", { ref: searchContainerRef, className: `${searchOpen ? 'block' : 'hidden'} bg-white px-4 py-3 border-t border-gray-100 relative`, children: _jsxs("div", { className: "mx-auto max-w-4xl", children: [_jsx("form", { onSubmit: handleSearch, children: _jsxs("div", { className: "relative flex items-center", children: [_jsx(Search, { size: 16, className: "absolute left-4 text-gray-400 pointer-events-none" }), _jsx("input", { type: "text", placeholder: "Search for plants, seeds, pots...", value: searchQuery, onChange: (e) => setSearchQuery(e.target.value), onFocus: () => setSearchFocused(true), onKeyDown: (e) => {
                                            if (e.key === 'Escape') {
                                                setSearchOpen(false);
                                                setSearchFocused(false);
                                            }
                                        }, className: "mobile-search-input w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-full bg-gray-50 focus:outline-none focus:border-primary focus:bg-white text-sm transition-all placeholder:text-gray-400" }), _jsx("button", { type: "submit", className: "sr-only", children: "Search" })] }) }), showSuggestions && (_jsxs("div", { className: "absolute top-full mt-2 left-4 right-4 sm:left-6 sm:right-6 lg:left-10 lg:right-10 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50 animate-dropdown", children: [suggestions.map((product) => (_jsxs(Link, { to: `/products/${product.slug}`, onClick: () => {
                                        setSearchOpen(false);
                                        setSearchFocused(false);
                                        setSearchQuery('');
                                    }, className: "flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0", children: [product.images?.[0] ? (_jsx("img", { src: product.images?.[0], alt: "", className: "w-10 h-10 rounded-xl object-cover shrink-0 bg-gray-100" })) : (_jsx("div", { className: "w-10 h-10 rounded-xl bg-gray-100 shrink-0" })), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("p", { className: "text-sm font-medium text-gray-800 truncate", children: product.name }), _jsxs("p", { className: "text-xs text-primary font-semibold mt-0.5", children: ["\u20B9", product.price] })] })] }, product.id))), _jsxs(Link, { to: `/products?search=${encodeURIComponent(debouncedQuery)}`, onClick: () => {
                                        setSearchOpen(false);
                                        setSearchFocused(false);
                                        setSearchQuery('');
                                    }, className: "flex items-center justify-center gap-2 px-4 py-3 text-sm text-primary font-semibold hover:bg-primary/5 transition-colors", children: [_jsx(Search, { size: 14 }), " View all results for \u201C", debouncedQuery, "\u201D"] })] }))] }) }), _jsxs("div", { className: clsx("fixed inset-0 z-50 transition-all duration-500", drawerOpen ? "visible" : "invisible pointer-events-none"), children: [_jsx("div", { className: clsx("absolute inset-0 bg-black/60 backdrop-blur-[3px] transition-opacity duration-500 ease-in-out", drawerOpen ? "opacity-100" : "opacity-0"), onClick: closeDrawer }), _jsx("div", { className: clsx("fixed top-0 left-0 w-[82vw] max-w-[360px] sm:max-w-[380px] h-full bg-[#FAFBF9] shadow-[20px_0_40px_rgba(0,0,0,0.12)] flex flex-col overflow-hidden transition-transform duration-500", drawerOpen ? "translate-x-0" : "-translate-x-full"), style: { transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }, children: _jsxs("div", { className: "w-[200%] h-full flex transition-transform duration-500", style: {
                                transform: activeSubmenu ? 'translateX(-50%)' : 'translateX(0)',
                                transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
                            }, children: [_jsxs("div", { className: "w-1/2 h-full flex flex-col shrink-0 overflow-hidden", children: [_jsxs("div", { className: "relative flex items-center justify-center px-5 py-4 shrink-0", children: [_jsx(Link, { to: "/", onClick: closeDrawer, className: "flex items-center group", children: _jsx("img", { src: LOGO_PATH, alt: "Plantoga", className: "h-14 object-contain" }) }), _jsx("button", { onClick: closeDrawer, className: "absolute right-5 w-9 h-9 flex items-center justify-center rounded-full bg-gray-50 text-gray-500 hover:bg-gray-100 active:scale-90 transition-all duration-200", "aria-label": "Close menu", children: _jsx(X, { size: 20 }) })] }), _jsxs("div", { className: "flex-1 min-h-0 overflow-y-auto scrollbar-none flex flex-col", style: { WebkitOverflowScrolling: 'touch' }, children: [mobilePromoBanner?.image_url && (_jsx("div", { className: "px-5 pb-3 shrink-0", children: mobilePromoBanner.cta_link ? (_jsx(Link, { to: mobilePromoBanner.cta_link, onClick: closeDrawer, className: "group relative block overflow-hidden rounded-2xl border border-emerald-100/50 shadow-[0_4px_12px_rgba(45,106,79,0.06)] transition active:scale-[0.98]", style: mobilePromoBanner.bg_color
                                                            ? { backgroundColor: mobilePromoBanner.bg_color }
                                                            : undefined, children: _jsx("img", { src: mobilePromoBanner.image_url, alt: mobilePromoBanner.title, className: "w-full aspect-[16/5] object-cover group-hover:scale-[1.03] transition-transform duration-300", loading: "eager" }) })) : (_jsx("div", { className: "group relative block overflow-hidden rounded-2xl border border-emerald-100/50 shadow-[0_4px_12px_rgba(45,106,79,0.06)] transition active:scale-[0.98]", style: mobilePromoBanner.bg_color
                                                            ? { backgroundColor: mobilePromoBanner.bg_color }
                                                            : undefined, children: _jsx("img", { src: mobilePromoBanner.image_url, alt: mobilePromoBanner.title, className: "w-full aspect-[16/5] object-cover group-hover:scale-[1.03] transition-transform duration-300", loading: "eager" }) })) })), _jsx("div", { className: "px-5 pb-4 border-b border-gray-100/80 shrink-0", children: user ? (_jsxs("div", { className: "flex items-center justify-between p-3.5 bg-gray-50/70 rounded-2xl border border-gray-100", children: [_jsxs("div", { className: "flex items-center gap-3 min-w-0", children: [_jsx("div", { className: "w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-extrabold shadow-sm shrink-0 text-sm", children: (user.full_name || 'U').charAt(0).toUpperCase() }), _jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "text-xs font-bold text-gray-800 truncate leading-none", children: user.full_name || 'Account' }), _jsx("p", { className: "text-[10px] text-gray-400 truncate mt-1 leading-none", children: user.email })] })] }), _jsx("button", { onClick: () => {
                                                                    logout();
                                                                    closeDrawer();
                                                                }, className: "text-[11px] font-bold text-red-600 bg-red-50 hover:bg-red-100 active:scale-95 px-3 py-1.5 rounded-full transition-all shrink-0", children: "Logout" })] })) : (_jsx("button", { onClick: () => {
                                                            closeDrawer();
                                                            openAuthModal();
                                                        }, className: "w-full py-3.5 bg-primary hover:bg-primary/95 text-white rounded-full text-xs font-bold tracking-wider uppercase shadow-sm active:scale-[0.97] transition-all duration-200", children: "Login / Register" })) }), _jsxs("div", { className: "px-3 py-3 space-y-1", children: [useFallback && (_jsx(_Fragment, { children: Array.from({ length: 3 }).map((_, i) => (_jsxs("div", { className: "flex items-center gap-3.5 px-3.5 py-2.5", children: [_jsx("div", { className: "w-9 h-9 rounded-full bg-gray-100 animate-pulse" }), _jsx("div", { className: "h-4 w-32 bg-gray-100 rounded animate-pulse" })] }, i))) })), mobileMenuItems.map((item) => {
                                                            const subcategories = getSubcategories(item.label);
                                                            const hasSubmenu = subcategories !== null;
                                                            return (_jsxs(Link, { to: item.href, onClick: (e) => {
                                                                    if (hasSubmenu) {
                                                                        e.preventDefault();
                                                                        setActiveSubmenu(item.label);
                                                                    }
                                                                    else {
                                                                        closeDrawer();
                                                                    }
                                                                }, className: "flex items-center justify-between px-3.5 py-2.5 rounded-xl hover:bg-emerald-50/40 active:bg-emerald-50/60 transition-all duration-200 group", children: [_jsxs("div", { className: "flex items-center gap-3.5", children: [item.img ? (_jsx("img", { src: item.img, alt: item.label, className: "w-9 h-9 rounded-full object-cover border border-gray-100/60 shadow-xs group-hover:scale-105 transition-transform duration-300", loading: "lazy" })) : (_jsx("div", { className: "w-9 h-9 rounded-full bg-gray-100 border border-gray-100/60" })), _jsx("span", { className: "text-[13.5px] font-semibold text-gray-800 group-hover:text-primary transition-colors duration-200", children: item.label })] }), hasSubmenu && (_jsx(ChevronRight, { size: 14, className: "text-gray-400 group-hover:text-primary group-hover:translate-x-0.5 transition-all duration-200" }))] }, item.label));
                                                        })] }), _jsxs("div", { className: "px-6 py-5 bg-gray-50/50 space-y-4 border-t border-gray-100/80", children: [_jsx("p", { className: "text-[10px] font-extrabold text-gray-400 uppercase tracking-widest leading-none", children: "Customer Support & Info" }), _jsx("div", { className: "grid grid-cols-1 gap-2.5", children: [
                                                                { label: 'About Us', href: '/#about-us' },
                                                                { label: 'Track Your Order', href: '/orders' },
                                                                { label: 'Support', href: `https://wa.me/${WHATSAPP_NUMBER}` },
                                                                { label: 'Damage Replacement Form', href: '/damage-replacement' },
                                                                { label: 'Track My Claim', href: '/damage-claims' },
                                                            ].map((link) => {
                                                                const isExternal = link.href.startsWith('http');
                                                                return isExternal ? (_jsxs("a", { href: link.href, target: "_blank", rel: "noopener noreferrer", onClick: closeDrawer, className: "flex items-center justify-between text-xs font-semibold text-gray-500 hover:text-primary hover:translate-x-0.5 transition-all duration-200 py-1", children: [_jsx("span", { children: link.label }), _jsx(ArrowUpRight, { size: 14, className: "text-gray-400" })] }, link.label)) : (_jsxs(Link, { to: link.href, onClick: closeDrawer, className: "flex items-center justify-between text-xs font-semibold text-gray-500 hover:text-primary hover:translate-x-0.5 transition-all duration-200 py-1", children: [_jsx("span", { children: link.label }), _jsx(ChevronRight, { size: 13, className: "text-gray-400" })] }, link.label));
                                                            }) }), user?.is_admin && (_jsx("div", { className: "pt-1.5", children: _jsxs(Link, { to: "/admin", onClick: closeDrawer, className: "w-full flex items-center justify-center gap-1.5 py-3 bg-primary/5 hover:bg-primary/10 text-primary rounded-xl text-xs font-bold transition-all duration-200", children: [_jsx(Settings, { size: 14 }), " Admin Panel"] }) }))] })] })] }), _jsxs("div", { className: "w-1/2 h-full flex flex-col shrink-0 bg-[#FAFBF9] overflow-hidden", children: [_jsxs("div", { className: "flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0", children: [_jsxs("div", { className: "flex flex-col", children: [_jsxs("button", { onClick: () => setActiveSubmenu(null), className: "flex items-center gap-1 text-gray-500 hover:text-primary active:scale-95 transition-all duration-150 -ml-1", children: [_jsx(ChevronLeft, { size: 18, className: "text-gray-600" }), _jsx("span", { className: "text-xs font-extrabold uppercase tracking-widest text-gray-500", children: "Back" })] }), _jsx("h2", { className: "text-base font-extrabold text-primary tracking-tight mt-1 uppercase", children: activeSubmenu })] }), _jsx("button", { onClick: closeDrawer, className: "w-9 h-9 flex items-center justify-center rounded-full bg-gray-50 text-gray-500 hover:bg-gray-100 active:scale-90 transition-all duration-200", "aria-label": "Close menu", children: _jsx(X, { size: 20 }) })] }), _jsx("div", { className: "flex-1 min-h-0 overflow-y-auto scrollbar-none p-4 space-y-1", style: { WebkitOverflowScrolling: 'touch' }, children: activeSubmenu && getSubcategories(activeSubmenu)?.map((sub) => (_jsxs(Link, { to: sub.href, onClick: closeDrawer, className: "flex items-center justify-between px-4 py-3 rounded-xl hover:bg-emerald-50/40 active:bg-emerald-50/60 transition-all duration-200 group border-b border-gray-100/30 last:border-0", children: [_jsx("span", { className: "text-[13.5px] font-semibold text-gray-700 group-hover:text-primary transition-colors duration-150", children: sub.label }), getSubcategories(sub.label) !== null && (_jsx(ChevronRight, { size: 14, className: "text-gray-400 group-hover:text-primary group-hover:translate-x-0.5 transition-all duration-150" }))] }, sub.label))) })] })] }) })] })] }));
}
