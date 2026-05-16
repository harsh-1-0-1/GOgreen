/**
 * Centralized product tag/badge design system for Plantoga.
 *
 * Usage:
 *   import ProductTagBadges from '@/components/product/ProductTagBadges';
 *   <ProductTagBadges tags={product.tags} maxTags={2} />
 *
 * Or as clickable filter links on detail pages:
 *   <ProductTagBadges tags={product.tags} asLinks />
 */

import { Link } from 'react-router-dom';

// ---------------------------------------------------------------------------
// Color palette — each tag slug maps to a pastel { bg, text, border } triple
// ---------------------------------------------------------------------------
const TAG_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  // Care attributes
  'easy-care':          { bg: '#DCFCE7', text: '#16A34A', border: '#BBF7D0' },
  'low-maintenance':    { bg: '#ECFDF5', text: '#059669', border: '#A7F3D0' },
  'beginner-friendly':  { bg: '#ECFDF5', text: '#059669', border: '#A7F3D0' },

  // Air & environment
  'air-purifying':      { bg: '#E0F4FF', text: '#0369A1', border: '#BAE6FD' },
  'indoor':             { bg: '#F0F9FF', text: '#0284C7', border: '#BAE6FD' },
  'indoor-plant':       { bg: '#F0F9FF', text: '#0284C7', border: '#BAE6FD' },

  // Outdoor
  'outdoor':            { bg: '#FEFCE8', text: '#A16207', border: '#FDE68A' },
  'outdoor-plant':      { bg: '#FEFCE8', text: '#A16207', border: '#FDE68A' },

  // Vastu / spiritual
  'vastu-friendly':     { bg: '#F0FDF4', text: '#15803D', border: '#86EFAC' },
  'lucky':              { bg: '#FEFCE8', text: '#92400E', border: '#FDE68A' },

  // Décor
  'modern-decor':       { bg: '#FFF7ED', text: '#C2410C', border: '#FED7AA' },

  // Flowering
  'flowering':          { bg: '#FDF4FF', text: '#A21CAF', border: '#F0ABFC' },
  'fragrant':           { bg: '#FFF0FB', text: '#BE185D', border: '#FBCFE8' },

  // Growth form
  'hanging':            { bg: '#F0F9FF', text: '#075985', border: '#BAE6FD' },
  'hanging-plant':      { bg: '#F0F9FF', text: '#075985', border: '#BAE6FD' },
  'trailing':           { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
  'climbing':           { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },

  // Special types
  'succulent':          { bg: '#FFFBEB', text: '#B45309', border: '#FDE68A' },
  'cactus':             { bg: '#FFFBEB', text: '#92400E', border: '#FDE68A' },
  'tropical':           { bg: '#F0FDFA', text: '#0F766E', border: '#99F6E4' },
  'rare':               { bg: '#F5F3FF', text: '#7C3AED', border: '#DDD6FE' },
  'variegated':         { bg: '#F9FAFB', text: '#374151', border: '#E5E7EB' },
  'bonsai':             { bg: '#FFF7ED', text: '#9A3412', border: '#FED7AA' },

  // Pet
  'pet-friendly':       { bg: '#FFF1F2', text: '#BE123C', border: '#FECDD3' },

  // Sale / promo
  'sale':               { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA' },
  'new-arrival':        { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
};

const DEFAULT_STYLE = { bg: '#F3F4F6', text: '#6B7280', border: '#E5E7EB' };

/** Format a slug like "air-purifying" → "Air Purifying" */
function formatTag(slug: string): string {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Return the pastel style for a tag slug (case-insensitive, whitespace-tolerant) */
export function getTagStyle(slug: string) {
  const key = slug.toLowerCase().trim().replace(/\s+/g, '-');
  return TAG_STYLES[key] ?? DEFAULT_STYLE;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
interface ProductTagBadgesProps {
  tags: string[] | null | undefined;
  /** Maximum number of badges to render. Default: all tags */
  maxTags?: number;
  /** Size variant. "sm" for cards, "md" for detail pages. Default: "sm" */
  size?: 'sm' | 'md';
  /** If true, each badge is a clickable link to /products?tags=<slug> */
  asLinks?: boolean;
  /** Extra class applied to the wrapping flex container */
  className?: string;
}

export default function ProductTagBadges({
  tags,
  maxTags,
  size = 'sm',
  asLinks = false,
  className = '',
}: ProductTagBadgesProps) {
  if (!tags || tags.length === 0) return null;

  const visibleTags = maxTags !== undefined ? tags.slice(0, maxTags) : tags;

  const sizeClasses =
    size === 'md'
      ? 'text-xs sm:text-sm px-3 py-1 sm:px-3.5 sm:py-1.5'
      : 'text-[9px] sm:text-[11px] px-2 sm:px-2.5 py-0.5 sm:py-1';

  const baseClass = `inline-flex items-center font-semibold rounded-full leading-tight tracking-wide whitespace-nowrap transition-colors ${sizeClasses}`;

  return (
    <div className={`flex flex-wrap gap-1 sm:gap-1.5 ${className}`}>
      {visibleTags.map((tag) => {
        const style = getTagStyle(tag);
        const badgeStyle = {
          backgroundColor: style.bg,
          color: style.text,
          border: `1px solid ${style.border}`,
        };

        if (asLinks) {
          return (
            <Link
              key={tag}
              to={`/products?tags=${encodeURIComponent(tag)}`}
              className={`${baseClass} hover:brightness-95`}
              style={badgeStyle}
              onClick={(e) => e.stopPropagation()}
            >
              {formatTag(tag)}
            </Link>
          );
        }

        return (
          <span key={tag} className={baseClass} style={badgeStyle}>
            {formatTag(tag)}
          </span>
        );
      })}
    </div>
  );
}
