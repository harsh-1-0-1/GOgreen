import { Leaf, RotateCcw, Truck, HeartHandshake } from 'lucide-react';
import ErrorBoundary from '@/components/ui/ErrorBoundary';
import HeroBanner from '@/components/home/HeroBanner';
import MobileCategoryNav from '@/components/home/MobileCategoryNav';
import QuickAccessStrip from '@/components/home/QuickAccessStrip';
import CategoryHighlightGrid from '@/components/home/CategoryHighlightGrid';
import TrendingProductsGrid from '@/components/home/TrendingProductsGrid';
import NewArrivalsGrid from '@/components/home/NewArrivalsGrid';
import ExoticFindsGrid from '@/components/home/ExoticFindsGrid';
import PlantCareGrid from '@/components/home/PlantCareGrid';
import DecorPotsGrid from '@/components/home/DecorPotsGrid';
import BlogSection from '@/components/home/BlogSection';
import PromoCTASection from '@/components/home/PromoCTASection';
import AboutSection from '@/components/home/AboutSection';

function FeatureStrip() {
  const features = [
    { icon: Truck, title: 'Free Delivery', desc: 'On orders above ₹499' },
    { icon: RotateCcw, title: 'Easy Returns', desc: '7-day return policy' },
    { icon: Leaf, title: 'Expert Plant Care', desc: 'Free care guides' },
    { icon: HeartHandshake, title: 'Plant Guarantee', desc: 'Healthy plants or replace' },
  ];

  return (
    <section className="w-full bg-white border-y">
      <div className="mx-auto px-6 sm:px-10 lg:px-16 xl:px-24 py-8 sm:py-12 grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
        {features.map((f) => (
          <div key={f.title} className="flex flex-col items-center text-center gap-1.5 sm:gap-2">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary-light/10 flex items-center justify-center">
              <f.icon size={20} className="text-primary sm:hidden" />
              <f.icon size={22} className="text-primary hidden sm:block" />
            </div>
            <h4 className="font-semibold text-xs sm:text-sm">{f.title}</h4>
            <p className="text-[11px] sm:text-xs text-gray-500">{f.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function HomePage() {
  return (
    <div>
      <MobileCategoryNav />
      <ErrorBoundary><HeroBanner /></ErrorBoundary>
      <QuickAccessStrip />
      <ErrorBoundary><CategoryHighlightGrid /></ErrorBoundary>
      <ErrorBoundary>
        <TrendingProductsGrid title="Trending Now" limit={8} />
      </ErrorBoundary>
      
      <ErrorBoundary>
        <NewArrivalsGrid limit={8} />
      </ErrorBoundary>

      <ErrorBoundary>
        <ExoticFindsGrid />
      </ErrorBoundary>

      <ErrorBoundary>
        <PlantCareGrid />
      </ErrorBoundary>

      <ErrorBoundary>
        <DecorPotsGrid />
      </ErrorBoundary>

      <FeatureStrip />
      <ErrorBoundary><BlogSection /></ErrorBoundary>
      <PromoCTASection />
      <AboutSection />
    </div>
  );
}
