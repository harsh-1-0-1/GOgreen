import { Link } from 'react-router-dom';
import { ArrowRight, Leaf, RotateCcw, Truck, HeartHandshake } from 'lucide-react';
import { useCategories } from '@/hooks/useCategories';
import { useProducts } from '@/hooks/useProducts';
import ProductCard from '@/components/product/ProductCard';
import SkeletonCard from '@/components/ui/SkeletonCard';
import ErrorBoundary from '@/components/ui/ErrorBoundary';
import HeroBanner from '@/components/home/HeroBanner';
import QuickAccessStrip from '@/components/home/QuickAccessStrip';
import ThemedProductSection from '@/components/home/ThemedProductSection';
import BlogSection from '@/components/home/BlogSection';
import PromoCTASection from '@/components/home/PromoCTASection';
import AboutSection from '@/components/home/AboutSection';

function CategoryGrid() {
  const { data: categories, isLoading } = useCategories();
  const roots = categories?.filter((c) => !c.parent_id).slice(0, 8) ?? [];

  const placeholderImages: Record<string, string> = {
    plants: 'https://images.unsplash.com/photo-1459411552884-841db9b3cc2a?w=300&h=300&fit=crop',
    seeds: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=300&h=300&fit=crop',
    'pots-planters': 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=300&h=300&fit=crop',
    'plant-care': 'https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=300&h=300&fit=crop',
  };

  if (isLoading) {
    return (
      <section className="max-w-7xl mx-auto px-3 sm:px-4 py-8 sm:py-12">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-pulse bg-gray-200 rounded-2xl aspect-square" />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-7xl mx-auto px-3 sm:px-4 py-8 sm:py-12">
      <div className="flex items-center justify-between mb-5 sm:mb-8">
        <h2 className="text-xl sm:text-2xl md:text-3xl font-bold">Shop by Category</h2>
        <Link to="/products" className="text-xs sm:text-sm text-primary font-medium hover:underline flex items-center gap-1">
          View All <ArrowRight size={14} />
        </Link>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        {roots.map((cat) => (
          <Link
            key={cat.slug}
            to={`/products?category=${cat.slug}`}
            className="group relative aspect-square rounded-xl sm:rounded-2xl overflow-hidden"
          >
            <img
              src={cat.image_url || placeholderImages[cat.slug] || 'https://placehold.co/300x300?text=' + cat.name}
              alt={cat.name}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
            <div className="absolute bottom-3 sm:bottom-4 left-3 sm:left-4 right-3 sm:right-4">
              <h3 className="text-white font-bold text-sm sm:text-lg">{cat.name}</h3>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function BestsellerCarousel() {
  const { data, isLoading } = useProducts({ sort_by: 'newest', limit: 10 });

  return (
    <section className="max-w-7xl mx-auto px-3 sm:px-4 py-8 sm:py-12">
      <div className="flex items-center justify-between mb-5 sm:mb-8">
        <h2 className="text-xl sm:text-2xl md:text-3xl font-bold">Bestsellers</h2>
        <Link to="/products?sort_by=newest" className="text-xs sm:text-sm text-primary font-medium hover:underline flex items-center gap-1">
          See All <ArrowRight size={14} />
        </Link>
      </div>
      <div className="flex gap-3 sm:gap-4 overflow-x-auto scrollbar-hide snap-x-mandatory pb-4 -mx-3 sm:-mx-4 px-3 sm:px-4">
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="shrink-0 w-[70vw] sm:w-56 snap-start"><SkeletonCard /></div>
            ))
          : data?.items.map((p) => (
              <div key={p.id} className="shrink-0 w-[70vw] sm:w-56 snap-start">
                <ProductCard product={p} />
              </div>
            ))}
      </div>
    </section>
  );
}

function FeatureStrip() {
  const features = [
    { icon: Truck, title: 'Free Delivery', desc: 'On orders above ₹499' },
    { icon: RotateCcw, title: 'Easy Returns', desc: '7-day return policy' },
    { icon: Leaf, title: 'Expert Plant Care', desc: 'Free care guides' },
    { icon: HeartHandshake, title: 'Plant Guarantee', desc: 'Healthy plants or replace' },
  ];

  return (
    <section className="bg-white border-y">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-6 sm:py-10 grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
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

function TestimonialSection() {
  const testimonials = [
    { name: 'Priya M.', text: 'Received my money plant in perfect condition! The packaging was amazing.', city: 'Mumbai' },
    { name: 'Rahul K.', text: 'Best online plant store in India. Fast delivery and healthy plants every time.', city: 'Bangalore' },
    { name: 'Ananya S.', text: 'Love the care tips they include. My jade plant is thriving!', city: 'Delhi' },
  ];

  return (
    <section className="max-w-7xl mx-auto px-3 sm:px-4 py-10 sm:py-16">
      <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-center mb-6 sm:mb-10">What Our Customers Say</h2>
      <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
        {testimonials.map((t) => (
          <div key={t.name} className="bg-white p-4 sm:p-6 rounded-xl sm:rounded-2xl border border-gray-100 shadow-sm">
            <div className="flex gap-1 mb-2 sm:mb-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <span key={i} className="text-accent text-sm">★</span>
              ))}
            </div>
            <p className="text-sm text-gray-600 leading-relaxed mb-3 sm:mb-4">"{t.text}"</p>
            <div>
              <p className="text-sm font-semibold">{t.name}</p>
              <p className="text-xs text-gray-400">{t.city}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function HomePage() {
  return (
    <div className="flex flex-col gap-10 md:gap-16 pb-12 md:pb-20">
      <div className="flex flex-col">
        <ErrorBoundary><HeroBanner /></ErrorBoundary>
        <QuickAccessStrip />
      </div>

      <div className="flex flex-col gap-2 sm:gap-3">
        <ErrorBoundary><NewToPlantsSection /></ErrorBoundary>
        <ErrorBoundary><BestDecorSection /></ErrorBoundary>
        <ErrorBoundary><LowMaintenanceSection /></ErrorBoundary>
        <ErrorBoundary><PlantCareSection /></ErrorBoundary>
      </div>

      <FeatureStrip />
      <PromoCTASection />
      <ErrorBoundary><BlogSection /></ErrorBoundary>
      <ErrorBoundary><TestimonialSection /></ErrorBoundary>
      <AboutSection />
    </div>
  );
}
