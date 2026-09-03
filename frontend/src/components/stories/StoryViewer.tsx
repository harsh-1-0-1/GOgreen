import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ShoppingBag, Info } from 'lucide-react';
import { useCartStore } from '@/store/cartStore';
import type { Story } from '@/types';
import toast from 'react-hot-toast';

interface StoryViewerProps {
  stories: Story[];
  startIndex: number;
  onClose: () => void;
}

export function StoryViewer({ stories, startIndex, onClose }: StoryViewerProps) {
  const [index, setIndex] = useState(startIndex);
  const [progress, setProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const addItem = useCartStore((s) => s.addItem);
  const { openDrawer } = useCartStore();
  const navigate = useNavigate();

  const story = stories[index];

  // Reset progress when story changes — guarded render-time adjustment instead of a
  // synchronous setState effect.
  const [lastIndex, setLastIndex] = useState(index);
  if (lastIndex !== index) {
    setLastIndex(index);
    setProgress(0);
  }

  const next = () => {
    if (index < stories.length - 1) {
      setIndex(index + 1);
    } else {
      onClose();
    }
  };

  const prev = () => {
    if (index > 0) {
      setIndex(index - 1);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const p = (videoRef.current.currentTime / videoRef.current.duration) * 100;
      setProgress(p);
    }
  };

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.stopPropagation(); // prevent tap to advance
    if (!story.linked_product_id) return;

    try {
      await addItem(story.linked_product_id, 1, undefined);
      toast.success('Added to cart');
      openDrawer();
      onClose();
    } catch {
      toast.error('Failed to add to cart');
    }
  };

  const handleMoreInfo = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!story.linked_product) return;
    
    onClose();
    navigate(`/products/${story.linked_product.slug}`);
  };

  return (
    <div className="fixed inset-0 bg-black/95 z-[100] flex items-center justify-center backdrop-blur-sm">
      {/* Progress Bars */}
      <div className="absolute top-4 left-4 right-4 flex gap-1.5 z-10">
        {stories.map((_, i) => (
          <div key={i} className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
            <div
              className="h-full bg-white transition-all duration-100 ease-linear"
              style={{ width: i < index ? '100%' : i === index ? `${progress}%` : '0%' }}
            />
          </div>
        ))}
      </div>

      {/* Close button */}
      <button 
        onClick={onClose}
        className="absolute top-8 right-4 z-20 text-white/80 hover:text-white p-2"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Tap Zones */}
      <div className="absolute inset-y-0 left-0 w-1/3 z-10" onClick={prev} />
      <div className="absolute inset-y-0 right-0 w-1/3 z-10" onClick={next} />

      {/* Video Container */}
      <div className="relative w-full max-w-sm h-full max-h-[85vh] md:max-h-[80vh] flex items-center justify-center">
        <video
          ref={videoRef}
          key={story.id}
          src={story.video}
          poster={story.thumbnail || undefined}
          autoPlay
          playsInline
          onTimeUpdate={handleTimeUpdate}
          onEnded={next}
          className="w-full h-full object-cover rounded-xl"
        />

        {/* Product Overlay */}
        {story.linked_product && (
          <div 
            className="absolute bottom-6 left-4 right-4 bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-2xl z-20"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-3">
              {story.linked_product.thumbnail && (
                <img 
                  src={story.linked_product.thumbnail} 
                  className="w-16 h-16 rounded-xl object-cover shrink-0 bg-gray-100" 
                  alt={story.linked_product.name}
                />
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 truncate text-sm">
                  {story.linked_product.name}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-bold text-green-800 text-base">₹{story.linked_product.price}</span>
                  {story.linked_product.original_price && (
                    <span className="text-xs text-gray-400 line-through">
                      ₹{story.linked_product.original_price}
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex gap-2">
              <button 
                onClick={handleMoreInfo}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2.5 rounded-xl transition-colors font-semibold text-sm flex items-center justify-center gap-2"
              >
                <Info className="w-4 h-4" />
                More Info
              </button>
              <button 
                onClick={handleAddToCart}
                className="flex-1 bg-green-800 hover:bg-green-700 text-white px-4 py-2.5 rounded-xl transition-colors font-semibold text-sm flex items-center justify-center gap-2"
              >
                <ShoppingBag className="w-4 h-4" />
                Add to Cart
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
