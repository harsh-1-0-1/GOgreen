import { useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { CheckCircle2, ChevronDown, ImagePlus, Star, ThumbsUp } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCreateReview, useMarkReviewHelpful, useProductReviews } from '@/hooks/useReviews';
import { useAuthStore } from '@/store/authStore';
import { getApiErrorDetail, isUnauthorizedError } from '@/lib/apiError';
import type { ReviewSummary } from '@/types';

const ratingRows = [5, 4, 3, 2, 1];

function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value.toFixed(1)} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={size}
          className={star <= Math.round(value) ? 'fill-[#f4b400] text-[#f4b400]' : 'fill-gray-200 text-gray-200'}
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
      <span>
        {summary.review_count} review{summary.review_count === 1 ? '' : 's'}
      </span>
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
    <div className="mx-auto w-full max-w-[520px] space-y-2.5">
      {ratingRows.map((star) => {
        const count = summary.rating_counts[star] ?? 0;
        const pct = Math.round((count / total) * 100);

        return (
          <button
            key={star}
            type="button"
            onClick={() => onSelect(activeRating === star ? undefined : star)}
            className={`grid w-full grid-cols-[54px_minmax(0,1fr)_42px] items-center gap-2.5 rounded-md px-1.5 py-1 text-left text-[13px] font-medium transition sm:grid-cols-[62px_minmax(0,1fr)_48px] ${
              activeRating === star ? 'bg-primary/5 text-primary' : 'text-gray-700 hover:bg-gray-50'
            }`}
            aria-label={`${star} star reviews, ${count} reviews`}
          >
            <span className="whitespace-nowrap">{star} star</span>
            <span className="h-3 overflow-hidden rounded-full bg-[#eeeeee]">
              <span className="block h-full rounded-full bg-[#f4b400] transition-all duration-500" style={{ width: `${pct}%` }} />
            </span>
            <span className="text-right text-gray-500">{count}</span>
          </button>
        );
      })}
    </div>
  );
}

