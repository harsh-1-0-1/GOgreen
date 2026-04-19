import { Leaf, RotateCcw, Truck, HeartHandshake } from 'lucide-react';
import { useProducts } from '@/hooks/useProducts';
import ErrorBoundary from '@/components/ui/ErrorBoundary';
import HeroBanner from '@/components/home/HeroBanner';
import QuickAccessStrip from '@/components/home/QuickAccessStrip';
import ThemedProductSection from '@/components/home/ThemedProductSection';
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

function NewToPlantsSection() {
  const { data } = useProducts({ tags: 'beginner-friendly', limit: 6 });
  if (!data?.items.length) return null;
  return (
    <ThemedProductSection
      bgType="image"
      bgValue="https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=1200&q=80"
      headline="New to plants?"
      subheadline="Start with the easy ones."
      headlineColor="#F4C542"
      products={data.items}
      cardStyle="view-product"
      layout="cards-right-overlay"
    />
  );
}

function BestDecorSection() {
  const { data } = useProducts({ tags: 'indoor', limit: 6 });
  if (!data?.items.length) return null;
  return (
    <ThemedProductSection
      bgType="image"
      bgValue="https://images.unsplash.com/photo-1463320726281-696a485928c7?w=1200&q=80"
      headline="Best decor plants"
      subheadline="To instantly upgrade your space"
      headlineColor="#F4C542"
      products={data.items}
      cardStyle="view-product"
      layout="cards-right-overlay"
    />
  );
}

function LowMaintenanceSection() {
  const { data } = useProducts({ tags: 'low-maintenance', limit: 6 });
  if (!data?.items.length) return null;
  return (
    <ThemedProductSection
      bgType="image"
      bgValue="https://images.unsplash.com/photo-1459411552884-841db9b3cc2a?w=1200&q=80"
      headline="Less care. More green."
      subheadline="Low-maintenance plants for your home."
      headlineColor="#A3E635"
      products={data.items}
      cardStyle="view-product"
      layout="cards-right-overlay"
    />
  );
}

function PlantCareSection() {
  const { data } = useProducts({ category_slug: 'plant-care', limit: 6 });
  if (!data?.items.length) return null;
  return (
    <ThemedProductSection
      bgType="image"
      bgValue="https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=1200&q=80"
      headline="Plant care made simple"
      subheadline="Fertilizers for growth, strength, and greener leaves."
      headlineColor="#F4C542"
      products={data.items}
      cardStyle="view-product"
      layout="cards-right-overlay"
    />
  );
}


export default function HomePage() {
  return (
    <div>
      <ErrorBoundary><HeroBanner /></ErrorBoundary>
      <QuickAccessStrip />

      {/* Full-screen themed sections — no gaps, edge to edge */}
      <ErrorBoundary><NewToPlantsSection /></ErrorBoundary>
      <ErrorBoundary><BestDecorSection /></ErrorBoundary>
      <ErrorBoundary><LowMaintenanceSection /></ErrorBoundary>
      <ErrorBoundary><PlantCareSection /></ErrorBoundary>

      <FeatureStrip />
      <ErrorBoundary><BlogSection /></ErrorBoundary>
      <PromoCTASection />
      <AboutSection />
    </div>
  );
}
