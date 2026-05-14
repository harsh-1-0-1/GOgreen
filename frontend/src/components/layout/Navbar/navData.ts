import type { Banner } from '@/types';

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

export const NAV_ITEMS: NavItemDef[] = [
  {
    label: 'PLANTS',
    href: '/products?category=plants',
    groups: [
      [
        {
          links: [
            { label: 'XL Plants', href: '/products?category=xl-plants' },
            { label: 'Indoor Plants', href: '/products?category=indoor-plants' },
            { label: 'Flowering Plants', href: '/products?category=flowering-plants' },
            { label: 'Low Maintenance Plants', href: '/products?category=low-maintenance-plants' },
            { label: 'Air Purifying Plants', href: '/products?category=air-purifying-plants' },
            { label: 'Cacti & Succulents', href: '/products?category=cacti-succulents' },
            { label: 'Hanging Plants', href: '/products?category=hanging-plants' },
            { label: 'Pet-Friendly Plants', href: '/products?category=pet-friendly-plants' },
            { label: 'Fruit Plants', href: '/products?category=fruit-plants' },
          ],
        },
      ],
      [
        {
          title: 'Shop by Location',
          links: [
            { label: 'Balcony', href: '/products?tags=balcony' },
            { label: 'Workspace', href: '/products?tags=workspace' },
            { label: 'Living Room', href: '/products?tags=living-room' },
            { label: 'Bedroom', href: '/products?tags=bedroom' },
          ],
        },
        {
          title: 'Shop by Name',
          links: [
            { label: 'Money Plant', href: '/products?search=money+plant' },
            { label: 'Snake Plant', href: '/products?search=snake+plant' },
            { label: 'Jade Plant', href: '/products?search=jade+plant' },
            { label: 'Areca Palm', href: '/products?search=areca+palm' },
          ],
        },
      ],
    ],
  },
  {
    label: 'SEEDS',
    href: '/products?category=seeds',
    groups: [
      [
        {
          links: [
            { label: 'Flower Seeds', href: '/products?category=flower-seeds' },
            { label: 'Vegetable Seeds', href: '/products?category=vegetable-seeds' },
            { label: 'Microgreen Seeds', href: '/products?category=microgreen-seeds' },
            { label: 'Herb Seeds', href: '/products?category=herb-seeds' },
            { label: 'Flower Bulbs', href: '/products?category=flower-bulbs' },
            { label: 'Seeds Kits', href: '/products?category=seeds-kits' },
          ],
        },
      ],
    ],
  },
  {
    label: 'POTS & PLANTERS',
    href: '/products?category=pots-planters',
    groups: [
      [
        {
          links: [
            { label: 'Plastic Pots', href: '/products?category=plastic-pots' },
            { label: 'Ceramic Pots', href: '/products?category=ceramic-pots' },
            { label: 'Metal Planters', href: '/products?category=metal-planters' },
            { label: 'Wooden Planters', href: '/products?category=wooden-planters' },
            { label: 'Hanging Planters', href: '/products?category=hanging-planters' },
            { label: 'Plant Stands', href: '/products?category=plant-stands' },
          ],
        },
      ],
    ],
  },
  {
    label: 'PLANT CARE',
    href: '/products?category=plant-care',
    groups: [
      [
        {
          links: [
            { label: 'Potting Mix & Fertilizers', href: '/products?category=potting-mix-fertilizers' },
            { label: 'Garden Tools', href: '/products?category=garden-tools' },
            { label: 'Watering Tools', href: '/products?category=watering-tools' },
            { label: 'Pest Control', href: '/products?category=pest-control' },
          ],
        },
      ],
    ],
  },
  { label: 'GIFTING', href: '/products?tags=gifting' },
  { label: 'CORPORATE GIFTS', href: '/corporate-gifting' },
  { label: 'GARDEN SERVICES', href: '/products?tags=garden-services' },
  { label: 'BLOG', href: '/blog' },
  { label: 'OFFERS', href: '/products?tags=offers', highlight: true },
];

export const WHATSAPP_NUMBER = '917083883105';

export interface MobileCollection {
  label: string;
  href: string;
  image: string;
  accent: string;
}

export const MOBILE_COLLECTIONS: MobileCollection[] = [
  {
    label: 'Plants',
    href: '/products?category=plants',
    image:
      'https://images.unsplash.com/photo-1592150621744-aca64f48394a?w=280&q=80',
    accent: '#f9c8d4',
  },
  {
    label: 'Seeds',
    href: '/products?category=seeds',
    image:
      'https://images.unsplash.com/photo-1592321675774-3de57f3ee0dc?w=280&q=80',
    accent: '#f9e4a0',
  },
  {
    label: 'Planters',
    href: '/products?category=pots-planters',
    image:
      'https://images.unsplash.com/photo-1622398925373-3f91b1e275f5?w=280&q=80',
    accent: '#f9c8d4',
  },
  {
    label: 'Plant Care',
    href: '/products?category=plant-care',
    image:
      'https://images.unsplash.com/photo-1584132967334-10e028bd69f7?w=280&q=80',
    accent: '#f9e4a0',
  },
  {
    label: 'Gifting',
    href: '/products?tags=gifting',
    image:
      'https://images.unsplash.com/photo-1549465220-1a8b9238cd48?w=280&q=80',
    accent: '#f9c8d4',
  },
  {
    label: 'Corporate Gifts',
    href: '/corporate-gifting',
    image:
      'https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=280&q=80',
    accent: '#cdebd7',
  },
  {
    label: 'Blog',
    href: '/blog',
    image:
      'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=280&q=80',
    accent: '#f9c8d4',
  },
  {
    label: 'Offers',
    href: '/products?tags=offers',
    image:
      'https://images.unsplash.com/photo-1560693225-b8507d6f3aa9?w=280&q=80',
    accent: '#f9e4a0',
  },
];

export function bannerToCollection(b: Banner): MobileCollection {
  return {
    label: b.title,
    href: b.cta_link || '/products',
    image: b.image_url || '',
    accent: b.bg_color || '#f9c8d4',
  };
}

export const LABEL_TO_NAV: Record<string, NavItemDef | undefined> = {};
for (const item of NAV_ITEMS) {
  const key = item.label.charAt(0) + item.label.slice(1).toLowerCase();
  LABEL_TO_NAV[key] = item;
}
LABEL_TO_NAV['Planters'] = NAV_ITEMS.find((n) => n.label === 'POTS & PLANTERS');
LABEL_TO_NAV['Corporate Gifts'] = NAV_ITEMS.find((n) => n.label === 'CORPORATE GIFTS');
