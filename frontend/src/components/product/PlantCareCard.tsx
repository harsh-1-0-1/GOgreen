interface PlantCareCardProps {
  careCardImage?: string | null;
}

export default function PlantCareCard({ careCardImage }: PlantCareCardProps) {
  if (!careCardImage) return null;

  return (
    <img
      src={careCardImage}
      alt="Plant care guide"
      className="w-full h-auto object-cover rounded-2xl"
    />
  );
}
