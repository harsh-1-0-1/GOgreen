import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useBlogPosts } from '@/hooks/useBlog';

const CATEGORY_STYLES: Record<string, { bg: string; color: string }> = {
  TIPS: { bg: '#EDE9FE', color: '#6D28D9' },
  DIY: { bg: '#FEF3C7', color: '#92400E' },
  CARE: { bg: '#DCFCE7', color: '#166534' },
  GROW: { bg: '#DCFCE7', color: '#166534' },
};

const FALLBACK_COVERS: Record<string, string> = {
  TIPS: 'https://images.unsplash.com/photo-1463936575829-25148e1db1b8?w=800&h=600&fit=crop&crop=center',
  DIY: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&h=600&fit=crop&crop=center',
  CARE: 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=800&h=600&fit=crop&crop=center',
  GROW: 'https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=800&h=600&fit=crop&crop=center',
};

function BlogCard({
  post,
}: {
  post: {
    slug: string;
    title: string;
    excerpt: string;
    cover_image_url: string | null;
    category: string;
  };
}) {
  const style =
    CATEGORY_STYLES[post.category] ?? { bg: '#F3F4F6', color: '#374151' };
  const cover =
    post.cover_image_url ||
    FALLBACK_COVERS[post.category] ||
    FALLBACK_COVERS.GROW;

  return (
    <Link
      to={`/blog/${post.slug}`}
      className="group flex flex-col bg-white overflow-hidden"
    >
      {/* Image — tall 4:3 like Ugaoo, no border-radius */}
      <div className="overflow-hidden">
        <img
          src={cover}
          alt={post.title}
          className="w-full block object-cover object-center group-hover:scale-[1.03] transition-transform duration-500"
          style={{ aspectRatio: '4/3' }}
          loading="lazy"
        />
      </div>

      {/* Body */}
      <div className="pt-5 pb-2 flex flex-col flex-1">
        <span
          className="inline-block self-start px-3 py-1 text-[11px] font-bold tracking-[0.08em] uppercase mb-3"
          style={{
            backgroundColor: style.bg,
            color: style.color,
            borderRadius: '4px',
          }}
        >
          {post.category}
        </span>

        <h3 className="font-bold text-lg leading-snug line-clamp-2 text-gray-900 group-hover:text-[#1B4332] transition-colors">
          {post.title}
        </h3>

        <p className="mt-2 text-[13.5px] text-gray-500 line-clamp-3 leading-relaxed flex-1">
          {post.excerpt}
        </p>

        <div className="mt-5 flex items-center gap-2">
          <span className="w-8 h-px bg-[#1B4332]" />
          <span className="text-sm font-medium text-[#1B4332]">Read More</span>
        </div>
      </div>
    </Link>
  );
}

export default function BlogSection() {
  const { data, isLoading } = useBlogPosts({ limit: 3 });

  if (isLoading) {
    return (
      <section className="w-full py-12 sm:py-16">
        <div className="mx-auto px-6 sm:px-10 lg:px-16 xl:px-24">
          <h2
            className="text-2xl sm:text-4xl font-bold text-center mb-10"
            style={{ color: '#1B4332' }}
          >
            Blogs
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse bg-gray-200 rounded-xl h-96"
              />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (!data?.items.length) return null;

  return (
    <section className="w-full py-12 sm:py-16">
      <div className="mx-auto px-6 sm:px-10 lg:px-16 xl:px-24">
        <h2
          className="text-2xl sm:text-4xl font-bold text-center mb-10"
          style={{ color: '#1B4332' }}
        >
          Blogs
        </h2>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 items-stretch">
          {data.items.map((post) => (
            <BlogCard key={post.id} post={post} />
          ))}
        </div>

        <div className="text-center mt-10">
          <Link
            to="/blog"
            className="inline-flex items-center gap-1.5 text-sm font-semibold hover:underline"
            style={{ color: '#1B4332' }}
          >
            View all articles <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
}
