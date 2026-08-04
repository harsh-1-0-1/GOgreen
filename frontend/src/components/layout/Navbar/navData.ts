import type { Category } from '@/types';

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

export interface MobileCollection {
  label: string;
  href: string;
  image: string;
  accent: string;
}

export interface StaticLink {
  label: string;
  href: string;
  highlight?: boolean;
  image?: string;
  accent?: string;
}

export const WHATSAPP_NUMBER = '917083883105';

const ACCENT_PALETTE = ['#f9c8d4', '#f9e4a0', '#cdebd7', '#d6e6f5', '#f3d9f5'];

/**
 * Non-category site links. These are NOT taxonomy nodes and are merged
 * into the category-driven menu at render time.
 */
export const STATIC_LINKS: StaticLink[] = [
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

/** Static submenu for Gifting — tag/landing based, not a category. */
export const GIFTING_SUBMENU: DropdownLink[] = [
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
 * Desktop menu items from the category tree + static links.
 * Roots with children become mega-dropdown items; childless roots and
 * static links become plain links.
 */
export function categoryTreeToNavItems(
  categories: Category[],
  staticLinks: StaticLink[] = STATIC_LINKS,
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
  return [
    ...items,
    ...staticLinks.map((link) => ({
      label: link.label.toUpperCase(),
      href: link.href,
      highlight: link.highlight,
    })),
  ];
}

/**
 * Mobile collection list items from the category tree + static links.
 */
export function categoryTreeToMobileCollections(
  categories: Category[],
  staticLinks: StaticLink[] = STATIC_LINKS,
): MobileCollection[] {
  const roots = sortByMenuOrder(categories);
  const items: MobileCollection[] = roots.map((root, i) => ({
    label: root.name,
    href: categoryLink(root),
    image: root.image_url || '',
    accent: ACCENT_PALETTE[i % ACCENT_PALETTE.length],
  }));
  return [
    ...items,
    ...staticLinks.map((link, i) => ({
      label: link.label,
      href: link.href,
      image: link.image || '',
      accent: link.accent || ACCENT_PALETTE[(roots.length + i) % ACCENT_PALETTE.length],
    })),
  ];
}

/**
 * label -> NavItemDef lookup for the mobile collections accordion.
 * Built from the category tree so it stays DB-driven.
 */
export function buildLabelToNav(
  categories: Category[],
  staticLinks: StaticLink[] = STATIC_LINKS,
): Record<string, NavItemDef | undefined> {
  const map: Record<string, NavItemDef | undefined> = {};
  for (const root of categories) {
    const submenu = subcategoryLinks(root);
    map[root.name] = {
      label: root.name,
      href: categoryLink(root),
      groups: submenu
        ? columnize(
            (root.children ?? [])
              .map((c) => ({ label: c.name, href: categoryLink(c) })),
          )
        : undefined,
    };
  }
  for (const link of staticLinks) {
    map[link.label] = {
      label: link.label,
      href: link.href,
      highlight: link.highlight,
      groups:
        link.label === 'Gifting'
          ? [[{ links: GIFTING_SUBMENU }]]
          : undefined,
    };
  }
  return map;
}

/** Resolve a submenu for a mobile/desktop menu label from the tree. */
export function resolveSubcategories(
  categories: Category[],
  label: string,
): DropdownLink[] | null {
  const root = findRoot(categories, label);
  if (root) return subcategoryLinks(root);
  if (label.toLowerCase().trim() === 'gifting') return GIFTING_SUBMENU;
  return null;
}
