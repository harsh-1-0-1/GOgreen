import { useState } from 'react';
import type { FormEvent } from 'react';
import { CheckCircle2, Star, ThumbsUp } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCreateReview, useMarkReviewHelpful, useProductReviews } from '@/hooks/useReviews';
import { useAuthStore } from '@/store/authStore';
import type { ReviewSummary } from '@/types';

function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value.toFixed(1)} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={size}
          className={star <= Math.round(value) ? 'fill-[#f59e0b] text-[#f59e0b]' : 'fill-gray-200 text-gray-200'}
        />
      ))}
    </span>
  );
}

export function ProductRatingInline({ summary }: { summary: ReviewSummary | undefined }) {
  if (!summary || summary.review_count === 0) {
    return <p className="text-sm text-gray-500">No customer reviews yet</p>;
  }

  return (
    <a href="#customer-reviews" className="inline-flex items-center gap-2 text-sm text-primary hover:underline">
      <Stars value={summary.average_rating} />
      <span className="font-semibold text-gray-800">{summary.average_rating.toFixed(1)}</span>
      <span>{summary.review_count} review{summary.review_count === 1 ? '' : 's'}</span>
    </a>
  );
}

function RatingBreakdown({
  summary,
  activeRating,
  onSelect,
}: {
  summary: ReviewSummary;
  activeRating?: number;
  onSelect: (rating?: number) => void;
}) {
  const total = Math.max(summary.review_count, 1);

  return (
    <div className="space-y-2">
      {[5, 4, 3, 2, 1].map((star) => {
        const count = summary.rating_counts[star] ?? 0;
        const pct = Math.round((count / total) * 100);
        return (
          <button
            key={star}
            type="button"
            onClick={() => onSelect(activeRating === star ? undefined : star)}
            className={`grid w-full grid-cols-[44px_1fr_42px] items-center gap-2 rounded px-1 py-0.5 text-xs transition ${
              activeRating === star ? 'bg-primary/5 text-primary' : 'text-gray-600 hover:bg-gray-50'
            }`}
            aria-label={`${star} star reviews, ${pct}%`}
          >
            <span>{star} star</span>
            <span className="h-2 overflow-hidden rounded-full bg-gray-100">
              <span className="block h-full rounded-full bg-[#f59e0b]" style={{ width: `${pct}%` }} />
            </span>
            <span className="text-right">{pct}%</span>
          </button>
        );
      })}
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

export default function ProductReviews({ productId }: { productId: number }) {
  const [sortBy, setSortBy] = useState<'top' | 'newest' | 'highest' | 'lowest'>('top');
  const [ratingFilter, setRatingFilter] = useState<number | undefined>();
  const [page, setPage] = useState(1);
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const { openAuthModal } = useAuthStore();
  const { data, isLoading } = useProductReviews(productId, {
    page,
    limit: 8,
    sort_by: sortBy,
    rating: ratingFilter,
  });
  const createReview = useCreateReview(productId);
  const helpful = useMarkReviewHelpful(productId);

  const summary = data?.summary ?? { average_rating: 0, review_count: 0, rating_counts: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      await createReview.mutateAsync({
        rating,
        title: title.trim() || undefined,
        body: body.trim() || undefined,
      });
      setTitle('');
      setBody('');
      setRating(5);
      toast.success('Review submitted');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Could not submit review');
    }
  }

  async function markHelpful(reviewId: number) {
    try {
      await helpful.mutateAsync(reviewId);
    } catch (err: any) {
      if (err.response?.status === 401) openAuthModal();
      else toast.error(err.response?.data?.detail || 'Could not mark helpful');
    }
  }

  return (
    <section id="customer-reviews" className="mt-10 sm:mt-16 border-t pt-8 sm:pt-10">
      <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
        <aside className="space-y-5">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold">Customer Reviews</h2>
            <div className="mt-3 flex items-center gap-3">
              <Stars value={summary.average_rating} size={20} />
              <span className="text-lg font-bold">{summary.average_rating.toFixed(1)} out of 5</span>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              Based on {summary.review_count} review{summary.review_count === 1 ? '' : 's'}
            </p>
          </div>

          <RatingBreakdown
            summary={summary}
            activeRating={ratingFilter}
            onSelect={(nextRating) => {
              setRatingFilter(nextRating);
              setPage(1);
            }}
          />

          <form onSubmit={handleSubmit} className="space-y-3 rounded-lg border border-gray-200 p-4">
            <h3 className="text-sm font-bold">Review this product</h3>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className="p-1"
                  aria-label={`Rate ${star} stars`}
                >
                  <Star
                    size={22}
                    className={star <= rating ? 'fill-[#f59e0b] text-[#f59e0b]' : 'fill-gray-200 text-gray-200'}
                  />
                </button>
              ))}
            </div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={140}
              placeholder="Review title"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={4000}
              rows={4}
              placeholder="What did you like or dislike?"
              className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
            <button
              type="submit"
              disabled={createReview.isPending}
              className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:opacity-60"
            >
              {createReview.isPending ? 'Submitting...' : 'Submit Review'}
            </button>
          </form>
        </aside>

        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-bold">Top reviews</h3>
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value as typeof sortBy);
                setPage(1);
              }}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm focus:border-primary focus:outline-none"
            >
              <option value="top">Top reviews</option>
              <option value="newest">Most recent</option>
              <option value="highest">Highest rated</option>
              <option value="lowest">Lowest rated</option>
            </select>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-28 animate-pulse rounded-lg bg-gray-100" />
              ))}
            </div>
          ) : data?.items.length ? (
            <div className="space-y-3">
              {ratingFilter && (
                <button
                  type="button"
                  onClick={() => {
                    setRatingFilter(undefined);
                    setPage(1);
                  }}
                  className="text-sm font-semibold text-primary hover:underline"
                >
                  Clear {ratingFilter}-star filter
                </button>
              )}
              {data.items.map((review) => (
                <article key={review.id} className="rounded-lg border border-gray-200 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {review.author_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{review.author_name}</p>
                      <p className="text-xs text-gray-500">Reviewed on {formatDate(review.created_at)}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Stars value={review.rating} />
                    {review.title && <h4 className="text-sm font-bold">{review.title}</h4>}
                  </div>
                  {review.is_verified_purchase && (
                    <p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary">
                      <CheckCircle2 size={14} /> Verified Purchase
                    </p>
                  )}
                  {review.body && <p className="mt-3 text-sm leading-relaxed text-gray-700">{review.body}</p>}
                  <button
                    type="button"
                    onClick={() => markHelpful(review.id)}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:border-primary hover:text-primary"
                  >
                    <ThumbsUp size={14} />
                    Helpful ({review.helpful_count})
                  </button>
                </article>
              ))}
              {data.pages > 1 && (
                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-gray-500">
                    Page {data.page} of {data.pages}
                  </span>
                  <button
                    type="button"
                    disabled={page >= data.pages}
                    onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
                    className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-gray-200 p-8 text-center">
              <p className="font-semibold text-gray-800">No reviews yet</p>
              <p className="mt-1 text-sm text-gray-500">Be the first to share your experience with this product.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
