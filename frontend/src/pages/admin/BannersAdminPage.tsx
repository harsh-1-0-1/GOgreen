import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { GripVertical, Image as ImageIcon, Plus, X } from 'lucide-react';
import toast from 'react-hot-toast';

import api from '@/lib/api';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import type { Banner } from '@/types';

const PLACEMENTS = [
  { key: 'hero', label: 'Hero Carousel' },
  { key: 'announcement', label: 'Announcement Bar' },
  { key: 'page', label: 'Page Banner' },
  { key: 'trending', label: 'Trending Carousel' },
  { key: 'themed', label: 'Themed Sections' },
  { key: 'strip', label: 'Strip Tiles' },
  { key: 'highlight', label: 'Highlight Cards' },
  { key: 'collection', label: 'Collections Menu' },
] as const;

const bannerSchema = z
  .object({
    title: z.string().min(1, 'Required').max(100),
    subtitle: z.string().max(255).optional().or(z.literal('')),
    cta_text: z.string().max(50).optional().or(z.literal('')),
    cta_link: z.string().max(255).optional().or(z.literal('')),
    badge_text: z.string().max(100).optional().or(z.literal('')),
    placement: z.enum(['hero', 'announcement', 'page', 'trending', 'themed', 'strip', 'highlight', 'collection']),
    bg_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex'),
    text_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex'),
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
    { message: 'Valid Until must be after Valid From', path: ['valid_until'] },
  );

type BannerFormData = z.infer<typeof bannerSchema>;

const inputClass =
  'w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary-light';

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
      className="flex items-center gap-3 px-3 sm:px-4 py-3 bg-white border-b last:border-0 hover:bg-gray-50/50"
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
          className="w-20 h-[50px] object-cover rounded-md shrink-0 bg-gray-100"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
          }}
        />
      ) : (
        <div className="w-20 h-[50px] rounded-md bg-gray-100 flex items-center justify-center shrink-0">
          <ImageIcon size={18} className="text-gray-300" />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{banner.title}</p>
        <p className="text-xs text-gray-400 truncate">
          {banner.subtitle || banner.cta_link || '—'}
        </p>
      </div>

      <span
        className={`hidden sm:inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${
          banner.is_active
            ? 'bg-green-50 text-green-700'
            : 'bg-gray-100 text-gray-500'
        }`}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full ${banner.is_active ? 'bg-green-500' : 'bg-gray-400'}`}
        />
        {banner.is_active ? 'Active' : 'Inactive'}
      </span>

      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => onEdit(banner)}
          className="px-2.5 py-1.5 text-xs font-medium text-primary hover:bg-primary-light/10 rounded-lg transition touch-target"
        >
          Edit
        </button>
        <button
          onClick={() => onToggle(banner.id)}
          className="px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition touch-target hidden sm:inline-flex"
        >
          {banner.is_active ? 'Deactivate' : 'Activate'}
        </button>
        {deleteConfirmId === banner.id ? (
          <span className="flex items-center gap-1 text-xs">
            <span className="text-gray-500">Sure?</span>
            <button
              onClick={() => onDelete(banner.id)}
              className="text-red-600 font-medium hover:underline touch-target"
            >
              Delete
            </button>
            <button
              onClick={() => setDeleteConfirmId(null)}
              className="text-gray-500 hover:underline touch-target"
            >
              Cancel
            </button>
          </span>
        ) : (
          <button
            onClick={() => setDeleteConfirmId(banner.id)}
            className="px-2.5 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 rounded-lg transition touch-target"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}

// ── Live Preview ───────────────────────────────────────────────────────────

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
    <div className="mt-4">
      <p className="text-[11px] text-gray-400 mb-2">Preview (approximate)</p>
      <div
        className="w-full overflow-hidden rounded-lg border border-gray-200"
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
          <div style={{ flex: 1 }}>
            <h2
              style={{
                fontSize: 52,
                color: textColor || '#1B4332',
                fontWeight: 700,
                marginBottom: 16,
                lineHeight: 1.1,
              }}
            >
              {title || 'Banner Title'}
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
                  background: '#F4D03F',
                  color: '#1B4332',
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
    <div className="mt-4">
      <p className="text-[11px] text-gray-400 mb-2">Preview (approximate)</p>
      <div className="mx-auto w-full max-w-[260px]">
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
          <div className="absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-black/35 via-black/10 to-transparent" />
          <h3 className="absolute inset-x-2 top-4 text-center text-2xl font-medium leading-tight text-white drop-shadow-sm">
            {title || 'Combos'}
          </h3>
        </div>
        <p
          className="mt-2.5 text-center text-xl font-semibold leading-tight"
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
    <div className="mt-4">
      <p className="text-[11px] text-gray-400 mb-2">Preview (approximate)</p>
      <div
        className="relative aspect-square w-full overflow-hidden rounded-xl border border-gray-200"
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
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-br from-black/45 via-black/10 to-transparent" />
        <h3
          className="absolute left-5 top-6 max-w-[62%] text-3xl font-extrabold leading-[0.98] drop-shadow"
          style={{ color: textColor || '#ffeb3b' }}
        >
          {title || 'Perfect plants for effortless indoor garden'}
        </h3>
        {subtitle && (
          <div className="absolute right-5 top-6 grid h-20 w-20 rotate-[-10deg] place-items-center rounded-full bg-[#ffeb3b] text-center text-primary shadow [clip-path:polygon(50%_0%,59%_12%,73%_6%,78%_21%,94%_22%,88%_38%,100%_50%,88%_62%,94%_78%,78%_79%,73%_94%,59%_88%,50%_100%,41%_88%,27%_94%,22%_79%,6%_78%,12%_62%,0%_50%,12%_38%,6%_22%,22%_21%,27%_6%,41%_12%)]">
            <span className="rotate-[10deg] px-2 text-sm font-bold leading-tight">
              {subtitle}
            </span>
          </div>
        )}
        <div className="absolute bottom-7 left-1/2 -translate-x-1/2 rounded-md bg-[#ffeb3b] px-5 py-1.5 text-xs font-extrabold text-primary shadow">
          {ctaText || 'SHOP NOW'}
        </div>
      </div>
    </div>
  );
}

// ── Edit/Add Drawer ────────────────────────────────────────────────────────

function BannerDrawer({
  banner,
  placement,
  cloudinaryEnabled,
  onClose,
  onSaved,
}: {
  banner: Banner | null;
  placement: string;
  cloudinaryEnabled: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!banner;

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<BannerFormData>({
    resolver: zodResolver(bannerSchema) as any,
    defaultValues: {
      title: banner?.title || '',
      subtitle: banner?.subtitle || '',
      cta_text: banner?.cta_text || '',
      cta_link: banner?.cta_link || '',
      badge_text: banner?.badge_text || '',
      placement: (banner?.placement || placement) as any,
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

  const [submitting, setSubmitting] = useState(false);
  const [imageMode, setImageMode] = useState<'upload' | 'url'>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [manualUrl, setManualUrl] = useState('');
  const [urlValid, setUrlValid] = useState<boolean | null>(null);
  const [imageCleared, setImageCleared] = useState(false);
  const [fileError, setFileError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const watchedTitle = watch('title');
  const watchedSubtitle = watch('subtitle');
  const watchedBgColor = watch('bg_color');
  const watchedTextColor = watch('text_color');
  const watchedCtaText = watch('cta_text');
  const watchedPlacement = watch('placement');

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
    setSelectedFile(file);
    setFilePreview(URL.createObjectURL(file));
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

      toast.success('Banner saved!');
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(
        err.response?.data?.detail || 'Failed to save banner',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
      />
      <div className="fixed right-0 top-0 h-full w-full sm:w-[480px] bg-white z-50 shadow-[-4px_0_24px_rgba(0,0,0,0.08)] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-4 sm:p-5 border-b shrink-0">
          <h2 className="text-lg font-bold">
            {isEdit ? 'Edit Banner' : 'Add Banner'}
          </h2>
          <button onClick={onClose} className="p-2 touch-target">
            <X size={20} />
          </button>
        </div>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4"
        >
          {watchedPlacement === 'highlight' && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2.5 text-[12px] text-emerald-900 leading-relaxed">
              <strong className="font-semibold">Highlight card fields:</strong>{' '}
              <span className="text-emerald-800">Title</span> = card label
              (e.g. <em>Combos</em>),{' '}
              <span className="text-emerald-800">Subtitle</span> = green offer
              caption (e.g. <em>Get 4 at ₹699</em>),{' '}
              <span className="text-emerald-800">CTA Link</span> = where the
              card navigates,{' '}
              <span className="text-emerald-800">Image</span> = card
              background. Cards render in 4-column grid in display order.
            </div>
          )}

          {watchedPlacement === 'collection' && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2.5 text-[12px] text-emerald-900 leading-relaxed">
              <strong className="font-semibold">Collections menu fields:</strong>{' '}
              <span className="text-emerald-800">Title</span> = row label
              (e.g. <em>Plants</em>),{' '}
              <span className="text-emerald-800">CTA Link</span> = where the
              row navigates (e.g. <em>/products?category=plants</em>),{' '}
              <span className="text-emerald-800">Image</span> = portrait photo
              on the right side,{' '}
              <span className="text-emerald-800">Background Color</span> =
              accent blob color (use pastel, e.g. <em>#f9c8d4</em>).
              Rows appear in the hamburger menu in display order.
            </div>
          )}

          {watchedPlacement === 'page' && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2.5 text-[12px] text-emerald-900 leading-relaxed">
              <strong className="font-semibold">Page banner fields:</strong>{' '}
              <span className="text-emerald-800">Title</span> is used for
              accessibility and fallback text,{' '}
              <span className="text-emerald-800">CTA Link</span> makes the
              strip clickable, and{' '}
              <span className="text-emerald-800">Image</span> is the narrow
              banner shown below the header on customer pages. The first active
              banner in display order is shown.
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">
              Title *
            </label>
            <input {...register('title')} className={inputClass} />
            {errors.title && (
              <p className="text-xs text-red-500 mt-1">
                {errors.title.message}
              </p>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">
              Subtitle
            </label>
            <input {...register('subtitle')} className={inputClass} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">
                CTA Button Text
              </label>
              <input
                {...register('cta_text')}
                placeholder="Shop Now"
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">
                CTA Link
              </label>
              <input
                {...register('cta_link')}
                placeholder="/products"
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">
              Badge Text
            </label>
            <input
              {...register('badge_text')}
              placeholder="4 Plants @ ₹699"
              className={inputClass}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">
              Placement *
            </label>
            <select {...register('placement')} className={inputClass}>
              {PLACEMENTS.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">
                Background Color
              </label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={watchedBgColor}
                  onChange={(e) =>
                    setValue('bg_color', e.target.value)
                  }
                  className="w-10 h-10 rounded-lg border cursor-pointer shrink-0"
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
              <label className="text-xs font-medium text-gray-500 mb-1 block">
                Text Color
              </label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={watchedTextColor}
                  onChange={(e) =>
                    setValue('text_color', e.target.value)
                  }
                  className="w-10 h-10 rounded-lg border cursor-pointer shrink-0"
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
              <label className="text-xs font-medium text-gray-500 mb-1 block">
                Valid From
              </label>
              <input
                type="datetime-local"
                {...register('valid_from')}
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">
                Valid Until
              </label>
              <input
                type="datetime-local"
                {...register('valid_until')}
                className={inputClass}
              />
              {errors.valid_until && (
                <p className="text-xs text-red-500 mt-1">
                  {errors.valid_until.message}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-xs font-medium text-gray-500">
              Active
            </label>
            <button
              type="button"
              onClick={() =>
                setValue('is_active', !watch('is_active'))
              }
              className={`relative w-11 h-6 rounded-full transition-colors ${
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

          {/* Image section — hidden for announcement */}
          {watchedPlacement !== 'announcement' && (
            <div className="space-y-3 pt-2 border-t">
              <label className="text-xs font-medium text-gray-500 block">
                Image
              </label>

              {isEdit && banner?.image_url && !imageCleared && (
                <div>
                  <p className="text-[11px] text-gray-400 mb-1">
                    Current image
                  </p>
                  <img
                    src={banner.image_url}
                    alt=""
                    className="w-full h-[140px] object-cover rounded-lg"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setImageCleared(true);
                      setSelectedFile(null);
                      setFilePreview(null);
                    }}
                    className="text-xs text-red-500 hover:underline mt-1"
                  >
                    Remove image
                  </button>
                </div>
              )}

              <div className="flex gap-4 text-xs">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="imageMode"
                    checked={imageMode === 'upload'}
                    onChange={() => setImageMode('upload')}
                  />
                  Upload file
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="imageMode"
                    checked={imageMode === 'url'}
                    onChange={() => setImageMode('url')}
                  />
                  Use image URL
                </label>
              </div>

              {imageMode === 'upload' ? (
                <div>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const file = e.dataTransfer.files?.[0];
                      if (file) handleFileSelect(file);
                    }}
                    className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  >
                    {filePreview ? (
                      <img
                        src={filePreview}
                        alt="Preview"
                        className="max-h-40 mx-auto object-contain rounded"
                      />
                    ) : (
                      <div className="text-gray-400">
                        <ImageIcon
                          size={32}
                          className="mx-auto mb-2"
                        />
                        <p className="text-sm">
                          Click or drag image here
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
                  <p className="text-[11px] text-gray-400 mt-1.5">
                    Max 5 MB. JPG, PNG, WebP accepted.
                  </p>
                  {fileError && (
                    <p className="text-xs text-red-500 mt-1">
                      {fileError}
                    </p>
                  )}
                  <p className="text-[11px] text-gray-400 mt-1">
                    {cloudinaryEnabled
                      ? '☁ Uploads go to Cloudinary CDN'
                      : '💾 Uploads saved locally. Configure Cloudinary in .env for CDN.'}
                  </p>
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
                    placeholder="https://images.unsplash.com/..."
                    className={inputClass}
                  />
                  <p className="text-[11px] text-gray-400 mt-1">
                    Paste any image URL — Unsplash, your CDN, etc.
                  </p>
                  {urlValid === true && (
                    <p className="text-xs text-green-600 mt-1">
                      ✓ Image loaded successfully
                    </p>
                  )}
                  {urlValid === false && (
                    <p className="text-xs text-red-500 mt-1">
                      Cannot load this URL, try another
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Live preview for hero */}
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

          {/* Announcement preview */}
          {watchedPlacement === 'announcement' && watchedTitle && (
            <div className="mt-4">
              <p className="text-[11px] text-gray-400 mb-2">
                Preview (approximate)
              </p>
              <div
                className="w-full h-9 flex items-center justify-center text-white text-[12px] font-medium tracking-wide rounded-lg overflow-hidden"
                style={{ backgroundColor: '#1B4332' }}
              >
                {watchedTitle}
              </div>
            </div>
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
            <div className="mt-4">
              <p className="text-[11px] text-gray-400 mb-2">
                Preview (approximate)
              </p>
              <div
                className="h-[72px] w-full overflow-hidden rounded-lg border border-gray-200"
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
                      className="text-sm font-semibold"
                      style={{ color: watchedTextColor }}
                    >
                      {watchedTitle || 'Page banner'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border rounded-xl text-sm font-medium hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 transition"
            >
              {submitting ? 'Saving...' : 'Save Banner'}
            </button>
          </div>
        </form>
      </div>
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

  const { data: config } = useQuery({
    queryKey: ['banner-config'],
    queryFn: () => api.get('/banners/config').then((r) => r.data),
    retry: false,
    staleTime: Infinity,
  });

  const {
    data: banners = [],
    isLoading,
    refetch,
  } = useQuery<Banner[]>({
    queryKey: ['admin-banners', activePlacement],
    queryFn: () =>
      api
        .get(`/banners/admin?placement=${activePlacement}`)
        .then((r) => r.data),
  });

  const [localBanners, setLocalBanners] = useState<Banner[]>([]);
  useEffect(() => {
    setLocalBanners(banners);
  }, [banners]);

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
      toast.success('Banner toggled');
    } catch {
      toast.error('Failed to toggle');
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
      toast.error('Failed to delete');
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

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold">Banners</h1>
        <div className="flex items-center gap-3">
          {config !== undefined && (
            <span className="text-[11px]">
              {config?.cloudinary_enabled ? (
                <span className="text-green-600">
                  ● Cloudinary — CDN active
                </span>
              ) : (
                <span className="text-amber-600">
                  ● Local storage active
                  <a
                    href="https://cloudinary.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-1.5 underline"
                  >
                    Set up Cloudinary →
                  </a>
                </span>
              )}
            </span>
          )}
          <button
            onClick={openAddDrawer}
            className="px-4 py-2.5 bg-primary text-white text-sm rounded-lg font-medium flex items-center gap-2 hover:bg-primary/90 touch-target"
          >
            <Plus size={16} /> Add Banner
          </button>
        </div>
      </div>

      {/* Placement tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {PLACEMENTS.map((p) => (
          <button
            key={p.key}
            onClick={() => setActivePlacement(p.key)}
            className={`px-4 py-2 text-sm rounded-full font-medium whitespace-nowrap transition-colors ${
              activePlacement === p.key
                ? 'bg-[#1B4332] text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100 border'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Banner list */}
      <div className="bg-white rounded-xl border overflow-hidden">
        {isLoading ? (
          <div className="px-4 py-12 text-center text-gray-400 text-sm">
            Loading...
          </div>
        ) : localBanners.length === 0 ? (
          <div className="px-4 py-12 text-center text-gray-400 text-sm">
            No banners for this placement.{' '}
            <button
              onClick={openAddDrawer}
              className="text-primary hover:underline"
            >
              Add one
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
            </SortableContext>
          </DndContext>
        )}
      </div>

      {drawerOpen && (
        <BannerDrawer
          banner={editingBanner}
          placement={activePlacement}
          cloudinaryEnabled={config?.cloudinary_enabled ?? false}
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
