import { Link } from 'react-router-dom';
import { ArrowRight, Leaf, RotateCcw, Truck, HeartHandshake } from 'lucide-react';
import { useCategories } from '@/hooks/useCategories';
import { useProducts } from '@/hooks/useProducts';
import ProductCard from '@/components/product/ProductCard';
import SkeletonCard from '@/components/ui/SkeletonCard';
import ErrorBoundary from '@/components/ui/ErrorBoundary';

function HeroBanner() {
  return (
    <section className="relative bg-gradient-to-br from-primary to-primary-light overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 py-16 md:py-24 flex flex-col md:flex-row items-center gap-8">
        <div className="flex-1 text-white space-y-6 text-center md:text-left">
          <span className="inline-block px-3 py-1 bg-white/20 text-sm rounded-full backdrop-blur-sm">
            India's #1 Online Plant Store
          </span>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
            Bring Nature<br />
            <span className="text-accent">Home</span>
          </h1>
          <p className="text-white/80 text-lg max-w-lg mx-auto md:mx-0">
            Choose from 5000+ plants, pots, and gardening essentials.
            Delivered with care to your doorstep.
          </p>
          <div className="flex flex-wrap gap-3 justify-center md:justify-start">
            <Link
              to="/products"
              className="px-6 py-3 bg-accent text-white font-semibold rounded-full hover:bg-accent/90 transition flex items-center gap-2"
            >
              Shop Now <ArrowRight size={18} />
            </Link>
            <Link
              to="/products?category=indoor-plants"
              className="px-6 py-3 bg-white/15 text-white font-medium rounded-full backdrop-blur-sm hover:bg-white/25 transition"
            >
              Explore Indoor Plants
            </Link>
          </div>
        </div>
        <div className="flex-1 max-w-md">
          <img
            src="https://images.unsplash.com/photo-1459411552884-841db9b3cc2a?w=600&h=600&fit=crop"
            alt="Beautiful indoor plant"
            className="rounded-3xl shadow-2xl w-full aspect-square object-cover"
          />
        </div>
      </div>
      {/* Decorative shapes */}
      <div className="absolute -bottom-1 left-0 right-0 h-16 bg-bg" style={{ clipPath: 'ellipse(55% 100% at 50% 100%)' }} />
    </section>
  );
}

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
      <section className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-pulse bg-gray-200 rounded-2xl aspect-square" />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-7xl mx-auto px-4 py-12">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl md:text-3xl font-bold">Shop by Category</h2>
        <Link to="/products" className="text-sm text-primary font-medium hover:underline flex items-center gap-1">
          View All <ArrowRight size={14} />
        </Link>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {roots.map((cat) => (
          <Link
            key={cat.slug}
            to={`/products?category=${cat.slug}`}
            className="group relative aspect-square rounded-2xl overflow-hidden"
          >
            <img
              src={cat.image_url || placeholderImages[cat.slug] || 'https://placehold.co/300x300?text=' + cat.name}
              alt={cat.name}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
            <div className="absolute bottom-4 left-4 right-4">
              <h3 className="text-white font-bold text-lg">{cat.name}</h3>
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
    <section className="max-w-7xl mx-auto px-4 py-12">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl md:text-3xl font-bold">Bestsellers</h2>
        <Link to="/products?sort_by=newest" className="text-sm text-primary font-medium hover:underline flex items-center gap-1">
          See All <ArrowRight size={14} />
        </Link>
      </div>
      <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-4 -mx-4 px-4">
        {isLoading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="shrink-0 w-56"><SkeletonCard /></div>
            ))
          : data?.items.map((p) => (
              <div key={p.id} className="shrink-0 w-56">
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
      <div className="max-w-7xl mx-auto px-4 py-10 grid grid-cols-2 md:grid-cols-4 gap-6">
        {features.map((f) => (
          <div key={f.title} className="flex flex-col items-center text-center gap-2">
            <div className="w-12 h-12 rounded-full bg-primary-light/10 flex items-center justify-center">
              <f.icon size={22} className="text-primary" />
            </div>
            <h4 className="font-semibold text-sm">{f.title}</h4>
            <p className="text-xs text-gray-500">{f.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function TestimonialSection() {
  const testimonials = [
    { name: 'Priya M.', text: 'Received my money plant in perfect condition! The packaging was amazing.', city: 'Mumbai' },
    { name: 'Rahul K.', text: 'Best online plant store in India. Fast delivery and healthy plants every time.', city: 'Bangalore' },
    { name: 'Ananya S.', text: 'Love the care tips they include. My jade plant is thriving!', city: 'Delhi' },
  ];

  return (
    <section className="max-w-7xl mx-auto px-4 py-16">
      <h2 className="text-2xl md:text-3xl font-bold text-center mb-10">What Our Customers Say</h2>
      <div className="grid md:grid-cols-3 gap-6">
        {testimonials.map((t) => (
          <div
            key={t.name}
            className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm"
          >
            <div className="flex gap-1 mb-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <span key={i} className="text-accent text-sm">★</span>
              ))}
            </div>
            <p className="text-sm text-gray-600 leading-relaxed mb-4">"{t.text}"</p>
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
    <div>
      <ErrorBoundary><HeroBanner /></ErrorBoundary>
      <ErrorBoundary><CategoryGrid /></ErrorBoundary>
      <ErrorBoundary><BestsellerCarousel /></ErrorBoundary>
      <FeatureStrip />
      <ErrorBoundary><TestimonialSection /></ErrorBoundary>
    </div>
  );
}
