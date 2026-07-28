import { useCallback, useEffect, useRef, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Edit2,
  Plus,
  Search,
  Trash2,
  X,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  AlertTriangle,
  Upload,
  Loader2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useProduct, useProductRaw, useProducts } from '@/hooks/useProducts';
import { useCategories } from '@/hooks/useCategories';
import { useDeleteProduct } from '@/hooks/useAdmin';
import api from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import type { Product, ProductListResponse, ProductVariants } from '@/types';

type ProductFormData = z.infer<typeof productSchema>;

// ─── Flexible Variant Draft Types ──────────────────────────────────────────
// ⚠️ image_keys = relative storage keys sent to backend. image_urls = preview only.
type VariantOptionDraft = {
  id: string;           // stable ID – preserved for existing options, generated for new
  name: string;
  price: number;
  stock: number;
  image_keys: string[];  // relative keys array, stored in DB
  image_urls: string[];  // resolved URLs array, display only
  color_hex: string;     // optional hex color for colour-type variants
  uploading: boolean;
};

type VariantGroupDraft = {
  id: string;           // stable ID – preserved for existing groups, generated for new
  label: string;
  options: VariantOptionDraft[];
};

function genId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function emptyOption(): VariantOptionDraft {
  return { id: genId('opt'), name: '', price: 0, stock: 0, image_keys: [], image_urls: [], color_hex: '', uploading: false };
}

function emptyGroup(): VariantGroupDraft {
  return { id: genId('vg'), label: '', options: [emptyOption()] };
}

const productSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  description: z.string().optional(),
  price: z.coerce.number().positive('Price must be a positive number'),
  original_price: z.coerce.number().positive().optional().or(z.literal(0)),
  stock_qty: z.coerce.number().int().min(0, 'Stock cannot be negative'),
  category_id: z.coerce.number().int().positive('Please select a category'),
  badge: z.string().optional(),
  sunlight: z.string().optional(),
  watering: z.string().optional(),
  how_to_guide: z.string().optional(),
  tags: z.array(z.object({ value: z.string() })).optional(),
  care_tips: z.array(z.object({ value: z.string() })).optional(),
});

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/**
 * Crops an image file to a centered square and returns a new File.
 * This ensures the product carousel always receives uniform square images.
 *
 * Uses createImageBitmap so the browser applies EXIF rotation automatically
 * before we ever touch the canvas — phone photos with rotation metadata
 * will render correctly without any manual EXIF parsing.
 *
 * Preserves PNG transparency (keeps format as image/png). Everything else
 * is output as JPEG at 92% quality so product cutouts with transparent
 * backgrounds aren't flattened to a solid color.
 */
async function cropToSquare(file: File): Promise<File> {
  // createImageBitmap applies EXIF orientation for us
  const bitmap = await createImageBitmap(file);

  const size = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - size) / 2;
  const sy = (bitmap.height - size) / 2;

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const isPng = file.type === 'image/png';
  if (!isPng) {
    // Fill with white so any semi-transparent edge pixels don't go black
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
  }

  ctx.drawImage(bitmap, sx, sy, size, size, 0, 0, size, size);
  bitmap.close();

  return new Promise((resolve, reject) => {
    const outputType = isPng ? 'image/png' : 'image/jpeg';
    const quality = isPng ? undefined : 0.92;
    canvas.toBlob(
      (blob) => {
        if (!blob) { reject(new Error('Canvas toBlob failed')); return; }
        resolve(new File([blob], file.name, { type: outputType, lastModified: Date.now() }));
      },
      outputType,
      quality,
    );
  });
}

