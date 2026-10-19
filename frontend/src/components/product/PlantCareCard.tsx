import { fallbackOnError, srcSetFromMap } from '@/lib/imageVariants';

interface PlantCareCardProps {
  careCardImage?: string | null;
  /** Generated WebP variants of `careCardImage`. */
  imageUrls?: Record<string, string>;
}

/**
 * Care card image rendered at a fixed 3:1 aspect ratio.
 * The crop preset in the admin (care_card, 900×300px) matches this ratio,
 * so the image always fills the box at the same proportions on every viewport.
 */
export default function PlantCareCard({ careCardImage, imageUrls }: PlantCareCardProps) {
  if (!careCardImage) return null;

  return (
    <div className="mt-4 sm:mt-6 w-full overflow-hidden rounded-xl bg-[#F2F3EA]">
      <img
        src={careCardImage}
        srcSet={srcSetFromMap(imageUrls)}
        sizes="(min-width: 1024px) 50vw, 100vw"
        loading="lazy"
        decoding="async"
        onError={fallbackOnError(careCardImage)}
        alt="Plant care guide"
        className="w-full h-auto block"
        style={{ aspectRatio: '3 / 1', objectFit: 'cover' }}
      />
    </div>
  );
}
