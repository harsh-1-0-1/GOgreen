import { useCategories } from '@/hooks/useCategories';
import { categoryLink, sortByMenuOrder } from '@/components/layout/Navbar/navData';

export interface SuggestionTile {
  title: string;
  subtitle: string;
  image: string;
  link: string;
  color: string;
}

const PRICE_DROP_TILE: SuggestionTile = {
  title: 'Price Drop',
  subtitle: 'Up to 50% OFF',
  image: 'https://images.unsplash.com/photo-1501004318641-b39e6451bec6?w=500&q=80',
  link: '/products?tags=offers',
  color: 'text-amber-600',
};

export function useSuggestionTiles(max: number): SuggestionTile[] {
  const { data: categories = [] } = useCategories();
  const categoryTiles: SuggestionTile[] = [
    ...categories,
    ...categories.flatMap((root) => sortByMenuOrder(root.children ?? [])),
  ]
    .filter((c) => c.image_url)
    .map((c) => ({
      title: c.name,
      subtitle: 'Shop Collection',
      image: c.image_url!,
      link: categoryLink(c),
      color: 'text-emerald-700',
    }));
  return [PRICE_DROP_TILE, ...categoryTiles].slice(0, max);
}
