import { Link } from 'react-router-dom';

// ---------------------------------------------------------------------------
// Tag mapping and exact pastel color styling for Plantoga
// ---------------------------------------------------------------------------
interface TagConfig {
  label: string;
  bg: string;
  text: string;
  border: string;
  slug: string;
}

const ALLOWED_TAGS_MAP: Record<string, TagConfig> = {
  // Air Purifying -> #d5e9f2
  'air-purifying': {
    label: 'Air Purifying',
    bg: '#d5e9f2',
    text: '#1e3e57',
    border: '#b3d3e3',
    slug: 'air-purifying',
  },
  
  // Modern Decor -> #fedfc3
  'modern-decor': {
    label: 'Modern Decor',
    bg: '#fedfc3',
    text: '#6b3f17',
    border: '#f9cb9e',
    slug: 'modern-decor',
  },
  'modern': {
    label: 'Modern Decor',
    bg: '#fedfc3',
    text: '#6b3f17',
    border: '#f9cb9e',
    slug: 'modern-decor',
  },
  
  // Easy Care -> #cde3b5
  'easy-care': {
    label: 'Easy Care',
    bg: '#cde3b5',
    text: '#2e4c19',
    border: '#b1cc96',
    slug: 'easy-care',
  },
  'low-maintenance': {
    label: 'Easy Care',
    bg: '#cde3b5',
    text: '#2e4c19',
    border: '#b1cc96',
    slug: 'easy-care',
  },
  'beginner-friendly': {
    label: 'Easy Care',
    bg: '#cde3b5',
    text: '#2e4c19',
    border: '#b1cc96',
    slug: 'easy-care',
  },
  
  // Tropical -> #f0d5e8
  'tropical': {
    label: 'Tropical',
    bg: '#f0d5e8',
    text: '#5c1f46',
    border: '#e3bad6',
    slug: 'tropical',
  },
  
  // Pet Friendly -> #fff0c2
  'pet-friendly': {
    label: 'Pet Friendly',
    bg: '#fff0c2',
    text: '#614f10',
    border: '#fad891',
    slug: 'pet-friendly',
  },
  'pet-safe': {
    label: 'Pet Friendly',
    bg: '#fff0c2',
    text: '#614f10',
    border: '#fad891',
    slug: 'pet-friendly',
  },
  
  // Vastu Friendly -> #d9e0ce
  'vastu-friendly': {
    label: 'Vastu Friendly',
    bg: '#d9e0ce',
    text: '#3c4c28',
    border: '#c2cca7',
    slug: 'vastu-friendly',
  },
  'lucky': {
    label: 'Vastu Friendly',
    bg: '#d9e0ce',
    text: '#3c4c28',
    border: '#c2cca7',
    slug: 'vastu-friendly',
  },
};

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

  // Filter and map incoming tags to keep only the 6 allowed types
  const mappedList = tags
    .map((t) => {
      const key = t.toLowerCase().trim().replace(/\s+/g, '-');
      return ALLOWED_TAGS_MAP[key] || null;
    })
    .filter((styleObj): styleObj is TagConfig => styleObj !== null);

  // Deduplicate tags by label (e.g. if product has both low-maintenance and easy-care, show only one Easy Care)
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

export function getTagStyle(slug: string) {
  const key = slug.toLowerCase().trim().replace(/\s+/g, '-');
  const config = ALLOWED_TAGS_MAP[key] || {
    label: slug,
    bg: '#F3F4F6',
    text: '#6B7280',
    border: '#E5E7EB',
  };
  return {
    bg: config.bg,
    text: config.text,
    border: config.border,
  };
}
