interface PlantCareCardProps {
  careCardImage?: string | null;
}

/**
 * Care card image rendered at a fixed 3:1 aspect ratio.
 * The crop preset in the admin (care_card, 900×300px) matches this ratio,
 * so the image always fills the box at the same proportions on every viewport.
 */
export default function PlantCareCard({ careCardImage }: PlantCareCardProps) {
  if (!careCardImage) return null;

  return (
    <div className="mt-4 sm:mt-6 w-full overflow-hidden rounded-xl bg-[#F2F3EA]">
      <img
        src={careCardImage}
        alt="Plant care guide"
        className="w-full h-auto block"
        style={{ aspectRatio: '3 / 1', objectFit: 'cover' }}
      />
    </div>
  );
}
