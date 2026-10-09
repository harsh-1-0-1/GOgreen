interface PlantCareCardProps {
  careCardImage?: string | null;
}

/**
 * Care card image rendered at a fixed 2:1 aspect ratio.
 * The crop preset in the admin (care_card, 600×300px) matches this ratio,
 * so the image always fills the box without letter-boxing or distortion.
 */
export default function PlantCareCard({ careCardImage }: PlantCareCardProps) {
  if (!careCardImage) return null;

  return (
    <div className="mt-4 sm:mt-6 w-full rounded-2xl overflow-hidden" style={{ aspectRatio: '2 / 1' }}>
      <img
        src={careCardImage}
        alt="Plant care guide"
        className="w-full h-full object-cover"
      />
    </div>
  );
}
