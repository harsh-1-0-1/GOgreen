import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useBlogPosts } from '@/hooks/useBlog';

const CATEGORIES = [
  { label: 'All', value: '' },
  { label: 'GROW', value: 'GROW' },
  { label: 'CARE', value: 'CARE' },
  { label: 'DIY', value: 'DIY' },
  { label: 'TIPS', value: 'TIPS' },
];

const CATEGORY_COLORS: Record<string, string> = {
  GROW: 'bg-green-100 text-green-700',
  CARE: 'bg-blue-100 text-blue-700',
  DIY: 'bg-amber-100 text-amber-700',
  TIPS: 'bg-purple-100 text-purple-700',
};

export default function BlogListPage() {
  const [activeCategory, setActiveCategory] = useState('');
  const { data, isLoading } = useBlogPosts({
    category: activeCategory || undefined,
    limit: 50,
  });

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 py-6 sm:py-10">
      <h1 className="text-2xl sm:text-3xl font-bold text-center mb-6 sm:mb-8">Our Blog</h1>

      <div className="flex items-center justify-center gap-2 sm:gap-3 mb-8 flex-wrap">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setActiveCategory(cat.value)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition ${
              activeCategory === cat.value
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="animate-pulse bg-gray-200 rounded-2xl h-80" />
          ))}
        </div>
      ) : !data?.items.length ? (
        <p className="text-center text-gray-400 py-12">No articles found.</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {data.items.map((post) => {
            const colorClass = CATEGORY_COLORS[post.category] ?? 'bg-gray-100 text-gray-700';
            return (
              <Link
                key={post.id}
                to={`/blog/${post.slug}`}
                className="group block bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="overflow-hidden aspect-video">
                  <img
                    src={post.cover_image_url || 'https://placehold.co/600x340?text=Blog'}
                    alt={post.title}
                    className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                    loading="lazy"
                  />
                </div>
                <div className="p-4 sm:p-5">
                  <span className={`inline-block px-2.5 py-0.5 text-[11px] font-semibold rounded-full ${colorClass}`}>
                    {post.category}
                  </span>
                  <h3 className="mt-2 font-semibold text-[18px] leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                    {post.title}
                  </h3>
                  <p className="mt-1.5 text-[13px] text-gray-500 line-clamp-3 leading-relaxed">
                    {post.excerpt}
                  </p>
                  <span className="mt-3 inline-block text-sm font-medium text-primary">
                    — Read More
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
