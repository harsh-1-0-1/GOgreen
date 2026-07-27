import { useState, useRef, useEffect } from 'react';
import { StoryViewer } from './StoryViewer';
import type { Story } from '@/types';

interface StoriesCarouselProps {
  stories: Story[];
}

export function StoriesCarousel({ stories }: StoriesCarouselProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  if (!stories || stories.length === 0) return null;

  return (
    <div className="mt-12 mb-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-serif text-green-900">Stories Across India.</h2>
      </div>
      
      <div className="flex gap-4 overflow-x-auto snap-x pb-4 scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0">
        {stories.map((story, i) => (
          <StoryCard 
            key={story.id} 
            story={story} 
            onClick={() => setActiveIndex(i)} 
          />
        ))}
      </div>

      {activeIndex !== null && (
        <StoryViewer
          stories={stories}
          startIndex={activeIndex}
          onClose={() => setActiveIndex(null)}
        />
      )}
    </div>
  );
}

function StoryCard({ story, onClick }: { story: Story; onClick: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            video.play().catch(() => {
              // Autoplay might be blocked by browser policy, ignore quietly
            });
          } else {
            video.pause();
          }
        });
      },
      { threshold: 0.5 } // Play when at least 50% visible
    );

    observer.observe(video);

    return () => {
      observer.unobserve(video);
      observer.disconnect();
    };
  }, []);

  return (
    <button
      className="relative shrink-0 w-44 h-72 rounded-2xl overflow-hidden snap-start group shadow-md"
      onClick={onClick}
    >
      <div className="absolute inset-0 bg-black/20 z-10 group-hover:bg-black/10 transition-colors" />
      <video
        ref={videoRef}
        src={story.video}
        poster={story.thumbnail || undefined}
        muted
        loop
        playsInline
        className="w-full h-full object-cover"
      />
      
      {/* Caption overlay if no product? Optional. We'll stick to the spec. */}
      {story.caption && !story.linked_product && (
        <div className="absolute bottom-4 left-3 right-3 z-20 text-white font-medium text-sm text-left drop-shadow-md">
          {story.caption}
        </div>
      )}

      {story.linked_product && (
        <div className="absolute bottom-3 left-3 right-3 bg-white/95 backdrop-blur-sm rounded-xl p-2 flex items-center gap-2 z-20 shadow-lg group-hover:-translate-y-1 transition-transform">
          {story.linked_product.thumbnail && (
            <img 
              src={story.linked_product.thumbnail} 
              className="w-9 h-9 rounded-lg object-cover bg-gray-100 shrink-0" 
              alt={story.linked_product.name}
            />
          )}
          <div className="flex-1 min-w-0 text-left">
            <div className="font-semibold text-gray-900 text-[11px] truncate">
              {story.linked_product.name}
            </div>
            <div className="font-bold text-green-800 text-[11px]">
              ₹{story.linked_product.price}
            </div>
          </div>
        </div>
      )}
    </button>
  );
}
