/**
 * Canonical tag key.
 *
 * Mirrors `slugify()` in `backend/app/utils/slugs.py` so a tag label typed in
 * the admin ("Vastu friendly") and the slug used in URLs (`vastu-friendly`)
 * collapse to the same key. Badge colour lookup and the catalog tag filter both
 * depend on this agreeing with the backend — when the two drifted, a tag with a
 * space in its name could not be matched and lost its colour.
 */
export function toTagKey(value: string | null | undefined): string {
  return (value ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
