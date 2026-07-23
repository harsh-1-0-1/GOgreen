// Utilities extracted from ProductTagBadges.tsx so that file can export
// only components (required for React Fast Refresh / HMR).

export interface TagConfig {
  label: string;
  bg: string;
  text: string;
  border: string;
  slug: string;
}

export const ALLOWED_TAGS_MAP: Record<string, TagConfig> = {
  'air-purifying': { label: 'Air Purifying', bg: '#d5e9f2', text: '#1e3e57', border: '#b3d3e3', slug: 'air-purifying' },
  'modern-decor':  { label: 'Modern Decor',  bg: '#fedfc3', text: '#6b3f17', border: '#f9cb9e', slug: 'modern-decor' },
  'modern':        { label: 'Modern Decor',  bg: '#fedfc3', text: '#6b3f17', border: '#f9cb9e', slug: 'modern-decor' },
  'easy-care':        { label: 'Easy Care', bg: '#cde3b5', text: '#2e4c19', border: '#b1cc96', slug: 'easy-care' },
  'low-maintenance':  { label: 'Easy Care', bg: '#cde3b5', text: '#2e4c19', border: '#b1cc96', slug: 'easy-care' },
  'beginner-friendly':{ label: 'Easy Care', bg: '#cde3b5', text: '#2e4c19', border: '#b1cc96', slug: 'easy-care' },
  'tropical':    { label: 'Tropical',     bg: '#f0d5e8', text: '#5c1f46', border: '#e3bad6', slug: 'tropical' },
  'pet-friendly':{ label: 'Pet Friendly', bg: '#fff0c2', text: '#614f10', border: '#fad891', slug: 'pet-friendly' },
  'pet-safe':    { label: 'Pet Friendly', bg: '#fff0c2', text: '#614f10', border: '#fad891', slug: 'pet-friendly' },
  'vastu-friendly': { label: 'Vastu Friendly', bg: '#d9e0ce', text: '#3c4c28', border: '#c2cca7', slug: 'vastu-friendly' },
  'lucky':          { label: 'Vastu Friendly', bg: '#d9e0ce', text: '#3c4c28', border: '#c2cca7', slug: 'vastu-friendly' },
};

export function getTagStyle(slug: string) {
  const key = slug.toLowerCase().trim().replace(/\s+/g, '-');
  const config = ALLOWED_TAGS_MAP[key] ?? {
    label: slug,
    bg: '#F3F4F6',
    text: '#6B7280',
    border: '#E5E7EB',
  };
  return { bg: config.bg, text: config.text, border: config.border };
}