function ProductModal({ onClose, editProduct }: { onClose: () => void; editProduct?: Product | null }) {
  const isEdit = !!editProduct;
  // useProduct (public endpoint, resolved URLs) — used for display fields only (name, price, etc.)
  const { data: freshProduct, isLoading: isLoadingProduct } = useProduct(editProduct?.slug ?? '');
  // useProductRaw (admin endpoint, raw relative keys) — used to seed image key state for edit
  const { data: rawProduct } = useProductRaw(isEdit ? (editProduct?.id ?? null) : null);
  const { data: categories } = useCategories();
  const qc = useQueryClient();
  const allCats = categories?.flatMap((c) => [c, ...(c.children ?? [])]) ?? [];
  const [submitting, setSubmitting] = useState(false);
  const [variantError, setVariantError] = useState<string | null>(null);
  const [formInitialized, setFormInitialized] = useState(!isEdit);

  // Form Collapsible Sections
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    basic: true,
    pricing: true,
    details: false,
    images: false,
    variants: false,
    seo: false,
  });

  const toggleSection = (section: string) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  // Image Management
  const [productImages, setProductImages] = useState<string[]>([]);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<string[]>([]);

  const handleAddImageUrl = () => {
    if (newImageUrl.trim()) {
      setProductImages([...productImages, newImageUrl.trim()]);
      setNewImageUrl('');
    }
  };

  const handleRemoveImageUrl = (index: number) => {
    setProductImages(productImages.filter((_, i) => i !== index));
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const cropped = await Promise.all(Array.from(files).map(cropToSquare));
    setUploadedFiles((prev) => [...prev, ...cropped]);
    const previews = cropped.map((f) => URL.createObjectURL(f));
    setFilePreviews((prev) => [...prev, ...previews]);
  };

  const handleRemoveFile = (index: number) => {
    setUploadedFiles(uploadedFiles.filter((_, i) => i !== index));
    setFilePreviews(filePreviews.filter((_, i) => i !== index));
  };

  // Variant States — new flexible variant groups
  const [variantGroups, setVariantGroups] = useState<VariantGroupDraft[]>([]);
  const [uploadingOptionImage, setUploadingOptionImage] = useState<string | null>(null); // optionId
  const [uploadingDefaultImage, setUploadingDefaultImage] = useState(false);
  // defaultImageKey: relative key sent to backend. defaultImageUrl: full URL for preview only.
  const [defaultImageKey, setDefaultImageKey] = useState('');
  const [defaultImageUrl, setDefaultImageUrl] = useState('');
  // Combo image map: keyed by "optId1__optId2__..." joining one optId per group in group order.
  // image_keys = relative keys (sent to backend). image_urls = resolved URLs (display only).
  const [comboImageKeys, setComboImageKeys] = useState<Record<string, string[]>>({});
  const [comboImageUrls, setComboImageUrls] = useState<Record<string, string[]>>({});
  const [uploadingComboKey, setUploadingComboKey] = useState<string | null>(null);
  // Care items — flexible list of {icon_key, icon_url, title, description}
  type CareItemDraft = { title: string; description: string; icon_key: string; icon_url: string; uploading: boolean };
  const [careItems, setCareItems] = useState<CareItemDraft[]>([]);

  // True once form fields are initialized. For new products this is immediate.
  const formReady = formInitialized;

  // Derive a display URL from a relative storage key.
  // Full URLs pass through unchanged (external images, legacy data).
  function resolveImageUrl(key: string | null | undefined): string {
    if (!key) return '';
    if (key.startsWith('http://') || key.startsWith('https://')) return key;
    const cdn = (import.meta.env.VITE_CDN_BASE_URL as string | undefined) || '';
    if (cdn) return `${cdn.replace(/\/$/, '')}/${key.replace(/^\//, '')}`;
    const backendUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined) || '';
    return `${backendUrl.replace(/\/api\/v1$/, '').replace(/\/$/, '')}/static/${key.replace(/^\//, '')}`;
  }

  useBodyScrollLock(true);

  const { register, handleSubmit, control, reset, formState: { errors } } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema) as any,
    defaultValues: {
      name: '',
      description: '',
      price: 0,
      original_price: undefined,
      stock_qty: 0,
      category_id: undefined,
      badge: '',
      sunlight: '',
      watering: '',
      how_to_guide: '',
      tags: [],
      care_tips: [],
    },
  });
  const { fields: tagFields, append: addTag, remove: removeTag } = useFieldArray({ control, name: 'tags' });
  const { fields: tipFields, append: addTip, remove: removeTip } = useFieldArray({ control, name: 'care_tips' });

  const applyProductToForm = useCallback((p: Product) => {
    reset({
      name: p.name || '',
      description: p.description || '',
      price: p.price || 0,
      original_price: p.original_price || undefined,
      stock_qty: p.stock_qty ?? 0,
      category_id: p.category_id,
      badge: p.badge || '',
      sunlight: p.sunlight || '',
      watering: p.watering || '',
      how_to_guide: p.how_to_guide || '',
      tags: p.tags?.length ? p.tags.map((value) => ({ value })) : [],
      care_tips: p.care_tips?.length ? p.care_tips.map((value) => ({ value })) : [],
    });
    setProductImages(p.images || []);
    setNewImageUrl('');
    setUploadedFiles([]);
    setFilePreviews([]);
    setCareItems(
      (p.care_items || []).map((item: any) => ({
        title: item.title || '',
        description: item.description || '',
        icon_key: item.icon || '',
        icon_url: item.icon ? resolveImageUrl(item.icon) : '',
        uploading: false,
      }))
    );
    // Seed variant groups from new format (variant_groups)
    const vg = (p.variants as any)?.variant_groups;
    if (Array.isArray(vg)) {
      setVariantGroups(
        vg.map((group: any) => ({
          id: group.id || genId('vg'),
          label: group.label || '',
          options: (group.options || []).map((opt: any) => ({
            id: opt.id || genId('opt'),
            name: opt.name || '',
            price: Number(opt.price ?? 0),
            stock: Number(opt.stock ?? 0),
            // images are already resolved URLs from the API; store first as preview
            // backend /admin/raw returns relative keys — handled in rawProduct effect
            image_keys: [],
            image_urls: opt.images?.filter(Boolean) || [],
            color_hex: opt.color_hex || '',
            uploading: false,
          })),
        }))
      );
    } else {
      setVariantGroups([]);
    }
    setDefaultImageKey('');
    setDefaultImageUrl('');
    setComboImageKeys({});
    setComboImageUrls({});
    setVariantError(null);
  }, [reset]);
  // Seed default_image from the raw admin endpoint (relative key, not resolved URL).
  // Runs once per product load; guard prevents re-seeding on background refetches.
  const seededForProductIdRef = useRef<number | null>(null);
  useEffect(() => {
    if (!isEdit || !rawProduct) return;
    const incomingId = rawProduct.id ?? null;
    if (seededForProductIdRef.current === incomingId) return;
    seededForProductIdRef.current = incomingId;

    const v = (rawProduct as any).variants || {};
    // Seed default image relative key
    setDefaultImageKey(v.default_image || '');
    setDefaultImageUrl(resolveImageUrl(v.default_image));

    // Seed combo image_map from raw product
    if (v.image_map && typeof v.image_map === 'object') {
      const seedKeys: Record<string, string[]> = {};
      const seedUrls: Record<string, string[]> = {};
      Object.entries(v.image_map as Record<string, string[]>).forEach(([key, imgs]) => {
        if (Array.isArray(imgs) && imgs.length > 0) {
          seedKeys[key] = imgs.filter(Boolean);
          seedUrls[key] = imgs.filter(Boolean).map((k: string) => resolveImageUrl(k));
        }
      });
      setComboImageKeys(seedKeys);
      setComboImageUrls(seedUrls);
    }

    // Seed per-option image keys from raw variant_groups
    if (Array.isArray(v.variant_groups)) {
      setVariantGroups(prev => prev.map((group) => {
        const rawGroup = v.variant_groups.find((rg: any) => rg.id === group.id);
        if (!rawGroup) return group;
        return {
          ...group,
          options: group.options.map((opt) => {
            const rawOpt = rawGroup.options?.find((ro: any) => ro.id === opt.id);
            if (!rawOpt) return opt;
            const rawKeys: string[] = (rawOpt.images || []).filter(Boolean);
            const rawUrls = rawKeys.map((k: string) => resolveImageUrl(k));
            return {
              ...opt,
              image_keys: rawKeys.length ? rawKeys : opt.image_keys,
              image_urls: rawKeys.length ? rawUrls : opt.image_urls,
              color_hex: rawOpt.color_hex || opt.color_hex,
            };
          }),
        };
      }));
    }
  }, [isEdit, rawProduct]);

  useEffect(() => {
    if (!isEdit) return;
    const source = freshProduct ?? editProduct;
    if (source && !formInitialized) {
      applyProductToForm(source);
      setFormInitialized(true);
    }
  }, [isEdit, freshProduct, editProduct, formInitialized, applyProductToForm]);

  async function onSubmit(data: ProductFormData) {
    setSubmitting(true);
    try {
      setVariantError(null);
      let variants: ProductVariants | null = null;

      // Build new variant_groups payload
      const cleanGroups = variantGroups.filter(g => g.label.trim());
      
      // Validate each group has a label and at least one named option
      for (const group of cleanGroups) {
        if (!group.label.trim()) {
          setVariantError('Each variant type must have a label (e.g. "Select Size").');
          setSubmitting(false);
          return;
        }
        const cleanOpts = group.options.filter(o => o.name.trim());
        if (cleanOpts.length === 0) {
          setVariantError(`Variant type "${group.label}" must have at least one option.`);
          setSubmitting(false);
          return;
        }
      }

      if (cleanGroups.length > 0 || defaultImageKey.trim()) {
        // Build image_map: only include combos that actually have images
        const imageMap: Record<string, string[]> = {};
        Object.entries(comboImageKeys).forEach(([key, keys]) => {
          if (keys.length > 0) imageMap[key] = keys;
        });

        variants = {
          variant_groups: cleanGroups.map(group => ({
            id: group.id,
            label: group.label.trim(),
            options: group.options
              .filter(o => o.name.trim())
              .map(o => ({
                id: o.id,
                name: o.name.trim(),
                price: Number(o.price || 0),
                stock: Number(o.stock || 0),
                // Per-option images — used as colour fallback on product page
                ...(o.image_keys.length ? { images: o.image_keys } : {}),
                ...(o.color_hex.trim() ? { color_hex: o.color_hex.trim() } : {}),
              })),
          })),
          ...(Object.keys(imageMap).length ? { image_map: imageMap } : {}),
          default_image: defaultImageKey || undefined,
        };
      }

      // Total stock: sum all option stocks across all groups (use first group's stock sum)
      // If no variants, use the form field value
      const totalStock = variants?.variant_groups?.length
        ? variants.variant_groups[0].options.reduce((sum, o) => sum + Number(o.stock || 0), 0)
        : data.stock_qty;

      const cleanCareItems = careItems
        .map((c) => ({
          icon: c.icon_key || null,
          title: c.title.trim(),
          description: c.description.trim(),
        }))
        .filter((c) => c.title || c.description || c.icon);

      const invalidCareItem = cleanCareItems.find(c => !c.title || !c.description);
      if (invalidCareItem) {
        toast.error('Please enter a title and description for each care tile.');
        setSubmitting(false);
        return;
      }

      type ProductPayload = {
        name: string;
        description: string;
        price: number;
        original_price: number | null;
        stock_qty: number;
        category_id: number;
        badge: string | null;
        sunlight: string | null;
        watering: string | null;
        care_items: { icon: string | null; title: string; description: string }[];
        how_to_guide: string | null;
        tags: string[];
        care_tips: string[];
        variants?: ProductVariants;
      };
      const payload: ProductPayload = {
        name: data.name,
        description: data.description || '',
        price: data.price,
        original_price: data.original_price || null,
        stock_qty: totalStock,
        category_id: data.category_id,
        badge: data.badge || null,
        sunlight: data.sunlight || null,
        watering: data.watering || null,
        care_items: cleanCareItems,
        how_to_guide: data.how_to_guide?.trim() || null,
        tags: data.tags?.map((t) => t.value).filter(Boolean) || [],
        care_tips: data.care_tips?.map((t) => t.value).filter(Boolean) || [],
      };
      if (variants !== null) {
        payload.variants = variants;
      }

      if (editProduct) {
        // Upload any newly selected files first
        const uploadedUrls: string[] = [];
        for (const file of uploadedFiles) {
          const squared = await cropToSquare(file);
          const fd = new FormData();
          fd.append('image', squared);
          fd.append('product_id', String(editProduct.id));
          const { data: uploadResult } = await api.post<{ url: string }>('/products/upload-image', fd);
          uploadedUrls.push(uploadResult.url);
        }

        const finalImages = [...productImages, ...uploadedUrls];

        // Edit page updates via JSON PUT (including product images URL list)
        const updatePayload = {
          ...payload,
          images: finalImages,
        };
        const { data: updatedProduct } = await api.put<Product>(`/products/${editProduct.id}`, updatePayload);
        toast.success('Product updated successfully!');

        // Update the product detail cache immediately
        qc.setQueryData(['product', updatedProduct.slug], updatedProduct);

        // Patch every cached products-list page that contains this product so
        // the admin list reflects the new stock/images without waiting for a refetch
        qc.setQueriesData<ProductListResponse>({ queryKey: ['products'] }, (old) => {
          if (!old) return old;
          return {
            ...old,
            items: old.items.map((p) => (p.id === updatedProduct.id ? updatedProduct : p)),
          };
        });

        // Still invalidate so stale data is refreshed in the background
        qc.invalidateQueries({ queryKey: ['products'] });
        qc.invalidateQueries({ queryKey: ['product', updatedProduct.slug] });
        // Invalidate the raw admin cache so the next edit re-fetches fresh image keys.
        qc.invalidateQueries({ queryKey: ['product-raw', editProduct.id] });
      } else {
        // New creation uses FormData to support file uploads
        const fd = new FormData();
        fd.append('name', payload.name);
        fd.append('price', String(payload.price));
        fd.append('category_id', String(payload.category_id));
        fd.append('description', payload.description);
        if (payload.original_price) fd.append('original_price', String(payload.original_price));
        fd.append('stock_qty', String(payload.stock_qty));
        fd.append('tags', JSON.stringify(payload.tags));
        fd.append('care_tips', JSON.stringify(payload.care_tips));
        if (payload.badge) fd.append('badge', payload.badge);
        if (payload.sunlight) fd.append('sunlight', payload.sunlight);
        if (payload.watering) fd.append('watering', payload.watering);
        if (payload.care_items?.length) fd.append('care_items', JSON.stringify(payload.care_items));
        if (payload.how_to_guide) fd.append('how_to_guide', payload.how_to_guide);
        if (payload.variants) fd.append('variants', JSON.stringify(payload.variants));
        fd.append('image_urls', JSON.stringify(productImages));

        // Add file uploads
        for (const file of uploadedFiles) {
          fd.append('images', file);
        }

        await api.post('/products', fd);
        toast.success('Product created successfully!');
        await qc.invalidateQueries({ queryKey: ['products'] });
      }
      setUploadedFiles([]);
      setFilePreviews([]);
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to save product');
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass = "w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors";

  // hasVariants: true if any groups exist or default image is set
  const hasVariants = variantGroups.length > 0 || defaultImageKey.trim().length > 0;

  async function handleOptionImageUpload(groupId: string, optionId: string, file?: File) {
    if (!file) return;
    setUploadingOptionImage(optionId);
    try {
      const squared = await cropToSquare(file);
      const fd = new FormData();
      fd.append('image', squared);
      if (editProduct?.id) fd.append('product_id', String(editProduct.id));
      const { data } = await api.post<{ key: string; url: string }>('/products/variant-image', fd);
      setVariantGroups(prev => prev.map(g =>
        g.id !== groupId ? g : {
          ...g,
          options: g.options.map(o =>
            o.id !== optionId ? o : {
              ...o,
              image_keys: [...o.image_keys, data.key],
              image_urls: [...o.image_urls, data.url],
            }
          ),
        }
      ));
      toast.success('Image uploaded');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to upload image');
    } finally {
      setUploadingOptionImage(null);
    }
  }

  function handleRemoveOptionImage(groupId: string, optionId: string, index: number) {
    setVariantGroups(prev => prev.map(g =>
      g.id !== groupId ? g : {
        ...g,
        options: g.options.map(o =>
          o.id !== optionId ? o : {
            ...o,
            image_keys: o.image_keys.filter((_, i) => i !== index),
            image_urls: o.image_urls.filter((_, i) => i !== index),
          }
        ),
      }
    ));
  }

  // ─── Cartesian product helper ────────────────────────────────────────────
  // Returns rows of { key: "optId1__optId2__...", label: "Name1 / Name2 / ..." }
  // Only includes named, named options. Capped at COMBO_CAP rows.
  const COMBO_CAP = 50;
  function buildComboRows(groups: VariantGroupDraft[]): { key: string; label: string }[] {
    const namedGroups = groups
      .map(g => ({ ...g, options: g.options.filter(o => o.name.trim()) }))
      .filter(g => g.label.trim() && g.options.length > 0);
    if (namedGroups.length === 0) return [];
    // Cartesian product
    let rows: { key: string; label: string }[] = [{ key: '', label: '' }];
    for (const group of namedGroups) {
      const next: { key: string; label: string }[] = [];
      for (const row of rows) {
        for (const opt of group.options) {
          next.push({
            key: row.key ? `${row.key}__${opt.id}` : opt.id,
            label: row.label ? `${row.label} / ${opt.name}` : opt.name,
          });
        }
      }
      rows = next;
    }
    return rows;
  }

  // ─── Combo image upload / remove ────────────────────────────────────────
  async function handleComboImageUpload(comboKey: string, file?: File) {
    if (!file) return;
    const current = comboImageKeys[comboKey] || [];
    if (current.length >= 8) { toast.error('Limit of 8 images per combination'); return; }
    setUploadingComboKey(comboKey);
    try {
      const squared = await cropToSquare(file);
      const fd = new FormData();
      fd.append('image', squared);
      if (editProduct?.id) fd.append('product_id', String(editProduct.id));
      const { data } = await api.post<{ key: string; url: string }>('/products/variant-image', fd);
      setComboImageKeys(prev => ({ ...prev, [comboKey]: [...(prev[comboKey] || []), data.key] }));
      setComboImageUrls(prev => ({ ...prev, [comboKey]: [...(prev[comboKey] || []), data.url] }));
      toast.success('Combination image uploaded');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to upload combination image');
    } finally {
      setUploadingComboKey(null);
    }
  }

  function handleRemoveComboImage(comboKey: string, index: number) {
    setComboImageKeys(prev => ({ ...prev, [comboKey]: (prev[comboKey] || []).filter((_, i) => i !== index) }));
    setComboImageUrls(prev => ({ ...prev, [comboKey]: (prev[comboKey] || []).filter((_, i) => i !== index) }));
  }

  async function handleDefaultImageUpload(file?: File) {
    if (!file) return;
    setUploadingDefaultImage(true);
    try {
      const squared = await cropToSquare(file);
      const fd = new FormData();
      fd.append('image', squared);
      if (editProduct?.id) fd.append('product_id', String(editProduct.id));
      const { data } = await api.post<{ key: string; url: string }>('/products/upload-image', fd);
      // key → stored in payload; url → display only
      setDefaultImageKey(data.key);
      setDefaultImageUrl(data.url);
      toast.success('Default image uploaded');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to upload default image');
    } finally {
      setUploadingDefaultImage(false);
    }
  }

  async function handleCareIconUpload(index: number, file?: File) {
    if (!file) return;
    setCareItems(prev => prev.map((c, i) => i === index ? { ...c, uploading: true } : c));
    try {
      const squared = await cropToSquare(file);
      const fd = new FormData();
      fd.append('image', squared);
      if (editProduct?.id) fd.append('product_id', String(editProduct.id));
      const { data } = await api.post<{ key: string; url: string }>('/products/variant-image', fd);
      setCareItems(prev => prev.map((c, i) => i === index ? { ...c, icon_key: data.key, icon_url: data.url, uploading: false } : c));
      toast.success('Care icon uploaded');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to upload care icon');
      setCareItems(prev => prev.map((c, i) => i === index ? { ...c, uploading: false } : c));
    }
  }

  // ─── end of handlers ──────────────────────────────────────────────────────

  if (isEdit && (isLoadingProduct || !formInitialized)) {
    return (
      <>
        <div className="fixed inset-0 bg-black/55 z-50 transition-opacity" onClick={onClose} />
        <div className="fixed inset-y-0 right-0 w-full sm:max-w-2xl bg-[#FAFAF8] shadow-2xl z-50 flex flex-col items-center justify-center">
          <p className="text-sm text-gray-500">Loading product details...</p>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/55 z-50 transition-opacity" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-full sm:max-w-2xl bg-[#FAFAF8] shadow-2xl z-50 flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-white shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{isEdit ? 'Edit Product' : 'Add New Product'}</h2>
            <p className="text-xs text-gray-500 mt-0.5">Fill out product details to display on your website</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto p-6 space-y-4">
          
          {/* Section 1: Basic Information */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection('basic')}
              className="w-full flex items-center justify-between px-5 py-4 font-semibold text-sm text-gray-800 hover:bg-gray-50 text-left"
            >
              <span className="flex items-center gap-2">📦 <span>Basic Information</span></span>
              {openSections.basic ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {openSections.basic && (
              <div className="p-5 border-t border-gray-100 space-y-4 bg-white">
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1 block">Product Name *</label>
                  <input
                    {...register('name')}
                    placeholder="e.g., Fiddle Leaf Fig"
                    className={inputClass}
                  />
                  <p className="text-[11px] text-gray-400 mt-1">This is the title customers will see on the website.</p>
                  {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-700 mb-1 block">Category *</label>
                    <select {...register('category_id')} className={inputClass}>
                      <option value="">Select Category</option>
                      {allCats.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.parent_id ? `↳ ${c.name}` : c.name}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-gray-400 mt-1">Select the collection this product belongs to.</p>
                    {errors.category_id && <p className="text-xs text-red-500 mt-1">{errors.category_id.message}</p>}
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 mb-1 block">Product Tag / Badge</label>
                    <input
                      {...register('badge')}
                      placeholder="e.g., Bestseller, New Arrival, Sale"
                      className={inputClass}
                    />
                    <p className="text-[11px] text-gray-400 mt-1">A colorful label shown over the product image.</p>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1 block">Description</label>
                  <textarea
                    {...register('description')}
                    rows={4}
                    placeholder="Provide details about the plant, its beauty, growth habits, etc."
                    className={inputClass}
                  />
                  <p className="text-[11px] text-gray-400 mt-1">HTML/Markdown and paragraphs are supported.</p>
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Pricing & Inventory */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection('pricing')}
              className="w-full flex items-center justify-between px-5 py-4 font-semibold text-sm text-gray-800 hover:bg-gray-50 text-left"
            >
              <span className="flex items-center gap-2">💰 <span>Pricing & Inventory</span></span>
              {openSections.pricing ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {openSections.pricing && (
              <div className="p-5 border-t border-gray-100 space-y-4 bg-white">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-700 mb-1 block">Selling Price (₹) *</label>
                    <input
                      type="number"
                      step="0.01"
                      {...register('price')}
                      className={inputClass}
                      placeholder="699"
                    />
                    <p className="text-[11px] text-gray-400 mt-1">Active price customers will pay.</p>
                    {errors.price && <p className="text-xs text-red-500 mt-1">{errors.price.message}</p>}
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 mb-1 block">Original Price (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      {...register('original_price')}
                      className={inputClass}
                      placeholder="999"
                    />
                    <p className="text-[11px] text-gray-400 mt-1">Shows a strikethrough sale price (e.g. <del>₹999</del>).</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 mb-1 block">Base Stock Quantity *</label>
                    <input
                      type="number"
                      {...register('stock_qty')}
                      className={inputClass}
                      placeholder="10"
                      disabled={hasVariants}
                    />
                    <p className="text-[11px] text-gray-400 mt-1">
                      {hasVariants
                        ? 'Stock is managed per variant combination below.'
                        : 'Total units available for this product.'}
                    </p>
                    {errors.stock_qty && <p className="text-xs text-red-500 mt-1">{errors.stock_qty.message}</p>}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Plant Details */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection('details')}
              className="w-full flex items-center justify-between px-5 py-4 font-semibold text-sm text-gray-800 hover:bg-gray-50 text-left"
            >
              <span className="flex items-center gap-2">🌿 <span>Plant Care Details</span></span>
              {openSections.details ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {openSections.details && (
              <div className="p-5 border-t border-gray-100 space-y-4 bg-white">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-700 mb-1 block">Sunlight Requirement</label>
                    <input
                      {...register('sunlight')}
                      placeholder="e.g., Bright indirect light, partial shade"
                      className={inputClass}
                    />
                    <p className="text-[11px] text-gray-400 mt-1">Where to place the plant for best health.</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 mb-1 block">Watering Cycle</label>
                    <input
                      {...register('watering')}
                      placeholder="e.g., Once a week, when soil is dry"
                      className={inputClass}
                    />
                    <p className="text-[11px] text-gray-400 mt-1">How often the plant needs watering.</p>
                  </div>
                </div>

                {/* Care items — repeatable list */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <label className="text-xs font-semibold text-gray-700 block">🌿 Care Card Tiles</label>
                      <p className="text-[11px] text-gray-400">Shown as a card on the product page. Add tiles like Light, Water, Soil, etc.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCareItems(prev => [...prev, { title: '', description: '', icon_key: '', icon_url: '', uploading: false }])}
                      className="px-2.5 py-1 text-xs text-primary font-medium hover:bg-primary-light/10 border border-primary/20 rounded transition"
                    >
                      + Add Tile
                    </button>
                  </div>
                  <div className="space-y-3">
                    {careItems.map((item, index) => (
                      <div key={index} className="rounded-xl border border-gray-200 p-3 bg-gray-50/40 space-y-2">
                        <div className="flex gap-2 items-start">
                          {/* Icon preview + upload */}
                          <div className="shrink-0 flex flex-col items-center gap-1">
                            <label
                              className={`group relative h-12 w-12 rounded-lg border border-gray-200 overflow-hidden bg-[#f5f5f0] flex items-center justify-center cursor-pointer transition hover:border-primary/50 hover:bg-primary-light/5 focus-within:ring-2 focus-within:ring-primary/20 ${item.uploading ? 'pointer-events-none opacity-80' : ''}`}
                              title={item.icon_key ? 'Replace care icon' : 'Upload care icon'}
                              aria-label={item.icon_key ? 'Replace care icon' : 'Upload care icon'}
                            >
                              {item.uploading ? (
                                <Loader2 size={18} className="animate-spin text-primary" />
                              ) : item.icon_url ? (
                                <>
                                  <img src={item.icon_url} alt="Care icon" className="h-12 w-12 rounded-lg object-contain" />
                                  <span className="absolute inset-0 bg-black/35 text-white text-[9px] font-medium opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 flex items-center justify-center transition">
                                    Change
                                  </span>
                                </>
                              ) : (
                                <div className="flex flex-col items-center gap-0.5 text-primary">
                                  <Upload size={15} />
                                  <span className="text-[9px] font-medium">Icon</span>
                                </div>
                              )}
                              <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                className="sr-only"
                                disabled={item.uploading}
                                onChange={(e) => { void handleCareIconUpload(index, e.target.files?.[0]); e.target.value = ''; }}
                              />
                            </label>
                            {item.icon_key && (
                              <button type="button" onClick={() => setCareItems(prev => prev.map((c, i) => i === index ? { ...c, icon_key: '', icon_url: '' } : c))}
                                className="text-[10px] text-red-500 hover:text-red-600">Remove</button>
                            )}
                            <span className="max-w-20 text-center text-[9px] leading-tight text-gray-400">Square icon recommended, e.g. 128x128px</span>
                          </div>
                          {/* Title + description */}
                          <div className="flex-1 space-y-1.5">
                            <input
                              value={item.title}
                              onChange={(e) => setCareItems(prev => prev.map((c, i) => i === index ? { ...c, title: e.target.value } : c))}
                              placeholder="Title (e.g. Light, Water, Soil)"
                              className={`${inputClass} bg-white`}
                            />
                            <input
                              value={item.description}
                              onChange={(e) => setCareItems(prev => prev.map((c, i) => i === index ? { ...c, description: e.target.value } : c))}
                              placeholder="Description (e.g. Indirect light)"
                              className={`${inputClass} bg-white`}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => setCareItems(prev => prev.filter((_, i) => i !== index))}
                            className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition shrink-0 mt-0.5"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                    {careItems.length === 0 && (
                      <p className="text-xs text-gray-400 italic text-center py-2">No care tiles added yet. Click "+ Add Tile" to add one.</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1 block">How to Guide</label>
                  <textarea
                    {...register('how_to_guide')}
                    rows={4}
                    placeholder="e.g. Use well-draining soil and keep it in a spot with soft, indirect light..."
                    className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary resize-y"
                  />
                  <p className="text-[11px] text-gray-400 mt-1">
                    Shown as a green card on the product page. Leave blank to auto-build from sunlight, watering, and care tips.
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div>
                      <label className="text-xs font-semibold text-gray-700">Care Tips / Bullet Points</label>
                      <p className="text-[11px] text-gray-400">Step-by-step tips displayed on product page.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => addTip({ value: '' })}
                      className="px-2.5 py-1 text-xs text-primary font-medium hover:bg-primary-light/10 border border-primary/20 rounded transition"
                    >
                      + Add Tip
                    </button>
                  </div>
                  <div className="space-y-2">
                    {tipFields.map((f, i) => (
                      <div key={f.id} className="flex items-center gap-2">
                        <input
                          {...register(`care_tips.${i}.value`)}
                          placeholder="e.g. Keep away from air conditioner drafts"
                          className="flex-1 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                        <button
                          type="button"
                          onClick={() => removeTip(i)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition"
                        >
                          <X size={15} />
                        </button>
                      </div>
                    ))}
                    {tipFields.length === 0 && (
                      <p className="text-xs text-gray-400 italic text-center py-2">No care tips added yet.</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 4: Images */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection('images')}
              className="w-full flex items-center justify-between px-5 py-4 font-semibold text-sm text-gray-800 hover:bg-gray-50 text-left"
            >
              <span className="flex items-center gap-2">🖼️ <span>Images & Gallery</span></span>
              {openSections.images ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {openSections.images && (
              <div className="p-5 border-t border-gray-100 space-y-4 bg-white">
                
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Upload Images (Files)</label>
                  <div className="border-2 border-dashed border-gray-200 hover:border-primary/50 rounded-xl p-6 text-center transition-colors cursor-pointer relative">
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={handleFileChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <Upload size={28} className="mx-auto text-gray-400 mb-2" />
                    <p className="text-xs font-medium text-gray-700">Click or drag images here to upload</p>
                    <p className="text-[10px] text-gray-400 mt-1">Supports JPG, PNG, WEBP. Max 5MB per file.</p>
                  </div>

                  {filePreviews.length > 0 && (
                    <div className="grid grid-cols-4 gap-3 mt-4">
                      {filePreviews.map((preview, idx) => (
                        <div key={idx} className="relative aspect-square border rounded-lg overflow-hidden group">
                          <img src={preview} alt="Upload preview" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => handleRemoveFile(idx)}
                            className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 shadow transition opacity-90"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>


                {/* Manage URLs for both New and Existing */}
                <div>
                  <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Image URLs List</label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={newImageUrl}
                      onChange={(e) => setNewImageUrl(e.target.value)}
                      placeholder="Paste image web address (https://...)"
                      className="flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddImageUrl}
                      className="px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/95 transition font-semibold"
                    >
                      Add URL
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">You can also paste links from Unsplash, ImageKit, or external hosting.</p>

                  {productImages.length > 0 && (
                    <div className="grid grid-cols-4 gap-3 mt-4">
                      {productImages.map((url, idx) => (
                        <div key={idx} className="relative aspect-square border rounded-lg overflow-hidden group bg-gray-50">
                          <img src={url} alt="Gallery" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => handleRemoveImageUrl(idx)}
                            className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 shadow transition opacity-90"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {productImages.length === 0 && !filePreviews.length && (
                    <p className="text-xs text-gray-400 italic text-center py-4 border rounded-xl bg-gray-50/50 mt-4">No images added yet.</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Section 5: Variants */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection('variants')}
              className="w-full flex items-center justify-between px-5 py-4 font-semibold text-sm text-gray-800 hover:bg-gray-50 text-left"
            >
              <span className="flex items-center gap-2">🎨 <span>Product Variants (Advanced)</span></span>
              {openSections.variants ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {openSections.variants && (
              <div className="p-5 border-t border-gray-100 space-y-5 bg-white">
                <div className="rounded-lg bg-green-50 border border-green-100 p-3 text-xs text-green-800 leading-relaxed">
                  <strong>How variants work:</strong> Click &ldquo;+ Add Variant Type&rdquo;, type a label (e.g. &ldquo;Select Size&rdquo;, &ldquo;Select Packet Size&rdquo;), then add options with name, price, and stock. Admin controls all labels — no category rules.
                </div>

                {variantError && (
                  <div className="rounded-lg bg-red-50 border border-red-100 p-3 flex gap-2 text-xs text-red-800">
                    <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                    <span>{variantError}</span>
                  </div>
                )}

                {/* Dynamic Variant Groups */}
                <div className="space-y-3">
                  {variantGroups.map((group) => (
                    <div key={group.id} className="rounded-xl border border-gray-200 bg-gray-50/40 overflow-hidden">
                      {/* Group header: label + remove */}
                      <div className="flex items-center gap-2 px-3 pt-3 pb-2">
                        <input
                          value={group.label}
                          onChange={(e) => {
                            const v = e.target.value;
                            setVariantGroups(prev => prev.map(g => g.id === group.id ? { ...g, label: v } : g));
                          }}
                          placeholder='Variant label shown to customer (e.g. "Select Size", "Select Packet Size", "Select Colour")'
                          className={`${inputClass} flex-1 bg-white font-medium`}
                        />
                        <button
                          type="button"
                          onClick={() => setVariantGroups(prev => prev.filter(g => g.id !== group.id))}
                          className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition shrink-0"
                          aria-label="Remove variant type"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>

                      {/* Options */}
                      <div className="px-3 pb-3 space-y-2">
                        {group.options.map((opt) => {
                          const isColourGroup = /colou?r/i.test(group.label);
                          return (
                          <div key={opt.id} className="rounded-lg border border-gray-200 bg-white p-2.5 space-y-2">
                            {/* Row 1: image/color + name + remove */}
                            <div className="flex gap-2 items-center">
                              {isColourGroup ? (
                                /* Color swatch picker */
                                <label
                                  className="relative h-10 w-10 rounded-full border-2 border-gray-300 overflow-hidden shrink-0 cursor-pointer hover:border-primary/60 transition shadow-sm"
                                  title={opt.color_hex ? `Colour: ${opt.color_hex}` : 'Click to pick a colour'}
                                  style={{ backgroundColor: opt.color_hex || '#e5e7eb' }}
                                >
                                  <input
                                    type="color"
                                    value={opt.color_hex || '#000000'}
                                    onChange={(e) => {
                                      const v = e.target.value;
                                      setVariantGroups(prev => prev.map(g => g.id !== group.id ? g : {
                                        ...g, options: g.options.map(o => o.id !== opt.id ? o : { ...o, color_hex: v }),
                                      }));
                                    }}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                  />
                                </label>
                              ) : (
                                /* Clickable image thumbnail / upload trigger — shows first image */
                                <label
                                  className={`relative h-10 w-10 rounded-lg border border-gray-200 overflow-hidden bg-gray-50 shrink-0 flex items-center justify-center cursor-pointer hover:border-primary/60 transition group ${uploadingOptionImage === opt.id ? 'opacity-60 pointer-events-none' : ''}`}
                                  title={opt.image_urls[0] ? 'Add more images below' : 'Upload image'}
                                >
                                  {uploadingOptionImage === opt.id ? (
                                    <Loader2 size={14} className="animate-spin text-primary" />
                                  ) : opt.image_urls[0] ? (
                                    <>
                                      <img src={opt.image_urls[0]} alt={opt.name || 'option'} className="h-full w-full object-cover" />
                                      <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-primary text-white text-[9px] font-bold flex items-center justify-center">{opt.image_urls.length}</span>
                                    </>
                                  ) : (
                                    <div className="flex flex-col items-center gap-0.5 text-primary/60">
                                      <Upload size={13} />
                                      <span className="text-[8px] font-medium leading-none">Image</span>
                                    </div>
                                  )}
                                  <input
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    className="hidden"
                                    onChange={(e) => { void handleOptionImageUpload(group.id, opt.id, e.target.files?.[0]); e.target.value = ''; }}
                                  />
                                </label>
                              )}

                              {/* Name */}
                              <div className="flex-1 flex flex-col gap-1">
                                <input
                                  value={opt.name}
                                  onChange={(e) => {
                                    const v = e.target.value;
                                    setVariantGroups(prev => prev.map(g => g.id !== group.id ? g : {
                                      ...g, options: g.options.map(o => o.id !== opt.id ? o : { ...o, name: v }),
                                    }));
                                  }}
                                  placeholder={isColourGroup ? 'Colour name (e.g. "Forest Green")' : 'Name (e.g. "4 Inch", "100 gm")'}
                                  className={`${inputClass} flex-1`}
                                />
                                {isColourGroup && (
                                  <span className="text-[10px] text-gray-400 pl-1">
                                    {opt.color_hex ? opt.color_hex : 'Click the circle to pick a colour'}
                                  </span>
                                )}
                              </div>

                              {/* Remove option */}
                              <button
                                type="button"
                                onClick={() => setVariantGroups(prev => prev.map(g => g.id !== group.id ? g : {
                                  ...g, options: g.options.filter(o => o.id !== opt.id),
                                }))}
                                disabled={group.options.length <= 1}
                                className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition shrink-0 disabled:opacity-30"
                                aria-label="Remove option"
                              >
                                <X size={14} />
                              </button>
                            </div>

                            {/* Row 2: price + stock + (colour: image upload) */}
                            <div className="flex gap-2 items-center flex-wrap pl-12">
                              {/* Price */}
                              <div className="flex items-center gap-1 shrink-0">
                                <span className="text-xs text-gray-500">₹</span>
                                <input
                                  type="number"
                                  min={0}
                                  value={opt.price}
                                  onChange={(e) => {
                                    const v = Number(e.target.value);
                                    setVariantGroups(prev => prev.map(g => g.id !== group.id ? g : {
                                      ...g, options: g.options.map(o => o.id !== opt.id ? o : { ...o, price: v }),
                                    }));
                                  }}
                                  placeholder="Price"
                                  className="w-24 px-2 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                                />
                              </div>
                              {/* Stock */}
                              <div className="flex items-center gap-1 shrink-0">
                                <span className="text-xs text-gray-500">Qty</span>
                                <input
                                  type="number"
                                  min={0}
                                  value={opt.stock}
                                  onChange={(e) => {
                                    const v = Number(e.target.value);
                                    setVariantGroups(prev => prev.map(g => g.id !== group.id ? g : {
                                      ...g, options: g.options.map(o => o.id !== opt.id ? o : { ...o, stock: v }),
                                    }));
                                  }}
                                  placeholder="Stock"
                                  className="w-20 px-2 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                                />
                              </div>

                              {/* Colour variants: quick add-photo button (full management in table below) */}
                              {isColourGroup && (
                                <label
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border bg-gray-50 text-[11px] font-medium text-primary cursor-pointer hover:bg-green-50 shrink-0 ${uploadingOptionImage === opt.id ? 'opacity-60 pointer-events-none' : ''}`}
                                  title="Upload colour photo"
                                >
                                  {uploadingOptionImage === opt.id
                                    ? <Loader2 size={12} className="animate-spin" />
                                    : opt.image_urls[0]
                                    ? <img src={opt.image_urls[0]} alt="" className="h-4 w-4 rounded object-cover" />
                                    : <Upload size={12} />}
                                  <span>{opt.image_urls.length > 0 ? `${opt.image_urls.length} photo${opt.image_urls.length > 1 ? 's' : ''}` : 'Add photo'}</span>
                                  <input
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    className="hidden"
                                    onChange={(e) => { void handleOptionImageUpload(group.id, opt.id, e.target.files?.[0]); e.target.value = ''; }}
                                  />
                                </label>
                              )}
                            </div>
                          </div>
                        );
                        })}

                        {/* Add Option */}
                        <button
                          type="button"
                          onClick={() => setVariantGroups(prev => prev.map(g => g.id !== group.id ? g : {
                            ...g, options: [...g.options, emptyOption()],
                          }))}
                          className="w-full py-1.5 border border-dashed border-primary/30 rounded-lg text-xs text-primary font-medium hover:bg-green-50/50 hover:border-primary/50 transition"
                        >
                          + Add Option
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Add Variant Type */}
                <button
                  type="button"
                  onClick={() => setVariantGroups(prev => [...prev, emptyGroup()])}
                  className="w-full py-2.5 border-2 border-dashed border-primary/25 rounded-xl text-sm font-semibold text-primary hover:bg-green-50/50 hover:border-primary/50 transition flex items-center justify-center gap-2"
                >
                  <Plus size={15} />
                  Add Variant Type
                </button>

                {/* ── Variant Combinations Image Table ────────────────────────────── */}
                {(() => {
                  const comboRows = buildComboRows(variantGroups);
                  if (comboRows.length === 0) return null;
                  const overCap = comboRows.length > COMBO_CAP;
                  const visibleRows = overCap ? comboRows.slice(0, COMBO_CAP) : comboRows;
                  const hasAnyComboImage = Object.values(comboImageUrls).some(a => a.length > 0);
                  return (
                    <div className="border-t pt-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-semibold text-gray-700 block">Variant Combinations &amp; Images</span>
                          <p className="text-[10px] text-gray-400 mt-0.5">
                            Upload a photo for each combination — shown in the gallery when that exact combo is selected.
                            Combinations without a photo fall back to the colour option's image, then the default image.
                          </p>
                        </div>
                        {hasAnyComboImage && (
                          <button
                            type="button"
                            onClick={() => {
                              if (!confirm('Clear all combination images?')) return;
                              setComboImageKeys({});
                              setComboImageUrls({});
                            }}
                            className="text-xs text-red-500 hover:text-red-600 font-medium border border-red-200 px-2 py-1 rounded hover:bg-red-50 transition shrink-0"
                          >
                            Clear all combo images
                          </button>
                        )}
                      </div>

                      {overCap && (
                        <div className="rounded-lg bg-amber-50 border border-amber-200 p-2.5 flex gap-2 items-start text-xs text-amber-800">
                          <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                          <span>
                            {comboRows.length} combinations total — showing first {COMBO_CAP}. Reduce options or groups to see all combinations.
                          </span>
                        </div>
                      )}

                      <div className="overflow-x-auto border rounded-lg bg-gray-50/50">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-gray-100 text-gray-600 border-b">
                            <tr>
                              <th className="p-3 font-medium">Combination</th>
                              <th className="p-3 font-medium">
                                Images
                                <span className="font-normal text-gray-400 ml-1">(optional — falls back to colour / default image)</span>
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {visibleRows.map((row) => {
                              const imgs = comboImageUrls[row.key] || [];
                              const keys = comboImageKeys[row.key] || [];
                              return (
                                <tr key={row.key} className="border-b last:border-0 bg-white">
                                  <td className="p-3 font-semibold text-gray-800 whitespace-nowrap align-top pt-4">
                                    {row.label}
                                  </td>
                                  <td className="p-3">
                                    <div className="flex flex-col gap-2">
                                      {imgs.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5">
                                          {imgs.map((url, idx) => (
                                            <div key={idx} className="relative group h-12 w-12 rounded border overflow-hidden bg-gray-50 shrink-0">
                                              <img src={url} alt="" className="h-full w-full object-cover" />
                                              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                <button
                                                  type="button"
                                                  onClick={() => handleRemoveComboImage(row.key, idx)}
                                                  className="p-0.5 text-red-400 hover:text-red-300 bg-black/40 rounded text-[9px] leading-none"
                                                  title="Remove"
                                                >✕</button>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                      {imgs.length === 0 && (
                                        <p className="text-[10px] text-gray-400 italic">No image — will use fallback</p>
                                      )}
                                      {keys.length < 8 && (
                                        <label
                                          className={`inline-flex items-center gap-1 px-2 py-1 rounded border bg-white text-[11px] font-medium text-primary cursor-pointer hover:bg-green-50 self-start transition ${uploadingComboKey === row.key ? 'opacity-60 pointer-events-none' : ''}`}
                                        >
                                          {uploadingComboKey === row.key
                                            ? <Loader2 size={10} className="animate-spin" />
                                            : <Upload size={10} />}
                                          {uploadingComboKey === row.key ? 'Uploading…' : 'Add Image'}
                                          <input
                                            type="file"
                                            accept="image/jpeg,image/png,image/webp"
                                            className="hidden"
                                            onChange={(e) => { void handleComboImageUpload(row.key, e.target.files?.[0]); e.target.value = ''; }}
                                          />
                                        </label>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()}

                {/* Default Fallback Image */}
                <div className="border-t pt-4 space-y-2">
                  <label className="text-xs font-semibold text-gray-700 block">Default Variant Image</label>
                  <p className="text-[10px] text-gray-400">Fallback shown if a selected option has no image of its own.</p>
                  <div className="flex gap-3 items-center">
                    <div className="h-16 w-16 rounded-lg border overflow-hidden bg-white shrink-0 flex items-center justify-center">
                      {defaultImageUrl
                        ? <img src={defaultImageUrl} alt="Default" className="h-full w-full object-cover" />
                        : <ImageIcon size={22} className="text-gray-300" />}
                    </div>
                    <div className="flex-1">
                      <label className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border bg-white text-xs font-medium text-primary cursor-pointer hover:bg-green-50 w-full justify-center ${uploadingDefaultImage ? 'opacity-60 pointer-events-none' : ''}`}>
                        <Upload size={14} />
                        {uploadingDefaultImage ? 'Uploading…' : defaultImageKey ? 'Change default image' : 'Upload default image'}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          onChange={(e) => { void handleDefaultImageUpload(e.target.files?.[0]); e.target.value = ''; }}
                        />
                      </label>
                      {defaultImageKey && (
                        <button type="button" onClick={() => { setDefaultImageKey(''); setDefaultImageUrl(''); }}
                          className="text-xs text-red-500 hover:text-red-600 mt-1 font-medium">
                          Remove image
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 6: SEO & Visibility */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <button
              type="button"
              onClick={() => toggleSection('seo')}
              className="w-full flex items-center justify-between px-5 py-4 font-semibold text-sm text-gray-800 hover:bg-gray-50 text-left"
            >
              <span className="flex items-center gap-2">🔍 <span>SEO & Search Tags</span></span>
              {openSections.seo ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {openSections.seo && (
              <div className="p-5 border-t border-gray-100 space-y-4 bg-white">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <div>
                      <label className="text-xs font-semibold text-gray-700">Search Tags</label>
                      <p className="text-[11px] text-gray-400">Add words customers might type in the search bar (e.g. "indoor", "fern").</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => addTag({ value: '' })}
                      className="px-2.5 py-1 text-xs text-primary font-medium hover:bg-primary-light/10 border border-primary/20 rounded transition"
                    >
                      + Add Tag
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {tagFields.map((f, i) => (
                      <div key={f.id} className="flex items-center gap-1 border rounded-lg bg-gray-50 px-2 py-1">
                        <input
                          {...register(`tags.${i}.value`)}
                          placeholder="tag"
                          className="w-20 bg-transparent border-0 outline-none text-xs p-0 focus:ring-0"
                        />
                        <button
                          type="button"
                          onClick={() => removeTag(i)}
                          className="text-red-400 hover:text-red-600"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                    {tagFields.length === 0 && (
                      <p className="text-xs text-gray-400 italic py-2">No tags added yet.</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

        </form>

        {/* Modal Action Buttons */}
        <div className="p-4 sm:p-5 border-t bg-white shrink-0 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit(onSubmit)}
            disabled={!formReady || submitting || uploadingOptionImage !== null || uploadingDefaultImage || uploadingComboKey !== null || careItems.some(c => c.uploading)}
            className="flex-1 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/95 disabled:opacity-60 transition"
          >
            {!formReady
              ? 'Loading...'
              : uploadingOptionImage !== null
              ? 'Uploading Image...'
              : uploadingDefaultImage
              ? 'Uploading Default Image...'
              : submitting
              ? 'Saving Product...'
              : (isEdit ? 'Save Changes' : 'Publish Product')}
          </button>
        </div>

      </div>
    </>
  );
}

export default function ProductsAdminPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  
  // Stock alert filter tab
  const [activeTab, setActiveTab] = useState<'all' | 'low_stock'>('all');
  
  const { data, isLoading } = useProducts({ search: search || undefined, page, limit: 20 });
  const deleteMutation = useDeleteProduct();

  async function handleDelete(id: number, name: string) {
    if (!confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) return;
    try {
      await deleteMutation.mutateAsync(id);
      toast.success('Product deleted');
    } catch {
      toast.error('Failed to delete product');
    }
  }

  // Filter products by stock for inventory view
  const displayedItems = data?.items?.filter(p => {
    if (activeTab === 'low_stock') {
      return p.stock_qty <= 5;
    }
    return true;
  }) || [];

  const getStockBadge = (qty: number) => {
    if (qty === 0) {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-red-100 text-red-800">
          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
          Out of Stock
        </span>
      );
    }
    if (qty <= 5) {
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 animate-pulse">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
          Low Stock ({qty})
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full bg-green-100 text-green-800">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
        Healthy ({qty})
      </span>
    );
  };

  return (
    <div className="space-y-4">
      
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Products Catalog</h1>
          <p className="text-xs text-gray-500 mt-0.5">Manage details, stock levels, variants, and visibility of plants on the website.</p>
        </div>
        <button
          onClick={() => { setEditingProduct(null); setShowModal(true); }}
          className="px-4 py-2.5 bg-primary hover:bg-primary/95 text-white text-sm rounded-lg font-semibold flex items-center justify-center gap-2 transition"
        >
          <Plus size={16} /> Add Product
        </button>
      </div>

      {/* Filter Tabs & Search */}
      <div className="bg-white p-3 border rounded-xl flex flex-col md:flex-row gap-3 items-center justify-between">
        
        {/* Inventory alert tabs */}
        <div className="flex gap-1 border-b md:border-b-0 pb-2 md:pb-0 w-full md:w-auto">
          <button
            onClick={() => { setActiveTab('all'); setPage(1); }}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'all'
                ? 'bg-primary/10 text-primary'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            All Products
          </button>
          <button
            onClick={() => { setActiveTab('low_stock'); setPage(1); }}
            className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === 'low_stock'
                ? 'bg-amber-100 text-amber-800'
                : 'text-gray-600 hover:bg-amber-50 hover:text-amber-800'
            }`}
          >
            <AlertTriangle size={13} />
            Low Stock Alerts
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full md:max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            placeholder="Search products..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-4 py-2 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-light"
          />
        </div>
      </div>

      {/* Desktop List View */}
      <div className="hidden sm:block bg-white rounded-xl border overflow-x-auto shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b bg-gray-50">
              <th className="px-5 py-3.5 font-semibold text-xs">Product Details</th>
              <th className="px-5 py-3.5 font-semibold text-xs">Price</th>
              <th className="px-5 py-3.5 font-semibold text-xs">Inventory Status</th>
              <th className="px-5 py-3.5 font-semibold text-xs">Active on Site</th>
              <th className="px-5 py-3.5 font-semibold text-xs w-24">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="px-5 py-12 text-center text-gray-400">Loading products database...</td></tr>
            ) : displayedItems.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-12 text-center text-gray-400">
                  {activeTab === 'low_stock' ? 'Excellent! No products are currently low in stock.' : 'No products found.'}
                </td>
              </tr>
            ) : (
              displayedItems.map((p) => (
                <tr key={p.id} className="border-b last:border-0 hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={p.images?.[0] || 'https://placehold.co/60x60?text=P'}
                        alt={p.name}
                        className="w-10 h-10 rounded-lg object-cover bg-gray-100 shrink-0 border"
                      />
                      <div>
                        <span className="font-semibold text-gray-900 block">{p.name}</span>
                        {p.badge && (
                          <span className="inline-block mt-0.5 text-[9px] font-bold bg-[#E6F3EE] text-primary px-1.5 py-0.5 rounded">
                            {p.badge}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span className="font-medium text-gray-900">₹{p.price}</span>
                    {p.original_price && (
                      <span className="text-gray-400 text-xs line-through ml-1.5">₹{p.original_price}</span>
                    )}
                  </td>
                  <td className="px-5 py-3">{getStockBadge(p.stock_qty)}</td>
                  <td className="px-5 py-3">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${p.is_active ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                      {p.is_active ? 'Published' : 'Hidden'}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex gap-1">
                      <button
                        onClick={() => { setEditingProduct(p); setShowModal(true); }}
                        className="p-1.5 text-gray-400 hover:text-primary rounded-lg hover:bg-gray-50 transition"
                        title="Edit product info"
                      >
                        <Edit2 size={15} />
                      </button>
                      <button
                        onClick={() => handleDelete(p.id, p.name)}
                        className="p-1.5 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition"
                        title="Delete product"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Card List View */}
      <div className="sm:hidden space-y-2">
        {isLoading ? (
          <p className="text-center text-gray-400 py-8 text-sm">Loading products...</p>
        ) : displayedItems.length === 0 ? (
          <p className="text-center text-gray-400 py-8 text-sm">
            {activeTab === 'low_stock' ? 'No products low in stock.' : 'No products found.'}
          </p>
        ) : (
          displayedItems.map((p) => (
            <div key={p.id} className="bg-white rounded-xl border p-3 flex gap-3 shadow-sm">
              <img
                src={p.images?.[0] || 'https://placehold.co/60x60?text=P'}
                alt={p.name}
                className="w-12 h-12 rounded-lg object-cover shrink-0 border bg-gray-50"
                loading="lazy"
              />
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-sm block truncate text-gray-900">{p.name}</span>
                <p className="text-xs font-semibold text-primary mt-0.5">₹{p.price}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5 items-center">
                  {getStockBadge(p.stock_qty)}
                </div>
              </div>
              <div className="flex flex-col gap-1 items-end shrink-0 justify-between">
                <div className="flex">
                  <button onClick={() => { setEditingProduct(p); setShowModal(true); }} className="p-2 text-gray-500 hover:text-primary">
                    <Edit2 size={15} />
                  </button>
                  <button onClick={() => handleDelete(p.id, p.name)} className="p-2 text-red-400 hover:text-red-600">
                    <Trash2 size={15} />
                  </button>
                </div>
                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${p.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  {p.is_active ? 'Active' : 'Hidden'}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination Controls */}
      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1.5 border bg-white rounded-lg text-xs font-semibold disabled:opacity-30">Prev</button>
          <span className="text-xs text-gray-500 font-medium">Page {page} of {data.pages}</span>
          <button disabled={page >= data.pages} onClick={() => setPage(page + 1)} className="px-3 py-1.5 border bg-white rounded-lg text-xs font-semibold disabled:opacity-30">Next</button>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <ProductModal
          key={editingProduct?.id ?? 'new'}
          editProduct={editingProduct}
          onClose={() => { setShowModal(false); setEditingProduct(null); }}
        />
      )}
    </div>
  );
}
