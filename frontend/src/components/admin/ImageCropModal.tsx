import { useCallback, useMemo, useState } from 'react';
import Cropper from 'react-easy-crop';
import { X, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Area } from 'react-easy-crop';
import api from '@/lib/api';

type CropPreset = {
  label: string;
  aspect: number;
  width: number;
  height: number;
  hint: string;
};

const CROP_PRESETS: Record<string, CropPreset> = {
  hero: {
    label: '🏠 Home Hero (16:5)',
    aspect: 16 / 5,
    width: 1920,
    height: 650,
    hint: '1920×650px — Full-width hero banner for homepage',
  },
  page: {
    label: '📄 Shop Listing (14:3)',
    aspect: 14 / 3,
    width: 1400,
    height: 300,
    hint: '1400×300px — Category-wide listing page banner',
  },
  trending: {
    label: '🔥 Trending Square (1:1)',
    aspect: 1,
    width: 600,
    height: 600,
    hint: '600×600px — Square carousel banner',
  },
  highlight: {
    label: '⭐ Highlight Card (3:4)',
    aspect: 3 / 4,
    width: 400,
    height: 550,
    hint: '400×550px — Vertical highlight card',
  },
  themed: {
    label: '🎨 Seasonal (5:3)',
    aspect: 5 / 3,
    width: 800,
    height: 480,
    hint: '800×480px — Themed collection banner',
  },
  strip: {
    label: '🏷️ Promo Strip (10:1)',
    aspect: 10 / 1,
    width: 1200,
    height: 120,
    hint: '1200×120px — Thin promotional strip',
  },
  mobile_promo: {
    label: '📱 Mobile Drawer (1:1)',
    aspect: 1,
    width: 400,
    height: 400,
    hint: '400×400px — Mobile menu drawer promo card',
  },
  corporate_gifting: {
    label: '💼 Corporate (10:3)',
    aspect: 10 / 3,
    width: 1400,
    height: 420,
    hint: '1400×420px — Corporate gifting page banner',
  },
  happy_planters: {
    label: '🖼️ Gallery Portrait (4:5)',
    aspect: 4 / 5,
    width: 800,
    height: 1000,
    hint: '800×1000px — Customer/plant gallery photo',
  },
  product_detail: {
    label: '📦 Product Detail (4:1)',
    aspect: 4 / 1,
    width: 1400,
    height: 350,
    hint: '1400×350px — Product detail page banner',
  },
  product_spec: {
    label: '📋 Product Spec (1:1)',
    aspect: 1,
    width: 600,
    height: 600,
    hint: '600×600px — Product specification banner',
  },
  product_strip: {
    label: '🏷️ Product Strip (7:1)',
    aspect: 7 / 1,
    width: 1400,
    height: 200,
    hint: '1400×200px — Wide strip below Buy It Now button',
  },
  custom: {
    label: 'Custom Size',
    aspect: 1,
    width: 1000,
    height: 1000,
    hint: 'Define your own dimensions',
  },
};

interface ImageCropModalProps {
  isOpen: boolean;
  imageSrc: string;
  placement: string;
  useServerCrop: boolean;  // Explicit: is this image already on server?
  bannerId?: number;       // Only for server-side crop API call
  // Distinct callbacks for different crop paths - no ambiguity
  onCropComplete: (croppedFile: File, preview: string) => void;      // New banner: client-side crop
  onServerCropComplete: (newImageUrl: string) => void;                // Existing banner: server-side crop
  onClose: () => void;
}

/**
 * ImageCropModal provides an interactive crop interface for banner admins.
 * - Shows preset crop dimensions based on banner placement
 * - Allows custom width/height for flexibility
 * - Displays crop area dimensions in real-time
 * - Exports a cropped image File and data URL for preview
 */
