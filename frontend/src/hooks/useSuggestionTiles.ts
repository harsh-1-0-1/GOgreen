import { useCategories } from '@/hooks/useCategories';
import { categoryLink, sortByMenuOrder } from '@/components/layout/Navbar/navData';
import { srcSetFromMap } from '@/lib/imageVariants';

export interface SuggestionTile {
  title: string;
  subtitle: string;
  image: string;
  /** WebP srcset for `image` when generated variants exist. */
  srcSet?: string;
  link: string;
  color: string;
}

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
      srcSet: srcSetFromMap(c.image_urls),
      link: categoryLink(c),
      color: 'text-emerald-700',
    }));
  return categoryTiles.slice(0, max);
}
