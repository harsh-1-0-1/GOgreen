import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo } from 'react';
import { Leaf, RotateCcw, Truck, HeartHandshake } from 'lucide-react';
import ErrorBoundary from '@/components/ui/ErrorBoundary';
import HeroBanner from '@/components/home/HeroBanner';
import CategoryNavBanners from '@/components/home/CategoryNavBanners';
import QuickAccessStrip from '@/components/home/QuickAccessStrip';
import CategoryHighlightGrid from '@/components/home/CategoryHighlightGrid';
import DisplaySectionBlock from '@/components/home/DisplaySectionBlock';
import BlogSection from '@/components/home/BlogSection';
import PromoCTASection from '@/components/home/PromoCTASection';
import AboutSection from '@/components/home/AboutSection';
import { useDisplaySections } from '@/hooks/useDisplaySections';
import { DEFAULT_SHIPPING_SETTINGS, useShippingSettings } from '@/hooks/useSettings';
function FeatureStrip() {
    const { data: shippingSettings = DEFAULT_SHIPPING_SETTINGS } = useShippingSettings();
    const features = [
        { icon: Truck, title: 'Free Delivery', desc: `On orders above ₹${shippingSettings.free_shipping_threshold}` },
        { icon: RotateCcw, title: 'Easy Returns', desc: '7-day return policy' },
        { icon: Leaf, title: 'Expert Plant Care', desc: 'Free care guides' },
        { icon: HeartHandshake, title: 'Plant Guarantee', desc: 'Healthy plants or replace' },
    ];
    return (_jsx("section", { className: "w-full bg-white border-y", children: _jsx("div", { className: "mx-auto px-6 sm:px-10 lg:px-16 xl:px-24 py-8 sm:py-12 grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6", children: features.map((f) => (_jsxs("div", { className: "flex flex-col items-center text-center gap-1.5 sm:gap-2", children: [_jsxs("div", { className: "w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary-light/10 flex items-center justify-center", children: [_jsx(f.icon, { size: 20, className: "text-primary sm:hidden" }), _jsx(f.icon, { size: 22, className: "text-primary hidden sm:block" })] }), _jsx("h4", { className: "font-semibold text-xs sm:text-sm", children: f.title }), _jsx("p", { className: "text-[11px] sm:text-xs text-gray-500", children: f.desc })] }, f.title))) }) }));
}
export default function HomePage() {
    const { data: allSections } = useDisplaySections();
    const displaySections = useMemo(() => (allSections ?? []).filter((section) => section.is_active), [allSections]);
    return (_jsxs("div", { children: [_jsx(ErrorBoundary, { children: _jsx(CategoryNavBanners, {}) }), _jsx(ErrorBoundary, { children: _jsx(HeroBanner, {}) }), _jsx(QuickAccessStrip, {}), _jsx(ErrorBoundary, { children: _jsx(CategoryHighlightGrid, {}) }), displaySections.map((section) => (_jsx(ErrorBoundary, { children: _jsx(DisplaySectionBlock, { section: section }) }, section.id))), _jsx(FeatureStrip, {}), _jsx(ErrorBoundary, { children: _jsx(BlogSection, {}) }), _jsx(PromoCTASection, {}), _jsx(AboutSection, {})] }));
}
