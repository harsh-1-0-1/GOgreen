import { useCallback, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Image as ImageIcon, Plus, X, Info, Layout, CheckCircle, Crop } from 'lucide-react';
import toast from 'react-hot-toast';

import api from '@/lib/api';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { useCategories } from '@/hooks/useCategories';
import { getApiErrorDetail } from '@/lib/apiError';
import ImageCropModal from '@/components/admin/ImageCropModal';
import type { Banner, Category } from '@/types';

const PLACEMENTS = [
  {
    key: 'hero',
    label: '🏠 Home Page Hero Banner',
    description: 'This banner appears at the very top of the homepage. It is the first thing customers see.',
    helpText: 'Use high-quality widescreen landscape images. Recommended size: 1920x650px.',
  },
  {
    key: 'announcement',
    label: '📢 Top Announcement Bar',
    description: 'A thin colored bar displayed at the very top of all pages. Great for quick updates.',
    helpText: 'Keep announcement text short and catchy. Recommended: under 80 characters.',
  },
  {
    key: 'page',
    label: '📄 Shop Listing Page Banner',
    description: 'A wide horizontal strip banner displayed below the header on product listing pages.',
    helpText: 'Best for category-wide discounts. Recommended size: 1400x300px.',
  },
  {
    key: 'trending',
    label: '🔥 Trending Carousel Banner',
    description: 'Square promotional banners displayed within the "Trending Now" homepage slider.',
    helpText: 'Required size: 600x600px (1:1 square format). Use the crop tool to ensure proper dimensions. Use vibrant colors.',
  },
  {
    key: 'themed',
    label: '🎨 Seasonal Offer Banner',
    description: 'Large grids and themed sections on the homepage, e.g., "Monsoon Collection".',
    helpText: 'Recommended size: 800x480px. Used to group curated collections.',
  },
  {
    key: 'strip',
    label: '🏷️ Promotional Strip Tile',
    description: 'A thin horizontal banner strip embedded between sections on the homepage.',
    helpText: 'Recommended size: 1200x120px. Ideal for coupon announcements.',
  },
  {
    key: 'highlight',
    label: '⭐ Best Seller Highlight Card',
    description: 'Vertical card in a 4-column grid. Highlights custom sets like "Combos" or "Starter Kits".',
    helpText: 'Recommended size: 400x550px. The title becomes the bold text overlay.',
  },
  {
    key: 'mobile_promo',
    label: '📱 Mobile Drawer Promo',
    description: 'Compact promotional card shown at the top of the mobile menu drawer.',
    helpText: 'Recommended size: 400x400px. The first active banner is used for the drawer promo card.',
  },
  {
    key: 'corporate_gifting',
    label: '💼 Corporate Gifting Banner',
    description: 'Promotional banner displayed on the corporate gifting page.',
    helpText: 'Recommended size: 1400x420px. Highlight bulk packages, gifting programs, or seasonal offers.',
  },
  {
    key: 'happy_planters',
    label: 'Happy Planters Gallery',
    description: 'Scrollable customer and plant photos shown on every product detail page.',
    helpText: 'Upload portrait photos. Recommended size: 800x1000px (4:5). Drag images to change their display order.',
  },
  {
    key: 'product_detail',
    label: '📦 Product Detail Page Banner',
    description: 'A wide promotional banner displayed on product detail pages, just above the FAQ section.',
    helpText: 'Recommended aspect ratio 4:1 (e.g. 1400×350px). Banner renders at the uploaded image size. Choose a product type for type-specific banners, or fallback for all products.',
  },
  {
    key: 'product_spec',
    label: '📋 Product Spec Banner',
    description: 'A wide promotional banner displayed on the product detail page, just above the Product Specification section.',
    helpText: 'Recommended aspect ratio 1:1 (square, e.g. 600×600px). Banner renders at the uploaded image size. Choose a product type for type-specific spec banners, or fallback for all products.',
  },
] as const;

