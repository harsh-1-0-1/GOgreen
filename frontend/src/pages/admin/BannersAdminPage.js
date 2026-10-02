import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy, } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Image as ImageIcon, Plus, X, Info, Layout, CheckCircle, Crop } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { useCategories } from '@/hooks/useCategories';
import { getApiErrorDetail } from '@/lib/apiError';
import ImageCropModal from '@/components/admin/ImageCropModal';
import CategoryLinkPicker from '@/components/admin/CategoryLinkPicker';
const PLACEMENTS = [
    {
        key: 'hero',
        label: '🏠 Home Page Hero Banner',
        description: 'This banner appears at the very top of the homepage. It is the first thing customers see.',
        helpText: 'Upload two images: a phone crop (portrait 4:5, e.g. 800×1000px) and a wide desktop crop (21:9, e.g. 1920×824px). Each has its own crop presets.',
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
        helpText: 'Upload two images: a phone crop (required 600×600px, 1:1 square) and a wide desktop crop (16:9, e.g. 1920×1080px). Each has its own crop presets.',
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
        description: '3:4 promo/product tiles shown in the horizontal strip on the homepage.',
        helpText: 'Required size: 450x600px (3:4 ratio). The image fills the tile edge-to-edge and the label shows in a bar below the image. Use the crop tool to adjust your upload to a 3:4 ratio.',
    },
    {
        key: 'highlight',
        label: '⭐ Best Seller Highlight Card',
        description: 'Vertical card in a 4-column grid. Highlights custom sets like "Combos" or "Starter Kits".',
        helpText: 'Recommended size: 400x550px. The title becomes the bold text overlay.',
    },
    {
        key: 'category_nav',
        label: '🔵 Homepage Category Circles',
        description: 'The row of round category icons at the very top of the homepage. Each circle is one banner you fully control.',
        helpText: 'Upload a square image (1:1). The "Title" is the name shown under the circle and the link decides what it opens. Drag to reorder the row.',
    },
    {
        key: 'mobile_promo',
        label: '📱 Mobile Drawer Promo',
        description: 'Full-bleed rectangular banner shown at the top of the mobile menu drawer.',
        helpText: 'Recommended size: 640×200px (16:5). A thin strip that fills the whole card edge-to-edge — no text is overlaid, so bake any text into the image itself.',
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
    {
        key: 'product_strip',
        label: '🏷️ Product Strip Banner',
        description: 'A wide horizontal strip banner displayed on the product detail page, just below the Buy It Now button.',
        helpText: 'Recommended size: 1400×200px. Choose a product category for category-specific banners, or leave blank as fallback for all products.',
    },
];
const bannerSchema = z
    .object({
    title: z.string().min(1, 'Title is required').max(100),
    subtitle: z.string().max(255).optional().or(z.literal('')),
    cta_text: z.string().max(50).optional().or(z.literal('')),
    cta_link: z.string().max(255).optional().or(z.literal('')),
    badge_text: z.string().max(100).optional().or(z.literal('')),
    placement: z.enum(['hero', 'announcement', 'page', 'trending', 'themed', 'strip', 'highlight', 'category_nav', 'mobile_promo', 'corporate_gifting', 'happy_planters', 'product_detail', 'product_spec', 'product_strip']),
    target_path: z.string().max(255).optional().or(z.literal('')),
    bg_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color (e.g. #FFFFFF)'),
    text_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Must be a valid hex color (e.g. #000000)'),
    is_active: z.boolean(),
    valid_from: z.string().optional().or(z.literal('')),
    valid_until: z.string().optional().or(z.literal('')),
})
    .refine((d) => {
    if (d.valid_from && d.valid_until)
        return new Date(d.valid_until) > new Date(d.valid_from);
    return true;
}, { message: 'End date/time must be after start date/time', path: ['valid_until'] });
function topLevelCategories(categories) {
    return categories?.filter((category) => category.is_active) ?? [];
}
function flattenCategoryOptions(categories) {
    const options = [];
    const walk = (cat, depth) => {
        options.push({
            value: cat.slug,
            label: `${'— '.repeat(depth)}${cat.name} (/${cat.slug})`,
        });
        (cat.children ?? []).forEach((child) => walk(child, depth + 1));
    };
    (categories ?? []).forEach((cat) => walk(cat, 0));
    return options;
}
const EMPTY_BANNERS = [];
const inputClass = 'w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors';
const emptyImageSlot = () => ({
    file: null,
    preview: null,
    fromFile: false,
    manualUrl: '',
    urlValid: null,
    cleared: false,
    error: '',
});
/**
 * Upload / URL / crop control for a single banner image variant. The drawer
 * renders this twice — once for the phone crop, once for the wide desktop crop —
 * and owns the slot state so it can build the multipart payload.
 */
function BannerImageField({ variant, title, description, emptyHint, cropLabel, isEdit, existingUrl, slot, update, onCropRequest, }) {
    const fileInputRef = useRef(null);
    const isWeb = variant === 'web';
    const showExisting = !!isEdit && !!existingUrl && !slot.cleared;
    const previewSrc = slot.preview || slot.manualUrl || (showExisting ? existingUrl : null);
    const showPicker = !showExisting;
    function handleFileSelect(file) {
        if (file.size > 5 * 1024 * 1024) {
            update({ error: 'File exceeds 5 MB limit' });
            return;
        }
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            update({ error: 'Only JPG, PNG, or WebP files accepted' });
            return;
        }
        // Hand the local file to the cropper; nothing is uploaded until Save.
        const reader = new FileReader();
        reader.onload = (e) => onCropRequest({ src: e.target?.result, useServerCrop: false, variant });
        reader.readAsDataURL(file);
    }
    function validateUrl() {
        if (!slot.manualUrl) {
            update({ urlValid: null });
            return;
        }
        const img = new window.Image();
        img.onload = () => update({ urlValid: true });
        img.onerror = () => update({ urlValid: false });
        img.src = slot.manualUrl;
    }
    function requestCrop(src, useServerCrop) {
        onCropRequest({ src, useServerCrop, variant });
    }
    const replaceExisting = () => update({ cleared: true, file: null, preview: null, fromFile: false, manualUrl: '' });
    return (_jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: `px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${isWeb ? 'bg-sky-100 text-sky-700' : 'bg-violet-100 text-violet-700'}`, children: isWeb ? 'Web' : 'Mobile' }), _jsx("p", { className: "text-xs font-semibold text-gray-700", children: title })] }), _jsx("p", { className: "text-[11px] text-gray-500", children: description }), showExisting && (_jsxs("div", { className: "relative rounded-lg overflow-hidden border group", children: [_jsx("img", { src: previewSrc || existingUrl || '', alt: `Current ${variant} banner`, className: `w-full object-cover ${isWeb ? 'h-28' : 'h-32'}` }), _jsxs("div", { className: "hidden sm:flex absolute inset-0 bg-black/40 items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity gap-2", children: [_jsx("button", { type: "button", onClick: replaceExisting, className: "px-3 py-1.5 bg-red-600 text-white rounded text-xs font-semibold hover:bg-red-700 transition", children: "Replace" }), _jsxs("button", { type: "button", onClick: () => requestCrop(existingUrl, true), className: "px-3 py-1.5 bg-primary text-white rounded text-xs font-semibold hover:bg-primary/95 transition flex items-center gap-1", children: [_jsx(Crop, { size: 14 }), " Crop"] })] }), _jsxs("div", { className: "sm:hidden absolute bottom-2 left-2 right-2 flex gap-2", children: [_jsx("button", { type: "button", onClick: replaceExisting, className: "flex-1 px-3 py-1.5 bg-red-600/90 backdrop-blur-sm text-white rounded text-xs font-semibold active:bg-red-700 transition shadow-lg", children: "Replace" }), _jsxs("button", { type: "button", onClick: () => requestCrop(existingUrl, true), className: "flex-1 px-3 py-1.5 bg-primary/90 backdrop-blur-sm text-white rounded text-xs font-semibold active:bg-primary transition flex items-center justify-center gap-1 shadow-lg", children: [_jsx(Crop, { size: 14 }), " Crop"] })] })] })), showPicker && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "flex gap-4 text-xs font-semibold text-gray-600", children: [_jsxs("label", { className: "flex items-center gap-1.5 cursor-pointer", children: [_jsx("input", { type: "radio", name: `imageMode-${variant}`, checked: !slot.manualUrl, onChange: () => update({ manualUrl: '', urlValid: null }) }), "Upload File"] }), _jsxs("label", { className: "flex items-center gap-1.5 cursor-pointer", children: [_jsx("input", { type: "radio", name: `imageMode-${variant}`, checked: !!slot.manualUrl, onChange: () => update({ file: null, preview: null, fromFile: false }) }), "Use Web URL"] })] }), !slot.manualUrl ? (_jsxs("div", { children: [_jsx("div", { onClick: () => fileInputRef.current?.click(), className: "border-2 border-dashed border-gray-200 rounded-xl p-6 text-center cursor-pointer hover:border-primary/50 transition-colors", children: slot.preview ? (_jsxs("div", { className: "flex flex-col items-center gap-3", children: [_jsxs("div", { className: "relative w-full group", children: [_jsx("img", { src: slot.preview, alt: "Preview", className: "max-h-32 mx-auto object-contain rounded" }), _jsx("div", { className: "hidden sm:flex absolute inset-0 items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity", children: _jsxs("button", { type: "button", onClick: (e) => {
                                                            e.stopPropagation();
                                                            requestCrop(slot.preview, !slot.fromFile);
                                                        }, className: "px-4 py-2 bg-primary/90 backdrop-blur-sm text-white rounded-lg hover:bg-primary transition flex items-center gap-1.5 text-xs font-semibold shadow-lg", children: [_jsx(Crop, { size: 14 }), " Edit Crop"] }) })] }), _jsxs("button", { type: "button", onClick: (e) => {
                                                e.stopPropagation();
                                                requestCrop(slot.preview, !slot.fromFile);
                                            }, className: "px-4 py-2 bg-primary text-white rounded-lg active:bg-primary/90 transition shadow-md text-xs font-semibold flex items-center gap-1", children: [_jsx(Crop, { size: 14 }), " ", cropLabel] })] })) : (_jsxs("div", { className: "text-gray-400", children: [_jsx(ImageIcon, { size: 28, className: "mx-auto mb-2" }), _jsxs("p", { className: "text-xs font-semibold text-gray-700", children: ["Upload ", isWeb ? 'Web' : 'Mobile', " Image"] }), _jsx("p", { className: "text-[10px] text-gray-400 mt-0.5", children: emptyHint })] })) }), _jsx("input", { ref: fileInputRef, type: "file", accept: "image/jpeg,image/png,image/webp", className: "hidden", onChange: (e) => {
                                    const file = e.target.files?.[0];
                                    if (file)
                                        handleFileSelect(file);
                                    e.target.value = '';
                                } }), slot.error && _jsx("p", { className: "text-xs text-red-500 mt-1", children: slot.error })] })) : (_jsxs("div", { children: [_jsx("input", { type: "url", value: slot.manualUrl, onChange: (e) => update({ manualUrl: e.target.value, urlValid: null }), onBlur: validateUrl, placeholder: "e.g. https://images.unsplash.com/...", className: inputClass }), slot.urlValid === true && (_jsxs("p", { className: "text-xs text-green-600 mt-1 flex items-center gap-1", children: [_jsx(CheckCircle, { size: 12 }), " Image URL loaded successfully"] })), slot.urlValid === false && (_jsx("p", { className: "text-xs text-red-500 mt-1", children: "Could not verify image. Double check the address." }))] }))] }))] }));
}
// ── Sortable row ───────────────────────────────────────────────────────────
function SortableBannerRow({ banner, onEdit, onToggle, onDelete, deleteConfirmId, setDeleteConfirmId, }) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: banner.id });
    const rowThumbnail = (banner.placement === 'hero' || banner.placement === 'trending') &&
        banner.image_url_web
        ? banner.image_url_web
        : null;
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };
    return (_jsxs("div", { ref: setNodeRef, style: style, className: "flex items-center gap-3 px-3 sm:px-4 py-3.5 bg-white border-b last:border-0 hover:bg-gray-50/50", children: [_jsx("button", { ...attributes, ...listeners, className: "cursor-grab active:cursor-grabbing touch-none touch-target text-gray-400 hover:text-gray-600 shrink-0", "aria-label": "Drag to reorder", children: _jsx(GripVertical, { size: 18 }) }), (rowThumbnail || banner.image_url) ? (_jsxs("div", { className: "relative shrink-0", children: [_jsx("img", { src: rowThumbnail || banner.image_url, alt: "", className: "w-16 h-10 object-cover rounded-lg bg-gray-50 border border-gray-100", onError: (e) => {
                            e.currentTarget.style.display = 'none';
                        } }), rowThumbnail && (_jsx("span", { className: "absolute -bottom-1 -right-1 px-1 rounded bg-sky-600 text-[8px] font-bold text-white leading-tight", children: "WEB" }))] })) : (_jsx("div", { className: "w-16 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 border border-gray-100", children: _jsx(ImageIcon, { size: 16, className: "text-gray-300" }) })), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("p", { className: "text-sm font-semibold text-gray-800 truncate", children: banner.title }), _jsx("p", { className: "text-xs text-gray-400 truncate", children: (banner.placement === 'page' || banner.placement === 'product_detail' || banner.placement === 'product_spec' || banner.placement === 'product_strip') && banner.target_path
                            ? `${banner.placement === 'product_detail' || banner.placement === 'product_spec' || banner.placement === 'product_strip' ? 'Type' : 'Target'}: ${banner.target_path}`
                            : banner.subtitle || banner.cta_link || '—' })] }), _jsxs("span", { className: `hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${banner.is_active
                    ? 'bg-green-50 text-green-700'
                    : 'bg-gray-100 text-gray-500'}`, children: [_jsx("span", { className: `w-1.5 h-1.5 rounded-full ${banner.is_active ? 'bg-green-500' : 'bg-gray-400'}` }), banner.is_active ? 'Active' : 'Paused'] }), _jsxs("div", { className: "flex items-center gap-1 shrink-0", children: [_jsx("button", { onClick: () => onEdit(banner), className: "px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary-light/10 rounded-lg transition", children: "Edit" }), _jsx("button", { onClick: () => onToggle(banner.id), className: "px-2.5 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100 rounded-lg transition hidden sm:inline-flex", children: banner.is_active ? 'Pause' : 'Activate' }), deleteConfirmId === banner.id ? (_jsxs("span", { className: "flex items-center gap-1 text-xs", children: [_jsx("span", { className: "text-gray-500", children: "Sure?" }), _jsx("button", { onClick: () => onDelete(banner.id), className: "text-red-600 font-medium hover:underline px-1", children: "Delete" }), _jsx("button", { onClick: () => setDeleteConfirmId(null), className: "text-gray-500 hover:underline px-1", children: "No" })] })) : (_jsx("button", { onClick: () => setDeleteConfirmId(banner.id), className: "px-2.5 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 rounded-lg transition", children: "Delete" }))] })] }));
}
// ── Live Preview Mockups ───────────────────────────────────────────────────
function BannerPreview({ title, subtitle, bgColor, textColor, ctaText, imageSrc, }) {
    return (_jsxs("div", { className: "mt-4 p-4 border rounded-xl bg-gray-50", children: [_jsx("p", { className: "text-[11px] font-semibold text-gray-400 mb-2 uppercase tracking-wider", children: "Live Mockup Preview" }), _jsx("div", { className: "w-full overflow-hidden rounded-lg border border-gray-200 bg-[#F5F0E8]", style: { height: 200 }, children: _jsxs("div", { style: {
                        transform: 'scale(0.35)',
                        transformOrigin: 'top left',
                        width: `${100 / 0.35}%`,
                        height: `${200 / 0.35}px`,
                        background: bgColor || '#F5F0E8',
                        display: 'flex',
                        alignItems: 'center',
                        padding: 48,
                        position: 'relative',
                    }, children: [_jsxs("div", { style: { flex: 1, paddingRight: 24 }, children: [_jsx("h2", { style: {
                                        fontSize: 52,
                                        color: textColor || '#1B4332',
                                        fontWeight: 700,
                                        marginBottom: 16,
                                        lineHeight: 1.1,
                                    }, children: title || 'Seasonal Specials' }), subtitle && (_jsx("p", { style: {
                                        fontSize: 22,
                                        color: textColor || '#1B4332',
                                        opacity: 0.8,
                                        marginBottom: 24,
                                    }, children: subtitle })), ctaText && (_jsx("div", { style: {
                                        background: textColor || '#1B4332',
                                        color: bgColor || '#FFFFFF',
                                        padding: '14px 28px',
                                        borderRadius: 8,
                                        display: 'inline-block',
                                        fontSize: 20,
                                        fontWeight: 600,
                                    }, children: ctaText }))] }), imageSrc && (_jsx("img", { src: imageSrc, alt: "", style: {
                                height: '100%',
                                objectFit: 'cover',
                                marginLeft: 'auto',
                                maxWidth: '50%',
                                borderRadius: 12
                            }, onError: (e) => {
                                e.currentTarget.style.display = 'none';
                            } }))] }) })] }));
}
function HighlightCardPreview({ title, subtitle, bgColor, textColor, imageSrc, }) {
    return (_jsxs("div", { className: "mt-4 p-4 border rounded-xl bg-gray-50 flex flex-col items-center", children: [_jsx("p", { className: "text-[11px] font-semibold text-gray-400 mb-2 uppercase tracking-wider", children: "Highlight Card Preview" }), _jsxs("div", { className: "w-full max-w-[180px]", children: [_jsxs("div", { className: "relative aspect-[3/4] overflow-hidden rounded-xl border border-gray-200 shadow-sm", style: { backgroundColor: bgColor || '#F5F0E8' }, children: [imageSrc ? (_jsx("img", { src: imageSrc, alt: "", className: "absolute inset-0 h-full w-full object-cover", onError: (e) => {
                                    e.currentTarget.style.display = 'none';
                                } })) : null, _jsx("h3", { className: "absolute inset-x-2 bottom-4 text-center text-sm font-semibold leading-tight text-white drop-shadow-sm", children: title || 'Combos' })] }), _jsx("p", { className: "mt-2 text-center text-xs font-bold leading-tight", style: { color: textColor || '#16A34A' }, children: subtitle || 'Get 4 at ₹699' })] })] }));
}
function TrendingBannerPreview({ title, subtitle, bgColor, textColor, ctaText, imageSrc, }) {
    return (_jsxs("div", { className: "mt-4 p-4 border rounded-xl bg-gray-50", children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsx("p", { className: "text-[11px] font-semibold text-gray-400 uppercase tracking-wider", children: "Carousel Banner Preview" }), _jsx("div", { className: "text-[10px] text-gray-500 bg-white px-2 py-1 rounded border", children: "Fixed Size: 600\u00D7600px (1:1)" })] }), _jsx("div", { className: "flex justify-center", children: _jsxs("div", { className: "relative w-60 h-60 overflow-hidden rounded-xl border-2 border-gray-300 shadow-lg", style: { backgroundColor: bgColor || '#e9dfc9' }, children: [imageSrc ? (_jsx("img", { src: imageSrc, alt: "", className: "absolute inset-0 h-full w-full object-cover", onError: (e) => {
                                e.currentTarget.style.display = 'none';
                            } })) : (_jsx("div", { className: "absolute inset-0 flex items-center justify-center text-gray-400 text-xs", children: "No image uploaded" })), _jsx("h3", { className: "absolute left-3 top-3 max-w-[80%] text-xs font-bold leading-tight text-white drop-shadow", style: { color: textColor || '#FFFFFF' }, children: title || 'Perfect Indoor Plants' }), subtitle && (_jsx("div", { className: "absolute right-3 top-3 bg-yellow-400 text-primary text-[9px] font-bold px-1.5 py-0.5 rounded shadow", children: subtitle })), _jsx("div", { className: "absolute bottom-3 left-1/2 -translate-x-1/2 rounded bg-[#ffeb3b] px-3 py-1 text-[9px] font-bold text-primary shadow", children: ctaText || 'SHOP NOW' })] }) }), _jsx("div", { className: "mt-3 text-center", children: _jsx("p", { className: "text-[10px] text-amber-600 bg-amber-50 inline-block px-3 py-1.5 rounded-lg border border-amber-200", children: "\u26A0\uFE0F Images must be square (1:1 ratio). Use the crop tool to adjust your image to 600\u00D7600px." }) })] }));
}
// ── Edit/Add Drawer ────────────────────────────────────────────────────────
function BannerDrawer({ banner, placement, onClose, onSaved, }) {
    const isEdit = !!banner;
    const { register, handleSubmit, watch, setValue, getValues, formState: { errors }, } = useForm({
        resolver: zodResolver(bannerSchema),
        defaultValues: {
            title: banner?.title || '',
            subtitle: banner?.subtitle || '',
            cta_text: banner?.cta_text || '',
            cta_link: banner?.cta_link || '',
            badge_text: banner?.badge_text || '',
            placement: (banner?.placement || placement),
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
    const categoryOptions = flattenCategoryOptions(categories);
    const [submitting, setSubmitting] = useState(false);
    // Phone crop (`image_url`) and the optional wide desktop crop (`image_url_web`).
    const [mobileImage, setMobileImage] = useState(emptyImageSlot);
    const [webImage, setWebImage] = useState(emptyImageSlot);
    const [cropModalOpen, setCropModalOpen] = useState(false);
    const [cropImageSrc, setCropImageSrc] = useState(null);
    // Every crop-modal trigger must set this explicitly so local previews use
    // client-side cropping and persisted banner images use the server crop API.
    const [useServerCrop, setUseServerCrop] = useState(false);
    const [cropVariant, setCropVariant] = useState('mobile');
    // react-hook-form's `watch()` is a React-Compiler-incompatible library (cannot be
    // memoized safely); the live banner preview needs its reactive values, so the
    // compiler is intentionally allowed to skip memoizing this drawer.
    // eslint-disable-next-line react-hooks/incompatible-library
    const watchedTitle = watch('title');
    const watchedSubtitle = watch('subtitle');
    const watchedBgColor = watch('bg_color');
    const watchedTextColor = watch('text_color');
    const watchedCtaText = watch('cta_text');
    const watchedCtaLink = watch('cta_link');
    const watchedPlacement = watch('placement');
    const watchedTargetPath = watch('target_path');
    const hasCustomTargetPath = watchedTargetPath &&
        watchedTargetPath !== '*' &&
        !categoryOptions.some((opt) => opt.value === watchedTargetPath);
    // A circle opens exactly one thing, so the picker offers real destinations
    // (pages + nested categories) instead of a free-text URL that can silently rot.
    const circleLinkPages = useMemo(() => [
        { value: '/', label: 'Home page' },
        { value: '/products', label: 'All products' },
        { value: '/corporate-gifting', label: 'Corporate gifting' },
        { value: '/blog', label: 'Blog' },
        { value: '/faqs', label: 'FAQs' },
        { value: '/damage-replacement', label: 'Damage replacement' },
    ], []);
    const circleLinkCategories = useMemo(() => flattenCategoryOptions(categories).map((opt) => ({
        value: `/products?category=${opt.value}`,
        label: opt.label,
    })), [categories]);
    const circleLinkValues = useMemo(() => new Set([...circleLinkPages, ...circleLinkCategories].map((o) => o.value)), [circleLinkPages, circleLinkCategories]);
    const hasCustomCircleLink = !!watchedCtaLink && !circleLinkValues.has(watchedCtaLink);
    const activePlacementDetails = useMemo(() => {
        return PLACEMENTS.find((p) => p.key === watchedPlacement) || PLACEMENTS[0];
    }, [watchedPlacement]);
    const slotPreview = (slot, existingUrl) => {
        if (slot.preview)
            return slot.preview;
        if (slot.manualUrl)
            return slot.manualUrl;
        if (!slot.cleared && existingUrl)
            return existingUrl;
        return null;
    };
    const previewImageSrc = useMemo(() => slotPreview(mobileImage, banner?.image_url), [mobileImage, banner?.image_url]);
    const webPreviewImageSrc = useMemo(() => slotPreview(webImage, banner?.image_url_web), [webImage, banner?.image_url_web]);
    // `hero` and `trending` are the two carousels, and the only placements wide
    // enough on desktop for a phone crop to look wrong — so they get the extra
    // web image slot.
    const supportsWebImage = watchedPlacement === 'hero' || watchedPlacement === 'trending';
    function requestCrop({ src, useServerCrop: server, variant }) {
        setCropImageSrc(src);
        setUseServerCrop(server);
        setCropVariant(variant);
        setCropModalOpen(true);
    }
    function applyCropToSlot(variant, patch) {
        const setter = variant === 'web' ? setWebImage : setMobileImage;
        setter((s) => ({ ...s, ...patch }));
    }
    function handleCropComplete(croppedFile, preview) {
        // Client-side crop for a not-yet-uploaded file: keep it for the payload.
        applyCropToSlot(cropVariant, {
            file: croppedFile,
            preview,
            fromFile: true,
            cleared: false,
            error: '',
        });
    }
    function handleServerCropComplete(newImageUrl, variant) {
        // Server-side crop is already persisted — only refresh the preview and
        // refetch the list. Deliberately does not set `file`/`manualUrl`, so
        // pressing Save afterwards submits nothing for this image.
        applyCropToSlot(variant, { preview: newImageUrl, fromFile: false, error: '' });
        onSaved();
    }
    function appendImageFields(fd, opts) {
        const { fileField, urlField, clearField, slot } = opts;
        if (slot.file) {
            fd.append(fileField, slot.file);
        }
        else if (slot.manualUrl) {
            fd.append(urlField, slot.manualUrl);
        }
        else if (slot.cleared) {
            // An empty `urlField` value cannot express "remove this" — the multipart
            // parser drops blank fields, so it would arrive as absent. Send the flag.
            fd.append(clearField, 'true');
        }
    }
    async function onSubmit(data) {
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
            if (data.valid_from)
                fd.append('valid_from', data.valid_from);
            if (data.valid_until)
                fd.append('valid_until', data.valid_until);
            appendImageFields(fd, {
                fileField: 'image',
                urlField: 'image_url_manual',
                clearField: 'clear_image',
                slot: mobileImage,
            });
            if (supportsWebImage) {
                appendImageFields(fd, {
                    fileField: 'image_web',
                    urlField: 'image_url_web_manual',
                    clearField: 'clear_image_web',
                    slot: webImage,
                });
            }
            if (isEdit) {
                await api.put(`/banners/admin/${banner.id}`, fd, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
            }
            else {
                await api.post('/banners/admin', fd, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
            }
            toast.success('Banner saved successfully!');
            onSaved();
            onClose();
        }
        catch (err) {
            toast.error(getApiErrorDetail(err, 'Failed to save banner'));
        }
        finally {
            setSubmitting(false);
        }
    }
    return (_jsxs(_Fragment, { children: [_jsx("div", { className: "fixed inset-0 bg-black/40 z-40 transition-opacity", onClick: onClose }), _jsxs("div", { className: "fixed right-0 top-0 h-full w-full sm:w-[480px] bg-[#FAFAF8] z-50 shadow-2xl flex flex-col overflow-hidden", children: [_jsxs("div", { className: "flex items-center justify-between p-4 sm:p-5 border-b bg-white shrink-0", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-lg font-bold text-gray-900", children: isEdit ? 'Edit Banner Settings' : 'Create New Banner' }), _jsx("p", { className: "text-xs text-gray-500", children: "Configure visual advertisements for customers" })] }), _jsx("button", { onClick: onClose, className: "p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors", children: _jsx(X, { size: 20 }) })] }), _jsxs("form", { onSubmit: handleSubmit(onSubmit), className: "flex-1 overflow-y-auto p-4 sm:p-5 space-y-4", children: [_jsxs("div", { className: "bg-emerald-50 border border-emerald-100 rounded-xl p-3 flex gap-2 text-xs text-emerald-800 leading-relaxed", children: [_jsx(Info, { size: 16, className: "shrink-0 text-primary-light mt-0.5" }), _jsxs("div", { children: [_jsx("p", { className: "font-bold text-primary", children: activePlacementDetails.label }), _jsx("p", { className: "mt-0.5", children: activePlacementDetails.description }), _jsx("p", { className: "font-semibold text-emerald-900 mt-1.5", children: activePlacementDetails.helpText })] })] }), watchedPlacement === 'highlight' && (_jsx(HighlightCardPreview, { title: watchedTitle || '', subtitle: watchedSubtitle || '', bgColor: watchedBgColor, textColor: watchedTextColor, imageSrc: previewImageSrc })), watchedPlacement === 'page' && (_jsxs("div", { children: [_jsxs("label", { className: "text-xs font-semibold text-gray-700 mb-1 block", children: ["Category Slug ", _jsx("span", { className: "font-normal text-gray-400", children: "(Target Path)" })] }), _jsxs("select", { ...register('target_path'), className: inputClass, children: [_jsx("option", { value: "", children: "All categories (global fallback)" }), hasCustomTargetPath && (_jsxs("option", { value: watchedTargetPath, children: [watchedTargetPath, " (custom \u2014 not a current slug)"] })), categoryOptions.map((opt) => (_jsx("option", { value: opt.value, children: opt.label }, opt.value)))] }), _jsxs("p", { className: "text-[10px] text-gray-400 mt-0.5", children: ["Pick the actual category slug (e.g. ", _jsx("strong", { children: "indoor-plants" }), ") so the banner shows on the correct shop listing page. Leave blank to show this banner on all category pages as a fallback."] }), errors.target_path && (_jsx("p", { className: "text-xs text-red-500 mt-1", children: errors.target_path.message }))] })), (watchedPlacement === 'product_detail' || watchedPlacement === 'product_spec' || watchedPlacement === 'product_strip') && (_jsxs("div", { children: [_jsx("label", { className: "text-xs font-semibold text-gray-700 mb-1 block", children: "Product Type" }), productTypeOptions.length > 0 ? (_jsxs("select", { ...register('target_path'), className: inputClass, children: [_jsx("option", { value: "", children: "Fallback for all product types" }), _jsx("option", { value: "*", children: "Fallback (*)" }), productTypeOptions.map((category) => (_jsx("option", { value: category.slug, children: category.name }, category.id)))] })) : (_jsx("input", { ...register('target_path'), className: inputClass, placeholder: "e.g. plants, pots, seeds, or * for fallback" })), _jsx("p", { className: "text-[10px] text-gray-400 mt-0.5", children: "The banner appears on products under this main category. Leave blank or use * as the fallback banner." }), errors.target_path && (_jsx("p", { className: "text-xs text-red-500 mt-1", children: errors.target_path.message }))] })), _jsxs("div", { children: [_jsx("label", { className: "text-xs font-semibold text-gray-700 mb-1 block", children: watchedPlacement === 'category_nav' ? 'Name Under Circle *' : 'Banner Heading / Title *' }), _jsx("input", { ...register('title'), className: inputClass, placeholder: watchedPlacement === 'category_nav' ? 'e.g. Indoor Plants' : 'e.g. Monsoon Plant Sale' }), _jsx("p", { className: "text-[10px] text-gray-400 mt-0.5", children: watchedPlacement === 'category_nav'
                                            ? 'Shown in small text directly beneath the circle. Keep it to one or two words so the row stays tidy.'
                                            : 'The main text displaying bold over the banner.' }), errors.title && (_jsx("p", { className: "text-xs text-red-500 mt-1", children: errors.title.message }))] }), watchedPlacement !== 'category_nav' && (_jsxs("div", { children: [_jsx("label", { className: "text-xs font-semibold text-gray-700 mb-1 block", children: "Sub-heading / Description" }), _jsx("input", { ...register('subtitle'), className: inputClass, placeholder: "e.g. Up to 40% off on all indoor ferns and air-purifiers." }), _jsx("p", { className: "text-[10px] text-gray-400 mt-0.5", children: "Subtext displayed under the main heading." })] })), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [watchedPlacement !== 'category_nav' && (_jsxs("div", { children: [_jsx("label", { className: "text-xs font-semibold text-gray-700 mb-1 block", children: "Button Label (Text)" }), _jsx("input", { ...register('cta_text'), placeholder: "e.g. Shop Sale", className: inputClass })] })), watchedPlacement === 'category_nav' ? (_jsxs("div", { className: watchedPlacement === 'category_nav' ? 'col-span-2' : '', children: [_jsx("label", { className: "text-xs font-semibold text-gray-700 mb-1 block", children: "Opens when tapped *" }), _jsxs("select", { ...register('cta_link'), className: inputClass, children: [_jsx("option", { value: "", children: "\u2014 choose a page or category \u2014" }), hasCustomCircleLink && (_jsxs("option", { value: watchedCtaLink, children: [watchedCtaLink, " (custom)"] })), _jsx("optgroup", { label: "Pages", children: circleLinkPages.map((opt) => (_jsx("option", { value: opt.value, children: opt.label }, opt.value))) }), _jsx("optgroup", { label: "Categories", children: circleLinkCategories.map((opt) => (_jsx("option", { value: opt.value, children: opt.label }, opt.value))) })] }), _jsx("p", { className: "text-[10px] text-gray-400 mt-0.5", children: watchedCtaLink ? (_jsxs(_Fragment, { children: ["This circle opens ", _jsx("strong", { children: watchedCtaLink })] })) : ('Pick where this circle should take the shopper. Until you choose, the circle is not clickable.') }), errors.cta_link && (_jsx("p", { className: "text-xs text-red-500 mt-1", children: errors.cta_link.message }))] })) : (_jsxs("div", { children: [_jsx("label", { className: "text-xs font-semibold text-gray-700 mb-1 block", children: "Link Address (URL)" }), _jsx("input", { ...register('cta_link'), placeholder: "e.g. /products?category=ferns", className: inputClass }), _jsx(CategoryLinkPicker, { categories: categories, value: watchedCtaLink, onPick: (link) => setValue('cta_link', link) })] }))] }), watchedPlacement !== 'category_nav' && (_jsxs("div", { children: [_jsx("label", { className: "text-xs font-semibold text-gray-700 mb-1 block", children: "Top Offer Badge Text" }), _jsx("input", { ...register('badge_text'), className: inputClass, placeholder: "e.g. LIMITED PERIOD ONLY or 20% OFF" })] })), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: "text-xs font-semibold text-gray-700 mb-1 block", children: "Theme Background Color" }), _jsxs("div", { className: "flex gap-2", children: [_jsx("input", { type: "color", value: watchedBgColor, onChange: (e) => setValue('bg_color', e.target.value), className: "w-9 h-9 rounded-lg border cursor-pointer shrink-0" }), _jsx("input", { ...register('bg_color'), className: inputClass })] }), errors.bg_color && (_jsx("p", { className: "text-xs text-red-500 mt-1", children: errors.bg_color.message }))] }), _jsxs("div", { children: [_jsx("label", { className: "text-xs font-semibold text-gray-700 mb-1 block", children: "Banner Text Color" }), _jsxs("div", { className: "flex gap-2", children: [_jsx("input", { type: "color", value: watchedTextColor, onChange: (e) => setValue('text_color', e.target.value), className: "w-9 h-9 rounded-lg border cursor-pointer shrink-0" }), _jsx("input", { ...register('text_color'), className: inputClass })] }), errors.text_color && (_jsx("p", { className: "text-xs text-red-500 mt-1", children: errors.text_color.message }))] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsx("label", { className: "text-xs font-semibold text-gray-700 mb-1 block", children: "Start Schedule (Show From)" }), _jsx("input", { type: "datetime-local", ...register('valid_from'), className: inputClass })] }), _jsxs("div", { children: [_jsx("label", { className: "text-xs font-semibold text-gray-700 mb-1 block", children: "End Schedule (Show Until)" }), _jsx("input", { type: "datetime-local", ...register('valid_until'), className: inputClass }), errors.valid_until && (_jsx("p", { className: "text-xs text-red-500 mt-1", children: errors.valid_until.message }))] })] }), _jsxs("div", { className: "flex items-center gap-3 bg-white p-3 rounded-lg border", children: [_jsxs("div", { children: [_jsx("label", { className: "text-xs font-semibold text-gray-700 block", children: "Publish Status" }), _jsx("span", { className: "text-[10px] text-gray-400", children: "Make it visible immediately on the website" })] }), _jsx("button", { type: "button", onClick: () => setValue('is_active', !getValues('is_active')), className: `relative w-11 h-6 rounded-full transition-colors ml-auto ${watch('is_active') ? 'bg-primary' : 'bg-gray-300'}`, children: _jsx("span", { className: `absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${watch('is_active')
                                                ? 'translate-x-[22px]'
                                                : 'translate-x-0.5'}` }) })] }), watchedPlacement !== 'announcement' && (_jsxs("div", { className: "space-y-3 pt-2 border-t", children: [_jsx("label", { className: "text-xs font-semibold text-gray-700 block", children: "Banner Graphic / Image" }), watchedPlacement === 'trending' && (_jsx("div", { className: "bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800 space-y-1", children: _jsxs("div", { className: "flex items-start gap-2", children: [_jsx(Info, { size: 14, className: "shrink-0 mt-0.5 text-blue-600" }), _jsxs("div", { children: [_jsx("p", { className: "font-semibold text-blue-900 mb-1", children: "Trending banners require square images (1:1 ratio)" }), _jsxs("p", { className: "text-[11px] text-blue-700", children: ["Upload any image, then use the ", _jsx("strong", { children: "Crop" }), " button to adjust it to 600\u00D7600px. This applies to the mobile image \u2014 the optional web image below uses its own wide presets. The preview below shows exactly how it will appear."] })] })] }) })), watchedPlacement === 'strip' && (_jsx("div", { className: "bg-purple-50 border border-purple-200 rounded-lg p-3 text-xs text-purple-800 space-y-1", children: _jsxs("div", { className: "flex items-start gap-2", children: [_jsx(Info, { size: 14, className: "shrink-0 mt-0.5 text-purple-600" }), _jsxs("div", { children: [_jsx("p", { className: "font-semibold text-purple-900 mb-1", children: "Promo strip tiles use a fixed 3:4 ratio image" }), _jsxs("p", { className: "text-[11px] text-purple-700", children: ["Use the ", _jsx("strong", { children: "Crop" }), " button and pick the ", _jsx("strong", { children: "Promotional Strip (3:4)" }), " preset. The image fills the tile edge-to-edge and the tile label shows in a bar below it, so nothing overlaps the picture."] })] })] }) })), _jsx(BannerImageField, { variant: "mobile", title: "Mobile Image", description: supportsWebImage
                                            ? watchedPlacement === 'trending'
                                                ? 'Shown on phones, below the 640px breakpoint. Square 1:1.'
                                                : 'Shown on phones, below the 640px breakpoint. Portrait 4:5 works best.'
                                            : 'Shown on phones, below the 640px breakpoint.', emptyHint: watchedPlacement === 'trending'
                                            ? "After upload, you'll crop to 600×600px"
                                            : 'Drag file or click to select', cropLabel: watchedPlacement === 'trending'
                                            ? 'Crop to 600×600px (Required)'
                                            : 'Edit Crop', isEdit: isEdit, existingUrl: banner?.image_url, slot: mobileImage, update: (patch) => setMobileImage((s) => ({ ...s, ...patch })), onCropRequest: requestCrop }), supportsWebImage && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-sky-800", children: [_jsx(Info, { size: 14, className: "shrink-0 mt-0.5 text-sky-600" }), _jsxs("div", { children: [_jsx("p", { className: "font-semibold text-sky-900 mb-1", children: "Separate web image (optional)" }), _jsx("p", { className: "text-[11px] text-sky-700", children: "The carousel is much wider on desktop, so a phone crop gets cut off. Upload a wide image here and it replaces the mobile one from 640px upwards. Leave it empty and the mobile image is used everywhere, as before." })] })] }), _jsx(BannerImageField, { variant: "web", title: "Web Image", description: "Shown on desktop and tablet, 640px and up.", emptyHint: "Wide image, e.g. 1920\u00D7824px", cropLabel: "Crop Web Image", isEdit: isEdit, existingUrl: banner?.image_url_web, slot: webImage, update: (patch) => setWebImage((s) => ({ ...s, ...patch })), onCropRequest: requestCrop })] }))] })), watchedPlacement === 'hero' && (_jsx(BannerPreview, { title: watchedTitle || '', subtitle: watchedSubtitle || '', bgColor: watchedBgColor, textColor: watchedTextColor, ctaText: watchedCtaText || '', imageSrc: previewImageSrc })), watchedPlacement === 'trending' && (_jsx(TrendingBannerPreview, { title: watchedTitle || '', subtitle: watchedSubtitle || '', bgColor: watchedBgColor, textColor: watchedTextColor, ctaText: watchedCtaText || '', imageSrc: previewImageSrc })), supportsWebImage && (_jsxs("div", { className: "mt-4 p-4 border rounded-xl bg-gray-50", children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsx("p", { className: "text-[11px] font-semibold text-gray-400 uppercase tracking-wider", children: "Desktop Preview (640px and up)" }), _jsx("div", { className: "text-[10px] text-gray-500 bg-white px-2 py-1 rounded border", children: webPreviewImageSrc ? 'Using web image' : 'Falling back to mobile image' })] }), _jsx("div", { className: "relative w-full aspect-[21/9] overflow-hidden rounded-xl border-2 border-gray-300 shadow-lg", style: { backgroundColor: watchedBgColor }, children: webPreviewImageSrc ? (_jsx("img", { src: webPreviewImageSrc, alt: "", className: "absolute inset-0 h-full w-full object-cover", onError: (e) => {
                                                e.currentTarget.style.display = 'none';
                                            } })) : (_jsx("div", { className: "absolute inset-0 flex items-center justify-center text-gray-400 text-xs", children: "No web image \u2014 desktop shows the mobile image" })) })] })), watchedPlacement === 'highlight' && (_jsx(HighlightCardPreview, { title: watchedTitle || '', subtitle: watchedSubtitle || '', bgColor: watchedBgColor, textColor: watchedTextColor, imageSrc: previewImageSrc })), watchedPlacement === 'page' && (_jsxs("div", { className: "mt-4 p-4 border rounded-xl bg-gray-50", children: [_jsx("p", { className: "text-[11px] font-semibold text-gray-400 mb-2 uppercase tracking-wider", children: "Page Banner Strip" }), _jsx("div", { className: "h-[60px] w-full overflow-hidden rounded-lg border border-gray-200", style: { backgroundColor: watchedBgColor }, children: previewImageSrc ? (_jsx("img", { src: previewImageSrc, alt: "", className: "h-full w-full object-cover object-center", onError: (e) => {
                                                e.currentTarget.style.display = 'none';
                                            } })) : (_jsx("div", { className: "flex h-full items-center justify-center px-4 text-center", children: _jsx("span", { className: "text-xs font-bold", style: { color: watchedTextColor }, children: watchedTitle || 'Shop Wide Offer' }) })) })] })), watchedPlacement === 'strip' && (_jsxs("div", { className: "mt-4 p-4 border rounded-xl bg-gray-50", children: [_jsx("p", { className: "text-[11px] font-semibold text-gray-400 mb-2 uppercase tracking-wider", children: "Promo Strip Tile Preview" }), _jsxs("div", { className: "flex gap-3", children: [_jsxs("div", { className: "w-[130px] shrink-0 aspect-[3/4] rounded-xl overflow-hidden relative border border-gray-200 shadow-sm flex flex-col bg-gray-100", children: [_jsx("div", { className: "relative flex-1 min-h-0", children: previewImageSrc ? (_jsx("img", { src: previewImageSrc, alt: "", className: "absolute inset-0 w-full h-full object-cover", onError: (e) => { e.currentTarget.style.display = 'none'; } })) : (_jsx("div", { className: "w-full h-full flex items-center justify-center px-2 text-center", children: _jsx("span", { className: "text-[10px] font-bold text-gray-500", children: "Image preview" }) })) }), _jsx("div", { className: "relative bg-white px-2 py-1.5 border-t", children: _jsx("span", { className: "text-[11px] font-bold text-gray-800 leading-tight block text-center truncate", children: watchedTitle || 'Tile Label' }) })] }), _jsxs("div", { className: "flex-1 text-[10px] text-gray-500 leading-relaxed", children: [_jsx("p", { className: "font-semibold text-gray-700 mb-1", children: "Fixed tile = 3:4 ratio" }), _jsxs("p", { children: ["The image fills the tile edge-to-edge and the label bar sits below it, so nothing overlaps the picture. Crop your upload with the", ' ', _jsx("strong", { children: "Promotional Strip (3:4)" }), " preset."] })] })] })] })), watchedPlacement === 'product_strip' && (_jsxs("div", { className: "mt-4 p-4 border rounded-xl bg-gray-50", children: [_jsx("p", { className: "text-[11px] font-semibold text-gray-400 mb-2 uppercase tracking-wider", children: "Product Strip Preview" }), _jsx("div", { className: "h-[50px] w-full overflow-hidden rounded-lg border border-gray-200", style: { backgroundColor: watchedBgColor }, children: previewImageSrc ? (_jsx("img", { src: previewImageSrc, alt: "", className: "h-full w-full object-cover object-center", onError: (e) => {
                                                e.currentTarget.style.display = 'none';
                                            } })) : (_jsx("div", { className: "flex h-full items-center justify-center px-4 text-center", children: _jsx("span", { className: "text-[10px] font-bold", style: { color: watchedTextColor }, children: watchedTitle || 'Free Delivery — Shop Now' }) })) }), _jsx("p", { className: "text-[10px] text-gray-400 mt-1.5", children: "Appears below the Buy It Now button on product pages." })] })), _jsxs("div", { className: "flex gap-3 pt-4 border-t bg-white", children: [_jsx("button", { type: "button", onClick: onClose, className: "flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50 transition", children: "Cancel" }), _jsx("button", { type: "submit", disabled: submitting, className: "flex-1 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/95 disabled:opacity-60 transition", children: submitting ? 'Saving...' : 'Save Banner' })] })] })] }), _jsx(ImageCropModal, { isOpen: cropModalOpen, imageSrc: cropImageSrc || '', placement: watchedPlacement, useServerCrop: useServerCrop, bannerId: banner?.id, variant: cropVariant, onCropComplete: handleCropComplete, onServerCropComplete: handleServerCropComplete, onClose: () => {
                    setCropModalOpen(false);
                    setCropImageSrc(null);
                } })] }));
}
// ── Main Page ──────────────────────────────────────────────────────────────
export default function BannersAdminPage() {
    const queryClient = useQueryClient();
    const [activePlacement, setActivePlacement] = useState('hero');
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [editingBanner, setEditingBanner] = useState(null);
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);
    const { data: banners = EMPTY_BANNERS, isLoading, refetch, } = useQuery({
        queryKey: ['admin-banners', activePlacement],
        queryFn: () => api
            .get(`/banners/admin?placement=${activePlacement}`)
            .then((r) => r.data),
    });
    const [localBanners, setLocalBanners] = useState(banners);
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
    const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, {
        coordinateGetter: sortableKeyboardCoordinates,
    }));
    const handleDragEnd = useCallback(async (event) => {
        const { active, over } = event;
        if (!over || active.id === over.id)
            return;
        const oldIndex = localBanners.findIndex((b) => b.id === active.id);
        const newIndex = localBanners.findIndex((b) => b.id === over.id);
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
        }
        catch {
            toast.error('Failed to reorder');
            refetch();
        }
    }, [localBanners, activePlacement, queryClient, refetch]);
    async function handleToggle(id) {
        try {
            await api.patch(`/banners/admin/${id}/toggle`);
            refetch();
            queryClient.invalidateQueries({
                queryKey: ['banners', activePlacement],
            });
            toast.success('Status toggled');
        }
        catch {
            toast.error('Failed to toggle status');
        }
    }
    async function handleDelete(id) {
        try {
            await api.delete(`/banners/admin/${id}`);
            setDeleteConfirmId(null);
            refetch();
            queryClient.invalidateQueries({
                queryKey: ['banners', activePlacement],
            });
            toast.success('Banner deleted');
        }
        catch {
            toast.error('Failed to delete banner');
        }
    }
    function openEditDrawer(banner) {
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
            queryKey: ['banners'],
        });
    }
    const activePlacementInfo = useMemo(() => {
        return PLACEMENTS.find((p) => p.key === activePlacement) || PLACEMENTS[0];
    }, [activePlacement]);
    return (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex flex-col sm:flex-row sm:items-center justify-between gap-3", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-xl sm:text-2xl font-bold text-gray-900", children: "Banner Management" }), _jsx("p", { className: "text-xs text-gray-500 mt-0.5", children: "Control advertisements, announcement banners, and page spotlights." })] }), _jsxs("button", { onClick: openAddDrawer, className: "px-4 py-2.5 bg-primary hover:bg-primary/95 text-white text-sm rounded-lg font-semibold flex items-center gap-2 transition shrink-0", children: [_jsx(Plus, { size: 16 }), " Add Banner"] })] }), _jsx("div", { className: "flex gap-2 overflow-x-auto pb-1 scrollbar-hide", children: PLACEMENTS.map((p) => (_jsx("button", { onClick: () => setActivePlacement(p.key), className: `px-4 py-2 text-xs font-semibold rounded-full whitespace-nowrap transition-colors border ${activePlacement === p.key
                        ? 'bg-primary text-white border-primary'
                        : 'bg-white text-gray-600 hover:bg-gray-100 border-gray-200'}`, children: p.label }, p.key))) }), _jsxs("div", { className: "bg-white border rounded-xl p-4 flex gap-3 shadow-sm", children: [_jsx("div", { className: "bg-primary/10 w-9 h-9 rounded-lg flex items-center justify-center text-primary shrink-0", children: _jsx(Layout, { size: 18 }) }), _jsxs("div", { children: [_jsx("h3", { className: "font-bold text-sm text-gray-800", children: activePlacementInfo.label }), _jsx("p", { className: "text-xs text-gray-500 mt-0.5", children: activePlacementInfo.description }), _jsxs("p", { className: "text-[11px] text-[#2D6A4F] font-semibold mt-1.5 flex items-center gap-1", children: [_jsx(Info, { size: 12 }), " ", activePlacementInfo.helpText] })] })] }), _jsx("div", { className: "bg-white rounded-xl border overflow-hidden shadow-sm", children: isLoading ? (_jsx("div", { className: "px-4 py-12 text-center text-gray-400 text-sm", children: "Loading active banners list..." })) : localBanners.length === 0 ? (_jsxs("div", { className: "px-4 py-12 text-center text-gray-400 text-sm", children: ["No banners configured for this section yet.", ' ', _jsx("button", { onClick: openAddDrawer, className: "text-primary font-semibold hover:underline", children: "Add one now" })] })) : (_jsx(DndContext, { sensors: sensors, collisionDetection: closestCenter, onDragEnd: handleDragEnd, children: _jsx(SortableContext, { items: localBanners.map((b) => b.id), strategy: verticalListSortingStrategy, children: _jsx("div", { className: "divide-y", children: localBanners.map((banner) => (_jsx(SortableBannerRow, { banner: banner, onEdit: openEditDrawer, onToggle: handleToggle, onDelete: handleDelete, deleteConfirmId: deleteConfirmId, setDeleteConfirmId: setDeleteConfirmId }, banner.id))) }) }) })) }), drawerOpen && (_jsx(BannerDrawer, { banner: editingBanner, placement: activePlacement, onClose: () => {
                    setDrawerOpen(false);
                    setEditingBanner(null);
                }, onSaved: handleDrawerSaved }))] }));
}
