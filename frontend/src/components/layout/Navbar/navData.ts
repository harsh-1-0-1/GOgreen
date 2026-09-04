import type { Category, MenuItem } from '@/types';

export interface DropdownLink {
  label: string;
  href: string;
}

export interface DropdownGroup {
  title?: string;
  links: DropdownLink[];
}

export interface NavItemDef {
  label: string;
  href: string;
  highlight?: boolean;
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
 * Hardcoded FALLBACK menu items. Used ONLY before the menu API has responded
 * (dataUpdatedAt === 0). Under normal operation the DB-driven flat list from
 * /menu_items always wins. These mirror the seed data.
 */
export const FALLBACK_MENU_ITEMS: StaticLink[] = [
  {
    label: 'Gifting',
    href: '/products?tags=gifting',
    image: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=280&q=80',
    accent: '#f9c8d4',
  },
  {
    label: 'Corporate Gifts',
    href: '/corporate-gifting',
    image: 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=280&q=80',
    accent: '#cdebd7',
  },
  {
    label: 'Garden Services',
    href: '/products?tags=garden-services',
    image: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=280&q=80',
    accent: '#d6e6f5',
  },
  {
    label: 'Blog',
    href: '/blog',
    image: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=280&q=80',
    accent: '#f9c8d4',
  },
  {
    label: 'Offers',
    href: '/products?tags=offers',
    highlight: true,
    image: 'https://images.unsplash.com/photo-1560693225-b8507d6f3aa9?w=280&q=80',
    accent: '#f9e4a0',
  },
];

/** Fallback submenu for Gifting — used only before the API has responded. */
export const FALLBACK_GIFTING_SUBMENU: DropdownLink[] = [
  { label: 'All Gifts', href: '/products?tags=gifting' },
  { label: 'Plant Gifting', href: '/products?tags=gifting' },
  { label: 'Corporate Gifting', href: '/corporate-gifting' },
  { label: 'Vastu Gifting', href: '/products?tags=vastu-friendly' },
];

export function sortByMenuOrder<T extends { sort_order?: number; name?: string; id?: number }>(
  items: T[],
): T[] {
  return [...items].sort((a, b) => {
    const orderDiff = (a.sort_order ?? 0) - (b.sort_order ?? 0);
    if (orderDiff !== 0) return orderDiff;
    return ((a.name ?? '') as string).localeCompare(b.name ?? '');
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
 * Desktop nav items from the category tree + DB-driven menu items.
 *
 * `menuItems` is a FLAT list from /menu_items (or [] when the API hasn't
 * responded yet). Top-level items are those with parent_id == null. Children
 * (parent_id set) are filtered out here; they form the submenu dropdown for
 * their parent via resolveSubcategories.
 */
export function categoryTreeToNavItems(
  categories: Category[],
  menuItems: MenuItem[],
): NavItemDef[] {
  const roots = sortByMenuOrder(categories);
  const items: NavItemDef[] = roots.map((root) => {
    const children = sortByMenuOrder(root.children ?? []);
    const item: NavItemDef = {
      label: root.name.toUpperCase(),
      href: categoryLink(root),
    };
    if (children.length > 0) {
      item.groups = columnize(
        children.map((c) => ({ label: c.name, href: categoryLink(c) })),
      );
    }
    return item;
  });

  const dynamicItems = menuItems
    .filter((m) => !m.parent_id)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((m) => ({
      label: m.label.toUpperCase(),
      href: m.href,
      highlight: m.highlight || undefined,
    }));

  return [...items, ...dynamicItems];
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
