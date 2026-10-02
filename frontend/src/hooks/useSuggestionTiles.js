import { useCategories } from '@/hooks/useCategories';
import { categoryLink, sortByMenuOrder } from '@/components/layout/Navbar/navData';
export function useSuggestionTiles(max) {
    const { data: categories = [] } = useCategories();
    const categoryTiles = [
        ...categories,
        ...categories.flatMap((root) => sortByMenuOrder(root.children ?? [])),
    ]
        .filter((c) => c.image_url)
        .map((c) => ({
        title: c.name,
        subtitle: 'Shop Collection',
        image: c.image_url,
        link: categoryLink(c),
        color: 'text-emerald-700',
    }));
    return categoryTiles.slice(0, max);
}
