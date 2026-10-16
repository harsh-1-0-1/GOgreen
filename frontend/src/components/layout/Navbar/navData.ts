import type { Category, MenuItem } from '@/types';

export interface DropdownLink {
  label: string;
  href: string;
  /** Optional thumbnail shown in the Shop mega-menu image-tile layout. */
  image?: string;
}

export interface DropdownGroup {
  title?: string;
  links: DropdownLink[];
}

export interface NavItemDef {
  label: string;
  href: string;
  highlight?: boolean;
  /**
   * `isShopMenu` marks this item as the special image-tile mega-menu.
   * The renderer uses a different layout branch for it.
   */
  isShopMenu?: boolean;
  groups?: DropdownGroup[][];
}

export interface StaticLink {
  label: string;
  href: string;
  highlight?: boolean;
  image?: string;
  accent?: string;
}

export const WHATSAPP_NUMBER: string =
  import.meta.env.VITE_WHATSAPP_NUMBER ?? '917083883105';

/** Display-friendly version: +91 XXXXX XXXXX */
export const SUPPORT_PHONE_DISPLAY: string = (() => {
  const raw: string = import.meta.env.VITE_SUPPORT_PHONE ?? '917083883105';
  // Format 91XXXXXXXXXX → +91 XXXXX XXXXX
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  return `+${digits}`;
})();

/**
 * Fallback submenu for Gifting — used only before the API has responded.
 */
export const FALLBACK_GIFTING_SUBMENU: DropdownLink[] = [
  { label: 'All Gifts', href: '/products?tags=gifting' },
  { label: 'Plant Gifting', href: '/products?tags=gifting' },
  { label: 'Corporate Gifting', href: '/corporate-gifting' },
  { label: 'Vastu Gifting', href: '/products?tags=vastu-friendly' },
];

export function sortByMenuOrder<T extends { sort_order?: number; id?: number }>(
  items: T[],
): T[] {
  return [...items].sort((a, b) => {
    const orderDiff = (a.sort_order ?? 0) - (b.sort_order ?? 0);
    if (orderDiff !== 0) return orderDiff;
    return (a.id ?? 0) - (b.id ?? 0);
  });
}

export function categoryLink(category: { slug: string }): string {
  return `/products?category=${category.slug}`;
}

function columnize(links: DropdownLink[]): DropdownGroup[][] {
  if (links.length <= 6) return [[{ links }]];
  const half = Math.ceil(links.length / 2);
  return [[{ links: links.slice(0, half) }], [{ links: links.slice(half) }]];
}

function findRoot(categories: Category[], label: string): Category | undefined {
  return categories.find(
    (c) => c.name.toLowerCase().trim() === label.toLowerCase().trim(),
  );
}

/** Root category -> submenu links ("All <Root>" + its children). */
export function subcategoryLinks(root: Category): DropdownLink[] | null {
  const children = sortByMenuOrder(root.children ?? []);
  if (children.length === 0) return null;
  return [
    { label: `All ${root.name}`, href: categoryLink(root) },
    ...children.map((c) => ({ label: c.name, href: categoryLink(c) })),
  ];
}

/**
 * Builds the single "SHOP" nav item that collapses all root categories into
 * one mega-menu with image tiles on the left and static links on the right.
 *
 * groups layout (passed to the renderer):
 *   groups[0]  — left "panel": one group per root category, each link carries
 *                the category image so the renderer can show a thumbnail tile.
 *   groups[1]  — right "panel": static / admin-configured extra links that
 *                the non-category menu items (DB-driven) contribute.
 */
export function buildShopNavItem(
  categories: Category[],
  menuItems: MenuItem[],
): NavItemDef {
  const roots = sortByMenuOrder(categories);

  // Left column — one link per root category, carrying its image
  const categoryLinks: DropdownLink[] = roots.map((root) => ({
    label: root.name,
    href: categoryLink(root),
    image: root.image_url ?? root.mobile_image_url ?? undefined,
  }));

  // Right column — DB-driven top-level menu items (non-category extras like
  // "Corporate Gifting", "Deals of the Day", etc.) grouped by their label.
  const extraItems = menuItems
    .filter((m) => !m.parent_id && m.is_active)
    .sort((a, b) => a.sort_order - b.sort_order);

  const rightLinks: DropdownLink[] = extraItems.map((m) => ({
    label: m.label,
    href: m.href,
  }));

  // Build groups — always include the left (categories). Add the right column
  // only when there are DB-driven extras so we don't leave a hollow column.
  const groups: DropdownGroup[][] = [
    [{ title: 'Shop by Category', links: categoryLinks }],
  ];

  if (rightLinks.length > 0) {
    groups.push([{ title: 'More', links: rightLinks }]);
  }

  return {
    label: 'SHOP',
    href: '/products',
    isShopMenu: true,
    groups,
  };
}

/**
 * Desktop nav items from the category tree + DB-driven menu items.
 *
 * All root categories are collapsed into a single "SHOP ▾" mega-menu item.
 * DB-driven top-level menu items that are NOT categories are appended after it
 * as individual nav links (e.g. "CORPORATE GIFTING", "DEALS").
 */
export function categoryTreeToNavItems(
  categories: Category[],
  menuItems: MenuItem[],
): NavItemDef[] {
  const shopItem = buildShopNavItem(categories, menuItems);

  // DB-driven top-level items rendered as standalone nav links (after Shop)
  const dynamicItems = menuItems
    .filter((m) => !m.parent_id)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((m) => ({
      label: m.label.toUpperCase(),
      href: m.href,
      highlight: m.highlight || undefined,
    }));

  return [shopItem, ...dynamicItems];
}

/**
 * Resolve the submenu for a label from the DB-driven flat menu item list.
 * Falls back to the category tree (existing behavior).
 */
export function resolveSubcategories(
  categories: Category[],
  label: string,
  menuItems: MenuItem[],
): DropdownLink[] | null {
  // 1. DB category tree first (existing behavior)
  const root = findRoot(categories, label);
  if (root) return subcategoryLinks(root);

  // 2. DB-driven flat menu item list — find parent by label
  const normalizedLabel = label.toLowerCase().trim();
  const parent = menuItems.find(
    (m) => !m.parent_id && m.label.toLowerCase().trim() === normalizedLabel,
  );
  if (parent) {
    const children = menuItems
      .filter((m) => m.parent_id === parent.id && m.is_active)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((m) => ({ label: m.label, href: m.href }));
    if (children.length > 0) return children;
  }

  return null;
}