const bannerSchema = z
  .object({
    title: z.string().min(1, 'Title is required').max(100),
    subtitle: z.string().max(255).optional().or(z.literal('')),
    cta_text: z.string().max(50).optional().or(z.literal('')),
    cta_link: z.string().max(255).optional().or(z.literal('')),
    badge_text: z.string().max(100).optional().or(z.literal('')),
    placement: z.enum(['hero', 'announcement', 'page', 'trending', 'themed', 'strip', 'highlight', 'mobile_promo', 'corporate_gifting', 'happy_planters', 'product_detail', 'product_spec']),
    target_path: z.string().max(255).optional().or(z.literal('')),
    bg_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color (e.g. #FFFFFF)'),
    text_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color (e.g. #000000)'),
    is_active: z.boolean(),
    valid_from: z.string().optional().or(z.literal('')),
    valid_until: z.string().optional().or(z.literal('')),
  })
  .refine(
    (d) => {
      if (d.valid_from && d.valid_until)
        return new Date(d.valid_until) > new Date(d.valid_from);
      return true;
    },
    { message: 'End date/time must be after start date/time', path: ['valid_until'] },
  );

type BannerFormData = z.infer<typeof bannerSchema>;

function topLevelCategories(categories: Category[] | undefined): Category[] {
  return categories?.filter((category) => category.is_active) ?? [];
}

const EMPTY_BANNERS: Banner[] = [];

const inputClass =
  'w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors';

// ── Sortable row ───────────────────────────────────────────────────────────

function SortableBannerRow({
  banner,
  onEdit,
  onToggle,
  onDelete,
  deleteConfirmId,
  setDeleteConfirmId,
}: {
  banner: Banner;
  onEdit: (b: Banner) => void;
  onToggle: (id: number) => void;
  onDelete: (id: number) => void;
  deleteConfirmId: number | null;
  setDeleteConfirmId: (id: number | null) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: banner.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 px-3 sm:px-4 py-3.5 bg-white border-b last:border-0 hover:bg-gray-50/50"
    >
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing touch-target text-gray-400 hover:text-gray-600 shrink-0"
        aria-label="Drag to reorder"
      >
        <GripVertical size={18} />
      </button>

      {banner.image_url ? (
        <img
          src={banner.image_url}
          alt=""
          className="w-16 h-10 object-cover rounded-lg shrink-0 bg-gray-50 border border-gray-100"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      ) : (
        <div className="w-16 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 border border-gray-100">
          <ImageIcon size={16} className="text-gray-300" />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-800 truncate">{banner.title}</p>
        <p className="text-xs text-gray-400 truncate">
          {(banner.placement === 'page' || banner.placement === 'product_detail' || banner.placement === 'product_spec') && banner.target_path
            ? `${banner.placement === 'product_detail' || banner.placement === 'product_spec' ? 'Type' : 'Target'}: ${banner.target_path}`
            : banner.subtitle || banner.cta_link || '—'}
        </p>
      </div>

      <span
        className={`hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
          banner.is_active
            ? 'bg-green-50 text-green-700'
            : 'bg-gray-100 text-gray-500'
        }`}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full ${banner.is_active ? 'bg-green-500' : 'bg-gray-400'}`}
        />
        {banner.is_active ? 'Active' : 'Paused'}
      </span>

      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => onEdit(banner)}
          className="px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary-light/10 rounded-lg transition"
        >
          Edit
        </button>
        <button
          onClick={() => onToggle(banner.id)}
          className="px-2.5 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100 rounded-lg transition hidden sm:inline-flex"
        >
          {banner.is_active ? 'Pause' : 'Activate'}
        </button>
        {deleteConfirmId === banner.id ? (
          <span className="flex items-center gap-1 text-xs">
            <span className="text-gray-500">Sure?</span>
            <button
              onClick={() => onDelete(banner.id)}
              className="text-red-600 font-medium hover:underline px-1"
            >
              Delete
            </button>
            <button
              onClick={() => setDeleteConfirmId(null)}
              className="text-gray-500 hover:underline px-1"
            >
              No
            </button>
          </span>
        ) : (
          <button
            onClick={() => setDeleteConfirmId(banner.id)}
            className="px-2.5 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 rounded-lg transition"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

// ── Live Preview Mockups ───────────────────────────────────────────────────

function BannerPreview({
  title,
  subtitle,
  bgColor,
  textColor,
  ctaText,
  imageSrc,
}: {
  title: string;
  subtitle: string;
  bgColor: string;
  textColor: string;
  ctaText: string;
  imageSrc: string | null;
}) {
  return (
    <div className="mt-4 p-4 border rounded-xl bg-gray-50">
      <p className="text-[11px] font-semibold text-gray-400 mb-2 uppercase tracking-wider">Live Mockup Preview</p>
      <div
        className="w-full overflow-hidden rounded-lg border border-gray-200 bg-[#F5F0E8]"
        style={{ height: 200 }}
      >
        <div
          style={{
            transform: 'scale(0.35)',
            transformOrigin: 'top left',
            width: `${100 / 0.35}%`,
            height: `${200 / 0.35}px`,
            background: bgColor || '#F5F0E8',
            display: 'flex',
            alignItems: 'center',
            padding: 48,
            position: 'relative',
          }}
        >
          <div style={{ flex: 1, paddingRight: 24 }}>
            <h2
              style={{
                fontSize: 52,
                color: textColor || '#1B4332',
                fontWeight: 700,
                marginBottom: 16,
                lineHeight: 1.1,
              }}
            >
              {title || 'Seasonal Specials'}
            </h2>
            {subtitle && (
              <p
                style={{
                  fontSize: 22,
                  color: textColor || '#1B4332',
                  opacity: 0.8,
                  marginBottom: 24,
                }}
              >
                {subtitle}
              </p>
            )}
            {ctaText && (
              <div
                style={{
                  background: textColor || '#1B4332',
                  color: bgColor || '#FFFFFF',
                  padding: '14px 28px',
                  borderRadius: 8,
                  display: 'inline-block',
                  fontSize: 20,
                  fontWeight: 600,
                }}
              >
                {ctaText}
              </div>
            )}
          </div>
          {imageSrc && (
            <img
              src={imageSrc}
              alt=""
              style={{
                height: '100%',
                objectFit: 'cover',
                marginLeft: 'auto',
                maxWidth: '50%',
                borderRadius: 12
              }}
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function HighlightCardPreview({
  title,
  subtitle,
  bgColor,
  textColor,
  imageSrc,
}: {
  title: string;
  subtitle: string;
  bgColor: string;
  textColor: string;
  imageSrc: string | null;
}) {
  return (
    <div className="mt-4 p-4 border rounded-xl bg-gray-50 flex flex-col items-center">
      <p className="text-[11px] font-semibold text-gray-400 mb-2 uppercase tracking-wider">Highlight Card Preview</p>
      <div className="w-full max-w-[180px]">
        <div
          className="relative aspect-[3/4] overflow-hidden rounded-xl border border-gray-200 shadow-sm"
          style={{ backgroundColor: bgColor || '#F5F0E8' }}
        >
          {imageSrc ? (
            <img
              src={imageSrc}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : null}
          <h3 className="absolute inset-x-2 bottom-4 text-center text-sm font-semibold leading-tight text-white drop-shadow-sm">
            {title || 'Combos'}
          </h3>
        </div>
        <p
          className="mt-2 text-center text-xs font-bold leading-tight"
          style={{ color: textColor || '#16A34A' }}
        >
          {subtitle || 'Get 4 at ₹699'}
        </p>
      </div>
    </div>
  );
}

function TrendingBannerPreview({
  title,
  subtitle,
  bgColor,
  textColor,
  ctaText,
  imageSrc,
}: {
  title: string;
  subtitle: string;
  bgColor: string;
  textColor: string;
  ctaText: string;
  imageSrc: string | null;
}) {
  return (
    <div className="mt-4 p-4 border rounded-xl bg-gray-50">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Carousel Banner Preview</p>
        <div className="text-[10px] text-gray-500 bg-white px-2 py-1 rounded border">
          Fixed Size: 600×600px (1:1)
        </div>
      </div>
      <div className="flex justify-center">
        <div
          className="relative w-60 h-60 overflow-hidden rounded-xl border-2 border-gray-300 shadow-lg"
          style={{ backgroundColor: bgColor || '#e9dfc9' }}
        >
          {imageSrc ? (
            <img
              src={imageSrc}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-xs">
              No image uploaded
            </div>
          )}
          <h3
            className="absolute left-3 top-3 max-w-[80%] text-xs font-bold leading-tight text-white drop-shadow"
            style={{ color: textColor || '#FFFFFF' }}
          >
            {title || 'Perfect Indoor Plants'}
          </h3>
          {subtitle && (
            <div className="absolute right-3 top-3 bg-yellow-400 text-primary text-[9px] font-bold px-1.5 py-0.5 rounded shadow">
              {subtitle}
            </div>
          )}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded bg-[#ffeb3b] px-3 py-1 text-[9px] font-bold text-primary shadow">
            {ctaText || 'SHOP NOW'}
          </div>
        </div>
      </div>
      <div className="mt-3 text-center">
        <p className="text-[10px] text-amber-600 bg-amber-50 inline-block px-3 py-1.5 rounded-lg border border-amber-200">
          ⚠️ Images must be square (1:1 ratio). Use the crop tool to adjust your image to 600×600px.
        </p>
      </div>
    </div>
  );
}

// ── Edit/Add Drawer ────────────────────────────────────────────────────────

function BannerDrawer({
  banner,
  placement,
  onClose,
  onSaved,
}: {
  banner: Banner | null;
  placement: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!banner;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<BannerFormData>({
    resolver: zodResolver(bannerSchema),
    defaultValues: {
      title: banner?.title || '',
      subtitle: banner?.subtitle || '',
      cta_text: banner?.cta_text || '',
      cta_link: banner?.cta_link || '',
      badge_text: banner?.badge_text || '',
      placement: (banner?.placement || placement) as BannerFormData['placement'],
      target_path: banner?.target_path || '',
      bg_color: banner?.bg_color || '#F5F0E8',
      text_color: banner?.text_color || '#1B4332',
      is_active: banner?.is_active ?? true,
      valid_from: banner?.valid_from
        ? banner.valid_from.slice(0, 16)
        : '',
      valid_until: banner?.valid_until
        ? banner.valid_until.slice(0, 16)
        : '',
    },
  });

  useBodyScrollLock(true);
  const { data: categories } = useCategories();
  const productTypeOptions = topLevelCategories(categories);

  const [submitting, setSubmitting] = useState(false);
  const [imageMode, setImageMode] = useState<'upload' | 'url'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [manualUrl, setManualUrl] = useState('');
  const [urlValid, setUrlValid] = useState<boolean | null>(null);
  const [imageCleared, setImageCleared] = useState(false);
  const [fileError, setFileError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);

  // react-hook-form's `watch()` is a React-Compiler-incompatible library (cannot be
  // memoized safely); the live banner preview needs its reactive values, so the
  // compiler is intentionally allowed to skip memoizing this drawer.
  // eslint-disable-next-line react-hooks/incompatible-library
  const watchedTitle = watch('title');
  const watchedSubtitle = watch('subtitle');
  const watchedBgColor = watch('bg_color');
  const watchedTextColor = watch('text_color');
  const watchedCtaText = watch('cta_text');
  const watchedPlacement = watch('placement');

  const activePlacementDetails = useMemo(() => {
    return PLACEMENTS.find((p) => p.key === watchedPlacement) || PLACEMENTS[0];
  }, [watchedPlacement]);

  const previewImageSrc = useMemo(() => {
    if (filePreview) return filePreview;
    if (manualUrl) return manualUrl;
    if (!imageCleared && banner?.image_url) return banner.image_url;
    return null;
  }, [filePreview, manualUrl, imageCleared, banner?.image_url]);

  function handleFileSelect(file: File) {
    setFileError('');
    if (file.size > 5 * 1024 * 1024) {
      setFileError('File exceeds 5 MB limit');
      return;
    }
    if (
      !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
    ) {
      setFileError('Only JPG, PNG, or WebP files accepted');
      return;
    }
    // Open crop modal instead of directly setting preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setCropImageSrc(e.target?.result as string);
      setCropModalOpen(true);
    };
    reader.readAsDataURL(file);
  }

  function handleCropComplete(croppedFile: File, preview: string) {
    setSelectedFile(croppedFile);
    setFilePreview(preview);
    setImageCleared(false);
  }

  function handleUrlBlur() {
    if (!manualUrl) {
      setUrlValid(null);
      return;
    }
    const img = new window.Image();
    img.onload = () => setUrlValid(true);
    img.onerror = () => setUrlValid(false);
    img.src = manualUrl;
  }

  async function onSubmit(data: BannerFormData) {
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('title', data.title);
      fd.append('subtitle', data.subtitle || '');
      fd.append('cta_text', data.cta_text || '');
      fd.append('cta_link', data.cta_link || '');
      fd.append('badge_text', data.badge_text || '');
      fd.append('placement', data.placement);
      fd.append('target_path', data.target_path || '');
      fd.append('bg_color', data.bg_color);
      fd.append('text_color', data.text_color);
      fd.append('is_active', String(data.is_active));
      fd.append('position', String(banner?.position ?? 0));
      if (data.valid_from) fd.append('valid_from', data.valid_from);
      if (data.valid_until) fd.append('valid_until', data.valid_until);

      if (selectedFile) {
        fd.append('image', selectedFile);
      } else if (imageMode === 'url' && manualUrl) {
        fd.append('image_url_manual', manualUrl);
      } else if (imageCleared) {
        fd.append('image_url_manual', '');
      }

      if (isEdit) {
        await api.put(`/banners/admin/${banner!.id}`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } else {
        await api.post('/banners/admin', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      toast.success('Banner saved successfully!');
      onSaved();
      onClose();
    } catch (err) {
      toast.error(
        getApiErrorDetail(err, 'Failed to save banner'),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/40 z-40 transition-opacity"
        onClick={onClose}
      />
      <div className="fixed right-0 top-0 h-full w-full sm:w-[480px] bg-[#FAFAF8] z-50 shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-4 sm:p-5 border-b bg-white shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              {isEdit ? 'Edit Banner Settings' : 'Create New Banner'}
            </h2>
            <p className="text-xs text-gray-500">Configure visual advertisements for customers</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4"
        >
          {/* Active Placement Help Card */}
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 flex gap-2 text-xs text-emerald-800 leading-relaxed">
            <Info size={16} className="shrink-0 text-primary-light mt-0.5" />
            <div>
              <p className="font-bold text-primary">{activePlacementDetails.label}</p>
              <p className="mt-0.5">{activePlacementDetails.description}</p>
              <p className="font-semibold text-emerald-900 mt-1.5">{activePlacementDetails.helpText}</p>
            </div>
          </div>

          {watchedPlacement === 'page' && (
            <div>
              <label className="text-xs font-semibold text-gray-700 mb-1 block">
                Category Slug <span className="font-normal text-gray-400">(Target Path)</span>
              </label>
              <input
                {...register('target_path')}
                className={inputClass}
                placeholder="e.g. plants, xl-plants, herb-seeds — leave blank for global fallback"
              />
              <p className="text-[10px] text-gray-400 mt-0.5">
                Enter just the category slug (e.g. <strong>xl-plants</strong>). Leave blank to show this banner on all category pages as a fallback.
              </p>
              {errors.target_path && (
                <p className="text-xs text-red-500 mt-1">
                  {errors.target_path.message}
                </p>
              )}
            </div>
          )}

          {(watchedPlacement === 'product_detail' || watchedPlacement === 'product_spec') && (
            <div>
              <label className="text-xs font-semibold text-gray-700 mb-1 block">
                Product Type
              </label>
              {productTypeOptions.length > 0 ? (
                <select {...register('target_path')} className={inputClass}>
                  <option value="">Fallback for all product types</option>
                  <option value="*">Fallback (*)</option>
                  {productTypeOptions.map((category) => (
                    <option key={category.id} value={category.slug}>
                      {category.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  {...register('target_path')}
                  className={inputClass}
                  placeholder="e.g. plants, pots, seeds, or * for fallback"
                />
              )}
              <p className="text-[10px] text-gray-400 mt-0.5">
                The banner appears on products under this main category. Leave blank or use * as the fallback banner.
              </p>
              {errors.target_path && (
                <p className="text-xs text-red-500 mt-1">
                  {errors.target_path.message}
                </p>
              )}
            </div>
          )}

          <div>
            <label className="text-xs font-semibold text-gray-700 mb-1 block">
              Banner Heading / Title *
            </label>
            <input
              {...register('title')}
              className={inputClass}
              placeholder="e.g. Monsoon Plant Sale"
            />
            <p className="text-[10px] text-gray-400 mt-0.5">The main text displaying bold over the banner.</p>
            {errors.title && (
              <p className="text-xs text-red-500 mt-1">
                {errors.title.message}
              </p>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-700 mb-1 block">
              Sub-heading / Description
            </label>
            <input
              {...register('subtitle')}
              className={inputClass}
              placeholder="e.g. Up to 40% off on all indoor ferns and air-purifiers."
            />
            <p className="text-[10px] text-gray-400 mt-0.5">Subtext displayed under the main heading.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-700 mb-1 block">
                Button Label (Text)
              </label>
              <input
                {...register('cta_text')}
                placeholder="e.g. Shop Sale"
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700 mb-1 block">
                Link Address (URL)
              </label>
              <input
                {...register('cta_link')}
                placeholder="e.g. /products?category=ferns"
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-700 mb-1 block">
              Top Offer Badge Text
            </label>
            <input
              {...register('badge_text')}
              placeholder="e.g. LIMITED PERIOD ONLY or 20% OFF"
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-700 mb-1 block">
                Theme Background Color
              </label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={watchedBgColor}
                  onChange={(e) =>
                    setValue('bg_color', e.target.value)
                  }
                  className="w-9 h-9 rounded-lg border cursor-pointer shrink-0"
                />
                <input
                  {...register('bg_color')}
                  className={inputClass}
                />
              </div>
              {errors.bg_color && (
                <p className="text-xs text-red-500 mt-1">
                  {errors.bg_color.message}
                </p>
              )}
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700 mb-1 block">
                Banner Text Color
              </label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={watchedTextColor}
                  onChange={(e) =>
                    setValue('text_color', e.target.value)
                  }
                  className="w-9 h-9 rounded-lg border cursor-pointer shrink-0"
                />
                <input
                  {...register('text_color')}
                  className={inputClass}
                />
              </div>
              {errors.text_color && (
                <p className="text-xs text-red-500 mt-1">
                  {errors.text_color.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-700 mb-1 block">
                Start Schedule (Show From)
              </label>
              <input
                type="datetime-local"
                {...register('valid_from')}
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700 mb-1 block">
                End Schedule (Show Until)
              </label>
              <input
                type="datetime-local"
                {...register('valid_until')}
                className={inputClass}
                {...register('valid_until')}
              />
              {errors.valid_until && (
                <p className="text-xs text-red-500 mt-1">
                  {errors.valid_until.message}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 bg-white p-3 rounded-lg border">
            <div>
              <label className="text-xs font-semibold text-gray-700 block">
                Publish Status
              </label>
              <span className="text-[10px] text-gray-400">Make it visible immediately on the website</span>
            </div>
            <button
              type="button"
              onClick={() => setValue('is_active', !getValues('is_active'))}
              className={`relative w-11 h-6 rounded-full transition-colors ml-auto ${
                watch('is_active') ? 'bg-primary' : 'bg-gray-300'
              }`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  watch('is_active')
                    ? 'translate-x-[22px]'
                    : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          {/* Image Upload section — hidden for announcement */}
          {watchedPlacement !== 'announcement' && (
            <div className="space-y-3 pt-2 border-t">
              <label className="text-xs font-semibold text-gray-700 block">
                Banner Graphic / Image
              </label>

              {/* Special notice for trending banners */}
              {watchedPlacement === 'trending' && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800 space-y-1">
                  <div className="flex items-start gap-2">
                    <Info size={14} className="shrink-0 mt-0.5 text-blue-600" />
                    <div>
                      <p className="font-semibold text-blue-900 mb-1">
                        Trending banners require square images (1:1 ratio)
                      </p>
                      <p className="text-[11px] text-blue-700">
                        Upload any image, then use the <strong>Crop</strong> button to adjust it to 600×600px. The preview below shows exactly how it will appear.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {isEdit && banner?.image_url && !imageCleared && (
                <div className="relative rounded-lg overflow-hidden border">
                  <img
                    src={banner.image_url}
                    alt="Current banner"
                    className="w-full h-32 object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setImageCleared(true);
                        setSelectedFile(null);
                        setFilePreview(null);
                      }}
                      className="px-3 py-1.5 bg-red-600 text-white rounded text-xs font-semibold hover:bg-red-700 transition"
                    >
                      Replace Image
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (banner?.image_url) {
                          setCropImageSrc(banner.image_url);
                          setCropModalOpen(true);
                        }
                      }}
                      className="px-3 py-1.5 bg-primary text-white rounded text-xs font-semibold hover:bg-primary/95 transition flex items-center gap-1"
                    >
                      <Crop size={14} /> Crop
                    </button>
                  </div>
                </div>
              )}

              {(!isEdit || imageCleared || !banner?.image_url) && (
                <>
                  <div className="flex gap-4 text-xs font-semibold text-gray-600">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="imageMode"
                        checked={imageMode === 'upload'}
                        onChange={() => setImageMode('upload')}
                      />
                      Upload File
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="imageMode"
                        checked={imageMode === 'url'}
                        onChange={() => setImageMode('url')}
                      />
                      Use Web URL
                    </label>
                  </div>

                  {imageMode === 'upload' ? (
                    <div>
                      <div
                        onClick={() => fileInputRef.current?.click()}
                        className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                      >
                        {filePreview ? (
                          <div className="flex flex-col items-center gap-3">
                            <img
                              src={filePreview}
                              alt="Preview"
                              className="max-h-32 mx-auto object-contain rounded"
                            />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCropImageSrc(filePreview);
                                setCropModalOpen(true);
                              }}
                              className={`text-xs font-semibold flex items-center gap-1 ${
                                watchedPlacement === 'trending'
                                  ? 'px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition'
                                  : 'text-primary hover:text-primary/80'
                              }`}
                            >
                              <Crop size={14} /> {watchedPlacement === 'trending' ? 'Crop to 600×600px (Required)' : 'Edit Crop'}
                            </button>
                          </div>
                        ) : (
                          <div className="text-gray-400">
                            <ImageIcon
                              size={28}
                              className="mx-auto mb-2"
                            />
                            <p className="text-xs font-semibold text-gray-700">
                              Upload Banner Image
                            </p>
                            <p className="text-[10px] text-gray-400 mt-0.5">
                              {watchedPlacement === 'trending' 
                                ? 'After upload, you\'ll crop to 600×600px'
                                : 'Drag file or click to select'}
                            </p>
                          </div>
                        )}
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileSelect(file);
                        }}
                      />
                      {fileError && (
                        <p className="text-xs text-red-500 mt-1">
                          {fileError}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div>
                      <input
                        type="url"
                        value={manualUrl}
                        onChange={(e) => {
                          setManualUrl(e.target.value);
                          setUrlValid(null);
                        }}
                        onBlur={handleUrlBlur}
                        placeholder="e.g. https://images.unsplash.com/..."
                        className={inputClass}
                      />
                      {urlValid === true && (
                        <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                          <CheckCircle size={12} /> Image URL loaded successfully
                        </p>
                      )}
                      {urlValid === false && (
                        <p className="text-xs text-red-500 mt-1">
                          Could not verify image. Double check the address.
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Live mockups based on placement */}
          {watchedPlacement === 'hero' && (
            <BannerPreview
              title={watchedTitle || ''}
              subtitle={watchedSubtitle || ''}
              bgColor={watchedBgColor}
              textColor={watchedTextColor}
              ctaText={watchedCtaText || ''}
              imageSrc={previewImageSrc}
            />
          )}

          {watchedPlacement === 'trending' && (
            <TrendingBannerPreview
              title={watchedTitle || ''}
              subtitle={watchedSubtitle || ''}
              bgColor={watchedBgColor}
              textColor={watchedTextColor}
              ctaText={watchedCtaText || ''}
              imageSrc={previewImageSrc}
            />
          )}

          {watchedPlacement === 'highlight' && (
            <HighlightCardPreview
              title={watchedTitle || ''}
              subtitle={watchedSubtitle || ''}
              bgColor={watchedBgColor}
              textColor={watchedTextColor}
              imageSrc={previewImageSrc}
            />
          )}

          {watchedPlacement === 'page' && (
            <div className="mt-4 p-4 border rounded-xl bg-gray-50">
              <p className="text-[11px] font-semibold text-gray-400 mb-2 uppercase tracking-wider">Page Banner Strip</p>
              <div
                className="h-[60px] w-full overflow-hidden rounded-lg border border-gray-200"
                style={{ backgroundColor: watchedBgColor }}
              >
                {previewImageSrc ? (
                  <img
                    src={previewImageSrc}
                    alt=""
                    className="h-full w-full object-cover object-center"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="flex h-full items-center justify-center px-4 text-center">
                    <span
                      className="text-xs font-bold"
                      style={{ color: watchedTextColor }}
                    >
                      {watchedTitle || 'Shop Wide Offer'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t bg-white">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/95 disabled:opacity-60 transition"
            >
              {submitting ? 'Saving...' : 'Save Banner'}
            </button>
          </div>
        </form>
      </div>

      <ImageCropModal
        isOpen={cropModalOpen}
        imageSrc={cropImageSrc || ''}
        placement={watchedPlacement}
        onCropComplete={handleCropComplete}
        onClose={() => {
          setCropModalOpen(false);
          setCropImageSrc(null);
        }}
      />
    </>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function BannersAdminPage() {
  const queryClient = useQueryClient();
  const [activePlacement, setActivePlacement] = useState('hero');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(
    null,
  );
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(
    null,
  );

  const {
    data: banners = EMPTY_BANNERS,
    isLoading,
    refetch,
  } = useQuery<Banner[]>({
    queryKey: ['admin-banners', activePlacement],
    queryFn: () =>
      api
        .get(`/banners/admin?placement=${activePlacement}`)
        .then((r) => r.data),
  });

  const [localBanners, setLocalBanners] = useState<Banner[]>(banners);

  // Mirror fetched banners into editable local state. Guarded render-time
  // adjustment replaces a synchronous setState effect.
  // NOTE: the `banners` default above must stay a STABLE reference (EMPTY_BANNERS).
  // A fresh `[]` per render makes this guard always true while loading, which
  // loops forever (React "Too many re-renders").
  const [lastFetchedBanners, setLastFetchedBanners] = useState(banners);
  if (lastFetchedBanners !== banners) {
    setLastFetchedBanners(banners);
    setLocalBanners(banners);
  }

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = localBanners.findIndex(
        (b) => b.id === active.id,
      );
      const newIndex = localBanners.findIndex(
        (b) => b.id === over.id,
      );
      const reordered = arrayMove(localBanners, oldIndex, newIndex);
      setLocalBanners(reordered);

      const items = reordered.map((b, i) => ({
        id: b.id,
        position: i,
      }));
      try {
        await api.patch('/banners/admin/reorder', { items });
        queryClient.invalidateQueries({
          queryKey: ['banners', activePlacement],
        });
      } catch {
        toast.error('Failed to reorder');
        refetch();
      }
    },
    [localBanners, activePlacement, queryClient, refetch],
  );

  async function handleToggle(id: number) {
    try {
      await api.patch(`/banners/admin/${id}/toggle`);
      refetch();
      queryClient.invalidateQueries({
        queryKey: ['banners', activePlacement],
      });
      toast.success('Status toggled');
    } catch {
      toast.error('Failed to toggle status');
    }
  }

  async function handleDelete(id: number) {
    try {
      await api.delete(`/banners/admin/${id}`);
      setDeleteConfirmId(null);
      refetch();
      queryClient.invalidateQueries({
        queryKey: ['banners', activePlacement],
      });
      toast.success('Banner deleted');
    } catch {
      toast.error('Failed to delete banner');
    }
  }

  function openEditDrawer(banner: Banner) {
    setEditingBanner(banner);
    setDrawerOpen(true);
  }

  function openAddDrawer() {
    setEditingBanner(null);
    setDrawerOpen(true);
  }

  function handleDrawerSaved() {
    refetch();
    queryClient.invalidateQueries({
      queryKey: ['banners', activePlacement],
    });
  }

  const activePlacementInfo = useMemo(() => {
    return PLACEMENTS.find((p) => p.key === activePlacement) || PLACEMENTS[0];
  }, [activePlacement]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Banner Management</h1>
          <p className="text-xs text-gray-500 mt-0.5">Control advertisements, announcement banners, and page spotlights.</p>
        </div>
        <button
          onClick={openAddDrawer}
          className="px-4 py-2.5 bg-primary hover:bg-primary/95 text-white text-sm rounded-lg font-semibold flex items-center gap-2 transition shrink-0"
        >
          <Plus size={16} /> Add Banner
        </button>
      </div>

      {/* Placement tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {PLACEMENTS.map((p) => (
          <button
            key={p.key}
            onClick={() => setActivePlacement(p.key)}
            className={`px-4 py-2 text-xs font-semibold rounded-full whitespace-nowrap transition-colors border ${
              activePlacement === p.key
                ? 'bg-primary text-white border-primary'
                : 'bg-white text-gray-600 hover:bg-gray-100 border-gray-200'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* active placement help bar */}
      <div className="bg-white border rounded-xl p-4 flex gap-3 shadow-sm">
        <div className="bg-primary/10 w-9 h-9 rounded-lg flex items-center justify-center text-primary shrink-0">
          <Layout size={18} />
        </div>
        <div>
          <h3 className="font-bold text-sm text-gray-800">{activePlacementInfo.label}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{activePlacementInfo.description}</p>
          <p className="text-[11px] text-[#2D6A4F] font-semibold mt-1.5 flex items-center gap-1">
            <Info size={12} /> {activePlacementInfo.helpText}
          </p>
        </div>
      </div>

      {/* Banner list */}
      <div className="bg-white rounded-xl border overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="px-4 py-12 text-center text-gray-400 text-sm">
            Loading active banners list...
          </div>
        ) : localBanners.length === 0 ? (
          <div className="px-4 py-12 text-center text-gray-400 text-sm">
            No banners configured for this section yet.{' '}
            <button
              onClick={openAddDrawer}
              className="text-primary font-semibold hover:underline"
            >
              Add one now
            </button>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={localBanners.map((b) => b.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="divide-y">
                {localBanners.map((banner) => (
                  <SortableBannerRow
                    key={banner.id}
                    banner={banner}
                    onEdit={openEditDrawer}
                    onToggle={handleToggle}
                    onDelete={handleDelete}
                    deleteConfirmId={deleteConfirmId}
                    setDeleteConfirmId={setDeleteConfirmId}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {drawerOpen && (
        <BannerDrawer
          banner={editingBanner}
          placement={activePlacement}
          onClose={() => {
            setDrawerOpen(false);
            setEditingBanner(null);
          }}
          onSaved={handleDrawerSaved}
        />
      )}
    </div>
  );
}
