import { Link, useParams } from 'react-router-dom';
import Markdown from 'react-markdown';
import { ArrowLeft } from 'lucide-react';
import { useBlogPost, useBlogPosts } from '@/hooks/useBlog';

const CATEGORY_COLORS: Record<string, string> = {
  GROW: 'bg-green-100 text-green-700',
  CARE: 'bg-blue-100 text-blue-700',
  DIY: 'bg-amber-100 text-amber-700',
  TIPS: 'bg-purple-100 text-purple-700',
};

export default function BlogDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: post, isLoading, error } = useBlogPost(slug ?? '');
  const { data: related } = useBlogPosts({
    category: post?.category,
    limit: 4,
  });

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-10">
        <div className="animate-pulse space-y-4">
          <div className="bg-gray-200 rounded-2xl h-64 sm:h-96" />
          <div className="bg-gray-200 h-8 w-3/4 rounded" />
          <div className="bg-gray-200 h-4 w-1/2 rounded" />
          <div className="space-y-2 mt-8">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-gray-100 h-4 rounded" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <h2 className="text-xl font-semibold text-gray-600 mb-2">Article not found</h2>
        <Link to="/blog" className="text-primary hover:underline text-sm">
          Back to Blog
        </Link>
      </div>
    );
  }

  const colorClass = CATEGORY_COLORS[post.category] ?? 'bg-gray-100 text-gray-700';
  const date = post.published_at
    ? new Date(post.published_at).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '';

  const relatedPosts = related?.items.filter((p) => p.slug !== post.slug).slice(0, 3) ?? [];

  return (
    <article>
      <div className="w-full h-64 sm:h-[400px] relative">
        <img
          src={post.cover_image_url || 'https://placehold.co/1400x400?text=Blog'}
          alt={post.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
      </div>

      <div className="max-w-3xl mx-auto px-3 sm:px-4 -mt-16 relative z-10">
        <div className="bg-white rounded-2xl p-5 sm:p-8 shadow-lg">
          <Link to="/blog" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-primary mb-4">
            <ArrowLeft size={16} /> Back to Blog
          </Link>

          <div className="flex items-center gap-3 mb-3 flex-wrap">
            <span className={`px-2.5 py-0.5 text-[11px] font-semibold rounded-full ${colorClass}`}>
              {post.category}
            </span>
            {date && <span className="text-xs text-gray-400">{date}</span>}
            <span className="text-xs text-gray-400">by {post.author_name}</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-bold leading-tight mb-6">
            {post.title}
          </h1>

          <div className="prose prose-green max-w-none prose-headings:font-bold prose-h2:text-xl prose-h3:text-lg prose-p:text-gray-600 prose-p:leading-relaxed prose-li:text-gray-600 prose-table:text-sm prose-img:rounded-xl">
            <Markdown>{post.content}</Markdown>
          </div>
        </div>
      </div>

      {relatedPosts.length > 0 && (
        <section className="max-w-7xl mx-auto px-3 sm:px-4 py-10 sm:py-16">
          <h2 className="text-xl sm:text-2xl font-bold mb-6">Related Articles</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {relatedPosts.map((rp) => {
              const rpColor = CATEGORY_COLORS[rp.category] ?? 'bg-gray-100 text-gray-700';
              return (
                <Link
                  key={rp.id}
                  to={`/blog/${rp.slug}`}
                  className="group block bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="overflow-hidden aspect-video">
                    <img
                      src={rp.cover_image_url || 'https://placehold.co/600x340?text=Blog'}
                      alt={rp.title}
                      className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                      loading="lazy"
                    />
                  </div>
                  <div className="p-4">
                    <span className={`inline-block px-2.5 py-0.5 text-[11px] font-semibold rounded-full ${rpColor}`}>
                      {rp.category}
                    </span>
                    <h3 className="mt-2 font-semibold text-base leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                      {rp.title}
                    </h3>
                    <span className="mt-2 inline-block text-sm font-medium text-primary">
                      — Read More
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </article>
  );
}
