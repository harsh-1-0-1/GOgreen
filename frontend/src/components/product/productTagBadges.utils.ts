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

// ─── Custom-colour helpers ────────────────────────────────────────────────
// Used when an admin assigns a colour to a tag/badge in the product editor.
// We derive a readable text colour and a subtle border so badges keep a
// consistent pill look regardless of the chosen hex.

export function getReadableTextColor(hex: string): string {
  const h = (hex || '').replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return '#FFFFFF';
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#1F2937' : '#FFFFFF';
}

export function shadeColor(hex: string, percent: number): string {
  const h = (hex || '').replace('#', '');
  const r = Math.min(255, Math.max(0, Math.round(parseInt(h.slice(0, 2), 16) * (1 + percent))));
  const g = Math.min(255, Math.max(0, Math.round(parseInt(h.slice(2, 4), 16) * (1 + percent))));
  const b = Math.min(255, Math.max(0, Math.round(parseInt(h.slice(4, 6), 16) * (1 + percent))));
  if ([r, g, b].some((n) => Number.isNaN(n))) return hex;
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}

function titleCase(value: string): string {
  return value
    .split('-')
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');
}

export type ResolvedTagStyle = TagConfig & { custom: boolean };

/**
 * Resolve a list of tag slugs plus the global admin-defined tag colour map
 * (slug → colour from the `tags` table) into the pill styles actually
 * rendered in the catalog.
 *
 * Only tags that have an explicitly defined colour are rendered. Colours come
 * exclusively from admin-created tags (the global `tags` table) — there is no
 * built-in palette, so a tag that no longer exists in the table stops being
 * displayed. Duplicate labels collapse into one pill, preferring the
 * explicitly coloured variant.
 */
export function resolveTagStyles(
  tags: string[] | null | undefined,
  tagColors?: Record<string, string> | null,
): ResolvedTagStyle[] {
  if (!tags || tags.length === 0) return [];

  const entries: ResolvedTagStyle[] = [];
  const indexByLabel = new Map<string, number>();

  for (const raw of tags) {
    const value = (raw || '').trim();
    if (!value) continue;
    const key = value.toLowerCase().replace(/\s+/g, '-');
    const customColor = tagColors?.[value] || tagColors?.[key] || '';

    if (!customColor) continue;

    const entry: ResolvedTagStyle = {
      label: titleCase(value),
      bg: customColor,
      text: getReadableTextColor(customColor),
      border: shadeColor(customColor, -0.18),
      slug: key,
      custom: true,
    };

    const existingIndex = indexByLabel.get(entry.label);
    if (existingIndex !== undefined) {
      if (customColor && !entries[existingIndex].custom) {
        entries[existingIndex] = entry;
      }
      continue;
    }
    indexByLabel.set(entry.label, entries.length);
    entries.push(entry);
  }

  return entries;
}