export default function ImageCropModal({
  isOpen,
  imageSrc,
  placement,
  useServerCrop,
  bannerId,
  onCropComplete,
  onServerCropComplete,
  onClose,
}: ImageCropModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<string>(
    CROP_PRESETS[placement] ? placement : 'custom'
  );
  const [customWidth, setCustomWidth] = useState(1000);
  const [customHeight, setCustomHeight] = useState(1000);
  const [isProcessing, setIsProcessing] = useState(false);

  const preset = useMemo(() => {
    if (selectedPreset === 'custom') {
      return {
        ...CROP_PRESETS.custom,
        width: customWidth,
        height: customHeight,
        aspect: customWidth / customHeight,
      };
    }
    return CROP_PRESETS[selectedPreset] || CROP_PRESETS.custom;
  }, [selectedPreset, customWidth, customHeight]);

  const onCropAreaChange = useCallback(
    (croppedArea: Area, croppedAreaPixels: Area) => {
      setCroppedAreaPixels(croppedAreaPixels);
    },
    []
  );

  async function generateCroppedImage() {
    if (!croppedAreaPixels) return;

    setIsProcessing(true);
    try {
      if (useServerCrop) {
        // Server-side crop: imageSrc is already on server, bannerId must exist
        if (!bannerId) {
          throw new Error('Server-side crop requires banner ID');
        }
        
        const { data: updatedBanner } = await api.post(`/banners/admin/${bannerId}/crop`, {
          x: Math.round(croppedAreaPixels.x),
          y: Math.round(croppedAreaPixels.y),
          width: Math.round(croppedAreaPixels.width),
          height: Math.round(croppedAreaPixels.height),
        });

        onServerCropComplete(updatedBanner.image_url);  // Distinct callback for server-side crop
        toast.success('Image cropped successfully!');
        onClose();
      } else {
        // Client-side crop: imageSrc is local blob:/data: URL from file input
        const response = await fetch(imageSrc);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        
        const image = new window.Image();
        await new Promise((resolve, reject) => {
          image.onload = resolve;
          image.onerror = reject;
          image.src = blobUrl;
        });

        const canvas = document.createElement('canvas');
        canvas.width = croppedAreaPixels.width;
        canvas.height = croppedAreaPixels.height;

        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Failed to get canvas context');

        ctx.drawImage(
          image,
          croppedAreaPixels.x,
          croppedAreaPixels.y,
          croppedAreaPixels.width,
          croppedAreaPixels.height,
          0,
          0,
          croppedAreaPixels.width,
          croppedAreaPixels.height,
        );

        URL.revokeObjectURL(blobUrl);

        // Await toBlob properly
        const croppedBlob = await new Promise<Blob | null>((resolve) => {
          canvas.toBlob(resolve, 'image/png');
        });

        if (!croppedBlob) throw new Error('Canvas conversion failed');

        const file = new File([croppedBlob], `cropped-banner-${Date.now()}.png`, {
          type: 'image/png',
        });

        const preview = canvas.toDataURL('image/png');
        onCropComplete(file, preview);  // Distinct callback for client-side crop
        toast.success('Image cropped successfully!');
        onClose();
      }
    } catch (err) {
      console.error('Crop error:', err);
      toast.error(`Failed to crop image: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  }

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 z-50 transition-opacity"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl max-w-4xl w-full max-h-[95vh] sm:max-h-[90vh] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-3 sm:p-4 md:p-6 border-b bg-gradient-to-r from-primary/5 to-primary/2 shrink-0">
            <div>
              <h2 className="text-base sm:text-lg md:text-xl font-bold text-gray-900">
                Crop Banner Image
              </h2>
              <p className="text-[10px] sm:text-xs md:text-sm text-gray-500 mt-0.5">
                Adjust the crop area to fit your banner perfectly
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 sm:p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
            >
              <X size={18} className="sm:hidden" />
              <X size={20} className="hidden sm:block" />
            </button>
          </div>

          {/* Main Content */}
          <div className="flex-1 overflow-y-auto flex flex-col lg:flex-row gap-3 sm:gap-4 p-3 sm:p-4 md:p-6">
            {/* Crop Area */}
            <div className="flex-1 flex flex-col min-h-0">
              <div className="relative bg-gray-900 rounded-lg sm:rounded-xl overflow-hidden flex-1 mb-2 sm:mb-3 min-h-[250px] sm:min-h-[300px]">
                <Cropper
                  image={imageSrc}
                  crop={crop}
                  zoom={zoom}
                  aspect={preset.aspect}
                  onCropChange={setCrop}
                  onCropAreaChange={onCropAreaChange}
                  onZoomChange={setZoom}
                  cropShape="rect"
                  showGrid={true}
                />
              </div>

              {/* Zoom Slider */}
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="text-[10px] sm:text-xs font-semibold text-gray-600 whitespace-nowrap">
                  Zoom:
                </span>
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.1}
                  value={zoom}
                  onChange={(e) => setZoom(Number(e.target.value))}
                  className="flex-1 h-1.5 sm:h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary"
                />
                <span className="text-[10px] sm:text-xs font-semibold text-gray-600 w-8 sm:w-10 text-right">
                  {zoom.toFixed(1)}x
                </span>
              </div>
            </div>

            {/* Sidebar: Presets & Info */}
            <div className="w-full lg:w-64 flex flex-col gap-3 sm:gap-4 pb-3 sm:pb-4 lg:pb-0">
              {/* Size Info Card */}
              {croppedAreaPixels && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5 sm:p-3 space-y-1.5 sm:space-y-2">
                  <p className="text-[10px] sm:text-xs font-semibold text-blue-900">
                    Crop Dimensions
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-[10px] sm:text-xs text-blue-800">
                    <div>
                      <span className="text-[9px] sm:text-[10px] text-blue-600 font-semibold">
                        Width
                      </span>
                      <p className="font-bold">
                        {Math.round(croppedAreaPixels.width)}px
                      </p>
                    </div>
                    <div>
                      <span className="text-[9px] sm:text-[10px] text-blue-600 font-semibold">
                        Height
                      </span>
                      <p className="font-bold">
                        {Math.round(croppedAreaPixels.height)}px
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Preset Selector */}
              <div className="space-y-1.5 sm:space-y-2">
                <p className="text-[10px] sm:text-xs font-semibold text-gray-700">
                  Crop Presets
                </p>
                <div className="space-y-1 max-h-48 sm:max-h-64 overflow-y-auto scrollbar-thin">
                  {Object.entries(CROP_PRESETS).map(([key, p]) => (
                    <button
                      key={key}
                      onClick={() => {
                        setSelectedPreset(key);
                        if (key !== 'custom') {
                          setCustomWidth(p.width);
                          setCustomHeight(p.height);
                        }
                      }}
                      className={`w-full text-left px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg transition-all text-[10px] sm:text-xs font-medium border ${
                        selectedPreset === key
                          ? 'bg-primary text-white border-primary shadow-md'
                          : 'bg-white text-gray-700 border-gray-200 hover:border-primary/50 hover:bg-gray-50'
                      }`}
                    >
                      <div className="font-semibold">{p.label}</div>
                      <div
                        className={`text-[9px] sm:text-[10px] mt-0.5 ${
                          selectedPreset === key
                            ? 'text-primary-light/80'
                            : 'text-gray-500'
                        }`}
                      >
                        {p.width}×{p.height}px
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Dimensions */}
              {selectedPreset === 'custom' && (
                <div className="space-y-1.5 sm:space-y-2 pt-1.5 sm:pt-2 border-t">
                  <p className="text-[10px] sm:text-xs font-semibold text-gray-700">
                    Custom Dimensions
                  </p>
                  <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                    <div>
                      <label className="text-[9px] sm:text-[10px] font-semibold text-gray-600 block mb-1">
                        Width (px)
                      </label>
                      <input
                        type="number"
                        min={50}
                        max={4000}
                        value={customWidth}
                        onChange={(e) => setCustomWidth(Number(e.target.value))}
                        className="w-full px-2 py-1 sm:py-1.5 border rounded-lg text-[10px] sm:text-xs focus:outline-none focus:ring-1 focus:ring-primary/50"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] sm:text-[10px] font-semibold text-gray-600 block mb-1">
                        Height (px)
                      </label>
                      <input
                        type="number"
                        min={50}
                        max={4000}
                        value={customHeight}
                        onChange={(e) => setCustomHeight(Number(e.target.value))}
                        className="w-full px-2 py-1 sm:py-1.5 border rounded-lg text-[10px] sm:text-xs focus:outline-none focus:ring-1 focus:ring-primary/50"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Preset Info */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 sm:p-3 text-[10px] sm:text-xs text-amber-800 space-y-1">
                <div className="flex gap-1.5 sm:gap-2">
                  <Info size={12} className="shrink-0 mt-0.5 text-amber-600 sm:hidden" />
                  <Info size={14} className="shrink-0 mt-0.5 text-amber-600 hidden sm:block" />
                  <div>
                    <p className="font-semibold text-amber-900 mb-0.5 sm:mb-1">
                      {preset.label}
                    </p>
                    <p className="text-[9px] sm:text-[11px] text-amber-700">
                      {preset.hint}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex gap-2 sm:gap-3 p-3 sm:p-4 md:p-6 border-t bg-gray-50 shrink-0">
            <button
              onClick={onClose}
              className="flex-1 py-2 sm:py-2.5 px-3 sm:px-4 border border-gray-300 rounded-lg text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
            >
              Cancel
            </button>
            <button
              onClick={generateCroppedImage}
              disabled={isProcessing}
              className="flex-1 py-2 sm:py-2.5 px-3 sm:px-4 bg-primary text-white rounded-lg text-xs sm:text-sm font-semibold hover:bg-primary/95 disabled:opacity-60 disabled:cursor-not-allowed transition"
            >
              {isProcessing ? 'Processing...' : 'Apply Crop'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