function FieldLabel({ htmlFor, children }: { htmlFor?: string; children: string }) {
  return (
    <label htmlFor={htmlFor} className="block text-center text-sm font-semibold text-gray-900">
      {children}
    </label>
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
  const [sortBy, setSortBy] = useState<'newest' | 'highest' | 'lowest'>('newest');
  const [ratingFilter, setRatingFilter] = useState<number | undefined>();
  const [page, setPage] = useState(1);
  const [isWriting, setIsWriting] = useState(false);
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [mediaName, setMediaName] = useState('');

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
  const reviewsLabel = `${summary.review_count} review${summary.review_count === 1 ? '' : 's'}`;
  const sortedTitle = useMemo(() => {
    if (sortBy === 'highest') return 'Highest Rating';
    if (sortBy === 'lowest') return 'Lowest Rating';
    return 'Most Recent';
  }, [sortBy]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Review Title is required');
      return;
    }
    if (!body.trim()) {
      toast.error('Review Content is required');
      return;
    }
    if (!displayName.trim()) {
      toast.error('Display Name is required');
      return;
    }
    if (!email.trim()) {
      toast.error('Email Address is required');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      toast.error('Please enter a valid email address');
      return;
    }
    try {
      await createReview.mutateAsync({
        rating,
        title: title.trim() || undefined,
        body: body.trim() || undefined,
        author_name: displayName.trim() || undefined,
      });
      setTitle('');
      setBody('');
      setDisplayName('');
      setEmail('');
      setYoutubeUrl('');
      setMediaName('');
      setRating(5);
      setIsWriting(false);
      toast.success('Review submitted');
    } catch (err) {
      toast.error(getApiErrorDetail(err, 'Could not submit review'));
    }
  }

  function handleMediaChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setMediaName(file?.name ?? '');
  }

  async function markHelpful(reviewId: number) {
    try {
      await helpful.mutateAsync(reviewId);
    } catch (err) {
      if (isUnauthorizedError(err)) openAuthModal();
      else toast.error(getApiErrorDetail(err, 'Could not mark helpful'));
    }
  }

  return (
    <section id="customer-reviews" className="mt-10 border-t border-gray-100 pt-10 sm:mt-16 sm:pt-12">
      <div className="mx-auto w-full max-w-5xl px-0 text-center">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-2xl font-bold tracking-normal text-gray-950 sm:text-3xl">Customer Reviews</h2>
          <div className="mt-5 flex flex-col items-center gap-2">
            <Stars value={summary.average_rating} size={24} />
            <p className="text-4xl font-bold leading-none text-gray-950 sm:text-5xl">{summary.average_rating.toFixed(1)}</p>
            <p className="text-sm font-medium text-gray-500">Based on {reviewsLabel}</p>
          </div>
        </div>

        <div className="mt-7 sm:mt-8">
          <RatingBreakdown
            summary={summary}
            activeRating={ratingFilter}
            onSelect={(nextRating) => {
              setRatingFilter(nextRating);
              setPage(1);
            }}
          />
        </div>

        <button
          type="button"
          onClick={() => setIsWriting((value) => !value)}
          className="mt-8 inline-flex min-h-12 w-full max-w-[300px] items-center justify-center rounded-full bg-gray-950 px-8 py-3 text-sm font-bold text-white transition duration-200 hover:bg-primary focus:outline-none focus:ring-4 focus:ring-primary/20 sm:min-h-14 sm:text-base"
          aria-expanded={isWriting}
        >
          {isWriting ? 'Cancel Review' : 'Write a Review'}
        </button>

        <div
          className={`grid transition-all duration-500 ease-out ${
            isWriting ? 'mt-8 grid-rows-[1fr] opacity-100' : 'mt-0 grid-rows-[0fr] opacity-0'
          }`}
        >
          <div className="overflow-hidden">
            <form onSubmit={handleSubmit} className="mx-auto w-full max-w-2xl space-y-5 rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-7">
              <div className="space-y-2.5">
                <FieldLabel>Rating Stars</FieldLabel>
                <div className="flex justify-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className="rounded-full p-1.5 transition hover:bg-amber-50 focus:outline-none focus:ring-2 focus:ring-amber-300"
                      aria-label={`Rate ${star} stars`}
                    >
                      <Star size={34} className={star <= rating ? 'fill-[#f4b400] text-[#f4b400]' : 'fill-gray-200 text-gray-200'} />
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2.5">
                <FieldLabel htmlFor="review-title">Review Title *</FieldLabel>
                <input
                  id="review-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={140}
                  placeholder="Give your review a title"
                  required
                  className="min-h-12 w-full rounded-lg border border-gray-200 bg-white px-4 text-center text-base text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-primary focus:ring-4 focus:ring-primary/10"
                />
              </div>

              <div className="space-y-2.5">
                <FieldLabel htmlFor="review-body">Review Content *</FieldLabel>
                <textarea
                  id="review-body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  maxLength={4000}
                  rows={5}
                  placeholder="Share your experience with this product"
                  required
                  className="w-full resize-none rounded-lg border border-gray-200 bg-white px-4 py-3 text-center text-base leading-relaxed text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-primary focus:ring-4 focus:ring-primary/10"
                />
              </div>

              <div className="space-y-2.5">
                <FieldLabel htmlFor="review-media">Picture/Video Upload</FieldLabel>
                <label
                  htmlFor="review-media"
                  className="flex min-h-14 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-4 text-sm font-semibold text-gray-600 transition hover:border-primary hover:bg-primary/5"
                >
                  <ImagePlus size={18} />
                  <span className="max-w-full truncate">{mediaName || 'Choose picture or video'}</span>
                </label>
                <input id="review-media" type="file" accept="image/*,video/*" onChange={handleMediaChange} className="sr-only" />
              </div>

              <div className="space-y-2.5">
                <FieldLabel htmlFor="review-youtube">YouTube URL</FieldLabel>
                <input
                  id="review-youtube"
                  type="url"
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  placeholder="https://youtube.com/watch?v=..."
                  className="min-h-12 w-full rounded-lg border border-gray-200 bg-white px-4 text-center text-base text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-primary focus:ring-4 focus:ring-primary/10"
                />
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2.5">
                  <FieldLabel htmlFor="review-name">Display Name *</FieldLabel>
                  <input
                    id="review-name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    maxLength={255}
                    placeholder="Your name"
                    required
                    className="min-h-12 w-full rounded-lg border border-gray-200 bg-white px-4 text-center text-base text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-primary focus:ring-4 focus:ring-primary/10"
                  />
                </div>

                <div className="space-y-2.5">
                  <FieldLabel htmlFor="review-email">Email Address *</FieldLabel>
                  <input
                    id="review-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="min-h-12 w-full rounded-lg border border-gray-200 bg-white px-4 text-center text-base text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-primary focus:ring-4 focus:ring-primary/10"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={createReview.isPending}
                className="min-h-12 w-full rounded-full bg-primary px-6 py-3 text-base font-bold text-white transition hover:bg-primary/90 focus:outline-none focus:ring-4 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {createReview.isPending ? 'Submitting...' : 'Submit Review'}
              </button>
            </form>
          </div>
        </div>

        <div className="mt-10 border-t border-gray-100 pt-8 text-left sm:mt-12 sm:pt-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-xl font-bold text-gray-950">Reviews</h3>
              <p className="mt-1 text-sm text-gray-500">
                Showing {sortedTitle.toLowerCase()} reviews{ratingFilter ? ` filtered by ${ratingFilter} star` : ''}
              </p>
            </div>

            <div className="relative w-full sm:w-56">
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value as typeof sortBy);
                  setPage(1);
                }}
                className="min-h-12 w-full appearance-none rounded-full border border-gray-200 bg-white px-4 pr-10 text-sm font-semibold text-gray-800 outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"
                aria-label="Sort reviews"
              >
                <option value="newest">Most Recent</option>
                <option value="highest">Highest Rating</option>
                <option value="lowest">Lowest Rating</option>
              </select>
              <ChevronDown size={18} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-500" />
            </div>
          </div>

          {ratingFilter && (
            <button
              type="button"
              onClick={() => {
                setRatingFilter(undefined);
                setPage(1);
              }}
              className="mt-4 text-sm font-semibold text-primary hover:underline"
            >
              Clear {ratingFilter}-star filter
            </button>
          )}

          {isLoading ? (
            <div className="mt-5 grid gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-36 animate-pulse rounded-lg bg-gray-100" />
              ))}
            </div>
          ) : data?.items.length ? (
            <div className="mt-5 grid gap-4">
              {data.items.map((review) => (
                <article key={review.id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                        {review.author_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-bold text-gray-950">{review.author_name}</p>
                          {review.is_verified_purchase && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                              <CheckCircle2 size={12} /> Verified
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs font-medium text-gray-500">{formatDate(review.created_at)}</p>
                      </div>
                    </div>
                    <Stars value={review.rating} />
                  </div>

                  {review.title && <h4 className="mt-4 text-base font-bold text-gray-950">{review.title}</h4>}
                  {review.body && <p className="mt-2 text-sm leading-6 text-gray-700">{review.body}</p>}

                  <button
                    type="button"
                    onClick={() => markHelpful(review.id)}
                    className="mt-4 inline-flex min-h-9 items-center gap-1.5 rounded-full border border-gray-200 px-3 text-xs font-bold text-gray-600 transition hover:border-primary hover:text-primary focus:outline-none focus:ring-4 focus:ring-primary/10"
                  >
                    <ThumbsUp size={14} />
                    Helpful ({review.helpful_count})
                  </button>
                </article>
              ))}

              {data.pages > 1 && (
                <div className="flex flex-col items-center justify-between gap-3 pt-2 sm:flex-row">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="min-h-11 w-full rounded-full border border-gray-200 px-5 text-sm font-bold text-gray-700 transition hover:border-primary hover:text-primary disabled:opacity-40 sm:w-auto"
                  >
                    Previous
                  </button>
                  <span className="text-sm font-medium text-gray-500">
                    Page {data.page} of {data.pages}
                  </span>
                  <button
                    type="button"
                    disabled={page >= data.pages}
                    onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
                    className="min-h-11 w-full rounded-full border border-gray-200 px-5 text-sm font-bold text-gray-700 transition hover:border-primary hover:text-primary disabled:opacity-40 sm:w-auto"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-5 rounded-lg border border-dashed border-gray-200 bg-gray-50 p-8 text-center">
              <p className="font-bold text-gray-900">No reviews yet</p>
              <p className="mt-1 text-sm text-gray-500">Be the first to share your experience with this product.</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
