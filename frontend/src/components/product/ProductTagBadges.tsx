import { Link } from 'react-router-dom';
import { ALLOWED_TAGS_MAP, type TagConfig } from './productTagBadges.utils';

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

  // Filter and map incoming tags to keep only the allowed types
  const mappedList = tags
    .map((t) => {
      const key = t.toLowerCase().trim().replace(/\s+/g, '-');
      return ALLOWED_TAGS_MAP[key] || null;
    })
    .filter((styleObj): styleObj is TagConfig => styleObj !== null);

  // Deduplicate by label (e.g. low-maintenance + easy-care → one "Easy Care" badge)
  const seenLabels = new Set<string>();
  const uniqueMapped = mappedList.filter((styleObj) => {
    if (seenLabels.has(styleObj.label)) return false;
    seenLabels.add(styleObj.label);
    return true;
  });

  if (uniqueMapped.length === 0) return null;

  const visibleTags = maxTags !== undefined ? uniqueMapped.slice(0, maxTags) : uniqueMapped;

  const sizeClasses =
    size === 'md'
      ? 'text-[10px] sm:text-xs px-2.5 py-0.75 sm:px-3 sm:py-1'
      : 'text-[9px] sm:text-[10px] px-2 py-0.5 sm:px-2.5 sm:py-0.75';

  const baseClass = `inline-flex items-center font-semibold rounded-full leading-none tracking-wide whitespace-nowrap transition-colors shadow-[0_1px_2px_rgba(0,0,0,0.03)] ${sizeClasses}`;

  return (
    <div className={`flex flex-wrap gap-1 sm:gap-1.5 ${className}`}>
      {visibleTags.map((tag) => {
        const badgeStyle = {
          backgroundColor: tag.bg,
          color: tag.text,
          border: `1px solid ${tag.border}`,
        };

        if (asLinks) {
          return (
            <Link
              key={tag.label}
              to={`/products?tags=${encodeURIComponent(tag.slug)}`}
              className={`${baseClass} hover:brightness-[0.98] active:brightness-[0.96]`}
              style={badgeStyle}
              onClick={(e) => e.stopPropagation()}
            >
              {tag.label}
            </Link>
          );
        }

        return (
          <span key={tag.label} className={baseClass} style={badgeStyle}>
            {tag.label}
          </span>
        );
      })}
    </div>
  );
}
