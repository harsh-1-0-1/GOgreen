import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useBlogPosts } from '@/hooks/useBlog';

const CATEGORY_COLORS: Record<string, string> = {
  GROW: 'bg-green-100 text-green-700',
  CARE: 'bg-blue-100 text-blue-700',
  DIY: 'bg-amber-100 text-amber-700',
  TIPS: 'bg-purple-100 text-purple-700',
};

function BlogCard({ post }: { post: { slug: string; title: string; excerpt: string; cover_image_url: string | null; category: string } }) {
  const colorClass = CATEGORY_COLORS[post.category] ?? 'bg-gray-100 text-gray-700';

  return (
    <Link to={`/blog/${post.slug}`} className="group flex flex-col bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-md hover:shadow-xl transition-all duration-300">
      <div className="overflow-hidden aspect-[4/3]">
        <img
          src={post.cover_image_url || 'https://placehold.co/600x340?text=Blog'}
          alt={post.title}
          className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500"
          loading="lazy"
        />
      </div>
      <div className="p-5 sm:p-6 flex flex-col flex-1">
        <span className={`inline-block px-2.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase rounded-full ${colorClass}`}>
          {post.category}
        </span>
        <h3 className="mt-2.5 font-bold text-[17px] leading-snug line-clamp-2 group-hover:text-primary transition-colors">
          {post.title}
        </h3>
        <p className="mt-2 text-[13.5px] text-gray-500 line-clamp-3 leading-relaxed flex-1">
          {post.excerpt}
        </p>
        <span className="mt-4 inline-block text-sm font-semibold text-primary group-hover:underline">
          — Read More
        </span>
      </div>
    </Link>
  );
}

export default function BlogSection() {
  const { data, isLoading } = useBlogPosts({ limit: 3 });

  if (isLoading) {
    return (
      <section className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10 py-10 sm:py-16">
        <h2 className="text-2xl sm:text-[32px] font-bold text-center mb-8">Blogs</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-7">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="animate-pulse bg-gray-200 rounded-2xl h-80" />
          ))}
        </div>
      </section>
    );
  }

  if (!data?.items.length) return null;

  return (
    <section className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10 py-10 sm:py-16">
      <h2 className="text-2xl sm:text-[32px] font-bold text-center mb-10">Blogs</h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-7">
        {data.items.map((post) => (
          <BlogCard key={post.id} post={post} />
        ))}
      </div>
      <div className="text-center mt-10">
        <Link
          to="/blog"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
        >
          View all articles <ArrowRight size={16} />
        </Link>
      </div>
    </section>
  );
}
