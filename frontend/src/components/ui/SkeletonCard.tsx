export default function SkeletonCard() {
  return (
    <div className="animate-pulse bg-white rounded-2xl overflow-hidden border border-gray-100">
      <div className="bg-gray-200 aspect-square" />
      <div className="p-4 space-y-3">
        <div className="h-4 bg-gray-200 rounded w-3/4" />
        <div className="h-3 bg-gray-200 rounded w-1/2" />
        <div className="h-5 bg-gray-200 rounded w-1/3" />
      </div>
    </div>
  );
}
