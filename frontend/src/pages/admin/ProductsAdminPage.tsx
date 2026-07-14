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
  HelpCircle,
  Upload,
  Check
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useProduct, useProductRaw, useProducts } from '@/hooks/useProducts';
import { useCategories } from '@/hooks/useCategories';
import { useDeleteProduct } from '@/hooks/useAdmin';
import api from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import type { Product, ProductListResponse, ProductVariants } from '@/types';

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

type ProductFormData = z.infer<typeof productSchema>;
// ⚠️ image_key is the relative storage key sent to the backend (e.g. "plantoga/...").
// image_url is the resolved full URL used only for <img> preview — never sent anywhere.
type VariantColorDraft = { name: string; hex: string; image_key: string; image_url: string };
// ⚠️ image_key is the relative storage key sent to the backend (e.g. "plantoga/...").
// image_url is the resolved full URL used only for <img> preview — never sent anywhere.
type VariantPotDraft = { name: string; price_modifier: number; image_key: string; image_url: string };
type VariantSizeDraft = { name: string; price_modifier: number; description: string };

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const newFiles = Array.from(files);
      setUploadedFiles([...uploadedFiles, ...newFiles]);
      const newPreviews = newFiles.map(file => URL.createObjectURL(file));
      setFilePreviews([...filePreviews, ...newPreviews]);
    }
  };

  const handleRemoveFile = (index: number) => {
    setUploadedFiles(uploadedFiles.filter((_, i) => i !== index));
    setFilePreviews(filePreviews.filter((_, i) => i !== index));
  };

  // Variant States
  const [colors, setColors] = useState<VariantColorDraft[]>([]);
  const [pots, setPots] = useState<VariantPotDraft[]>([]);
  const [uploadingColorImage, setUploadingColorImage] = useState<number | null>(null);
  const [uploadingPotImage, setUploadingPotImage] = useState<number | null>(null);
  const [uploadingDefaultImage, setUploadingDefaultImage] = useState(false);
  const [uploadingComboImage, setUploadingComboImage] = useState<string | null>(null);
  const [sizes, setSizes] = useState<VariantSizeDraft[]>([]);
  // defaultImageKey: relative key sent to backend. defaultImageUrl: full URL for preview only.
  const [defaultImageKey, setDefaultImageKey] = useState('');
  const [defaultImageUrl, setDefaultImageUrl] = useState('');
  const [stockByKey, setStockByKey] = useState<Record<string, number>>({});
  // imageKeysByCombo: relative keys sent to backend. imageUrlsByCombo: full URLs for preview only.
  const [imageKeysByCombo, setImageKeysByCombo] = useState<Record<string, string[]>>({});
  const [imageUrlsByCombo, setImageUrlsByCombo] = useState<Record<string, string[]>>({});
  // rawPotTypes: raw pot_types from the admin raw endpoint, held separately so the
  // pot-image merge effect runs regardless of which fetch (rawProduct vs freshProduct) wins.
  const [rawPotTypes, setRawPotTypes] = useState<any[] | null>(null);
  const [rawColorTypes, setRawColorTypes] = useState<any[] | null>(null);
  // seeded*Ref: guards the merge effects so they each run exactly once per product load.
  // Prevents row-count changes (add/remove) from re-seeding and overwriting
  // images the admin has already uploaded during this edit session.
  const seededPotImagesRef = useRef(false);
  const seededColorImagesRef = useRef(false);

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
    setColors(p.variants?.colors?.map((c: any) => ({ name: c.name, hex: c.hex, image_key: '', image_url: '' })) || []);
    // Pot image keys are seeded by the rawProduct effect (relative keys from DB).
    // Here we only set structural fields; image_key/image_url start empty.
    setPots(
      p.variants?.pot_types?.map((pot: any) => ({
        name: pot.name,
        price_modifier: pot.price_modifier,
        image_key: '',   // populated by rawProduct effect
        image_url: '',   // populated by rawProduct effect
      })) || [],
    );
    setSizes(
      p.variants?.sizes?.map((s: any) => ({
        name: s.name,
        price_modifier: s.price_modifier,
        description: s.description || '',
      })) || [],
    );
    // image key/url state seeded by rawProduct effect
    setDefaultImageKey('');
    setDefaultImageUrl('');
    setStockByKey(p.variants?.stock || {});
    setImageKeysByCombo({});
    setImageUrlsByCombo({});
    setRawPotTypes(null);
    setRawColorTypes(null);
    seededPotImagesRef.current = false; // allow one seed for the incoming product
    seededColorImagesRef.current = false;
    setVariantError(null);
  }, [reset]);

  // Seed image key state from the raw admin endpoint (relative keys, never resolved URLs).
  // Runs after applyProductToForm and overwrites the empty image fields with real keys.
  useEffect(() => {
    if (!isEdit || !rawProduct?.variants) return;
    const v = rawProduct.variants;

    // default_image and image_map values are raw relative keys straight from DB
    setDefaultImageKey(v.default_image || '');
    setDefaultImageUrl(resolveImageUrl(v.default_image));

    const rawImageMap = v.image_map || {};
    const loadedKeys: Record<string, string[]> = {};
    const loadedUrls: Record<string, string[]> = {};
    for (const [k, val] of Object.entries(rawImageMap)) {
      if (Array.isArray(val)) {
        loadedKeys[k] = val;
        loadedUrls[k] = val.map(key => resolveImageUrl(key));
      } else if (typeof val === 'string' && val.trim() !== '') {
        loadedKeys[k] = [val];
        loadedUrls[k] = [resolveImageUrl(val)];
      } else {
        loadedKeys[k] = [];
        loadedUrls[k] = [];
      }
    }
    setImageKeysByCombo(loadedKeys);
    setImageUrlsByCombo(loadedUrls);

    // Store raw pot types separately so the merge effect below can run
    // regardless of whether rawProduct or applyProductToForm resolved first.
    // Reset the guard so the merge runs exactly once for this product load.
    seededPotImagesRef.current = false;
    setRawPotTypes(v.pot_types || []);
    seededColorImagesRef.current = false;
    setRawColorTypes(v.colors || []);
  // resolveImageUrl is stable (defined inside component but no deps) — safe to omit
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, rawProduct]);

  // Merge pot image keys into the pots array.
  // Kept in a separate effect so it fires whenever EITHER rawPotTypes or pots.length
  // changes — making it order-independent between the two data fetches.
  // The seededPotImagesRef guard ensures this runs exactly ONCE per product load.
  // Without it, adding/removing a pot row would re-fire and overwrite any images
  // the admin already uploaded during this edit session.
  useEffect(() => {
    if (!rawPotTypes || pots.length === 0 || seededPotImagesRef.current) return;
    setPots(prev => prev.map((pot, i) => {
      const rawKey: string = rawPotTypes[i]?.image_url || '';
      return { ...pot, image_key: rawKey, image_url: resolveImageUrl(rawKey) };
    }));
    seededPotImagesRef.current = true; // never re-seed after this for the current product
  // pots.length (not pots) — only retrigger when rows are added/removed, not on every keystroke
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawPotTypes, pots.length]);

  // Merge color image keys into the colors array — same pattern as pots.
  useEffect(() => {
    if (!rawColorTypes || colors.length === 0 || seededColorImagesRef.current) return;
    setColors(prev => prev.map((color, i) => {
      const rawKey: string = rawColorTypes[i]?.image_url || '';
      return { ...color, image_key: rawKey, image_url: resolveImageUrl(rawKey) };
    }));
    seededColorImagesRef.current = true;
  // colors.length (not colors) — only retrigger when rows are added/removed
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawColorTypes, colors.length]);

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

      // Handle custom variant setup
      if (colors.length || pots.length || sizes.length || defaultImageKey.trim()) {
        const cleanColors = colors
          .filter((c) => c.name.trim())
          .map(c => ({ name: c.name.trim(), hex: c.hex, slug: slugify(c.name), image_url: (c.image_key || '').trim() }));

        const cleanPots = pots
          .filter((p) => p.name.trim())
          .map(p => ({
            name: p.name.trim(),
            slug: slugify(p.name),
            price_modifier: Number(p.price_modifier || 0),
            // image_url field in DB holds a relative key — send the key, not the display URL
            image_url: (p.image_key || '').trim(),
          }));

        const cleanSizes = sizes
          .filter((s) => s.name.trim())
          .map(s => ({ name: s.name.trim(), slug: slugify(s.name), price_modifier: Number(s.price_modifier || 0), description: s.description.trim() }));

        if (colors.length > 0 && !cleanColors.length) {
          setVariantError('Please fill in names for the added colors.');
          setSubmitting(false);
          return;
        }
        if (pots.length > 0 && !cleanPots.length) {
          setVariantError('Please fill in names for the added pot types.');
          setSubmitting(false);
          return;
        }
        if (sizes.length > 0 && !cleanSizes.length) {
          setVariantError('Please fill in names for the added sizes.');
          setSubmitting(false);
          return;
        }

        // Size-only mode: no colors/pots, just sizes
        if (cleanSizes.length > 0 && !cleanColors.length && !cleanPots.length) {
          variants = {
            colors: [],
            pot_types: [],
            sizes: cleanSizes,
            default_image: defaultImageKey,
            image_map: {},
            stock: Object.fromEntries(cleanSizes.map(s => [s.slug, Number(stockByKey[s.slug] || 0)])),
          };
        } else if (cleanColors.length && cleanPots.length) {
          // Color + pot (+ optional size) combinations
          let rowKeys: string[];
          if (cleanSizes.length) {
            rowKeys = cleanColors.flatMap(color =>
              cleanPots.flatMap(pot =>
                cleanSizes.map(size => `${color.slug}__${pot.slug}__${size.slug}`)
              )
            );
          } else {
            rowKeys = cleanColors.flatMap((color) => cleanPots.map((pot) => `${color.slug}__${pot.slug}`));
          }
          variants = {
            colors: cleanColors,
            pot_types: cleanPots,
            ...(cleanSizes.length ? { sizes: cleanSizes } : {}),
            default_image: defaultImageKey,
            image_map: Object.fromEntries(rowKeys.map((key) => [key, imageKeysByCombo[key] || []])),
            stock: Object.fromEntries(rowKeys.map((key) => [key, Number(stockByKey[key] || 0)])),
          };
        } else if (cleanColors.length || cleanPots.length) {
          setVariantError('To create combinations, please specify both at least one Color and one Pot Type. Otherwise, configure them in basic info.');
          setSubmitting(false);
          return;
        }
      }

      const totalStock = variants
        ? Object.values(variants.stock).reduce((sum, qty) => sum + Number(qty || 0), 0)
        : data.stock_qty;

      const payload = {
        name: data.name,
        description: data.description || '',
        price: data.price,
        original_price: data.original_price || null,
        stock_qty: totalStock,
        category_id: data.category_id,
        badge: data.badge || null,
        sunlight: data.sunlight || null,
        watering: data.watering || null,
        how_to_guide: data.how_to_guide?.trim() || null,
        tags: data.tags?.map((t) => t.value).filter(Boolean) || [],
        care_tips: data.care_tips?.map((t) => t.value).filter(Boolean) || [],
        variants,
      };

      if (editProduct) {
        // Upload any newly selected files first
        const uploadedUrls: string[] = [];
        for (const file of uploadedFiles) {
          const fd = new FormData();
          fd.append('image', file);
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
  
  const activeColors = colors.filter(c => c.name.trim()).map(c => ({ name: c.name.trim(), slug: slugify(c.name) }));
  const activePots = pots.filter(p => p.name.trim()).map(p => ({ name: p.name.trim(), slug: slugify(p.name) }));
  const activeSizes = sizes.filter(s => s.name.trim()).map(s => ({ name: s.name.trim(), slug: slugify(s.name) }));

  async function handleColorImageUpload(index: number, file?: File) {
    if (!file) return;
    setUploadingColorImage(index);
    try {
      const fd = new FormData();
      fd.append('image', file);
      if (editProduct?.id) fd.append('product_id', String(editProduct.id));
      const { data } = await api.post<{ key: string; url: string }>('/products/variant-image', fd);
      setColors(current => current.map((color, i) => i === index ? { ...color, image_key: data.key, image_url: data.url } : color));
      toast.success('Color image uploaded');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to upload color image');
    } finally {
      setUploadingColorImage(null);
    }
  }

  async function handlePotImageUpload(index: number, file?: File) {
    if (!file) return;
    setUploadingPotImage(index);
    try {
      const fd = new FormData();
      fd.append('image', file);
      if (editProduct?.id) fd.append('product_id', String(editProduct.id));
      const { data } = await api.post<{ key: string; url: string }>('/products/variant-image', fd);
      // key → stored in payload; url → display only
      setPots(current => current.map((pot, i) => i === index ? { ...pot, image_key: data.key, image_url: data.url } : pot));
      toast.success('Pot image uploaded');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to upload pot image');
    } finally {
      setUploadingPotImage(null);
    }
  }

  async function handleDefaultImageUpload(file?: File) {
    if (!file) return;
    setUploadingDefaultImage(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
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

  async function handleComboImageUpload(comboKey: string, file?: File) {
    if (!file) return;

    const currentKeys = imageKeysByCombo[comboKey] || [];
    if (currentKeys.length >= 8) {
      toast.error('Limit of 8 images reached for this combination');
      return;
    }

    setUploadingComboImage(comboKey);
    try {
      const fd = new FormData();
      fd.append('image', file);
      if (editProduct?.id) fd.append('product_id', String(editProduct.id));
      const { data } = await api.post<{ key: string; url: string }>('/products/upload-image', fd);
      // key → stored in payload; url → display only
      setImageKeysByCombo(prev => ({
        ...prev,
        [comboKey]: [...(prev[comboKey] || []), data.key]
      }));
      setImageUrlsByCombo(prev => ({
        ...prev,
        [comboKey]: [...(prev[comboKey] || []), data.url]
      }));
      toast.success('Combination image uploaded');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to upload combination image');
    } finally {
      setUploadingComboImage(null);
    }
  }

  function handleRemoveComboImage(comboKey: string, index: number) {
    setImageKeysByCombo(prev => ({
      ...prev,
      [comboKey]: (prev[comboKey] || []).filter((_, i) => i !== index)
    }));
    setImageUrlsByCombo(prev => ({
      ...prev,
      [comboKey]: (prev[comboKey] || []).filter((_, i) => i !== index)
    }));
  }

  function handleMoveComboImage(comboKey: string, index: number, direction: 'up' | 'down') {
    const keys = [...(imageKeysByCombo[comboKey] || [])];
    const urls = [...(imageUrlsByCombo[comboKey] || [])];
    if (direction === 'up' && index > 0) {
      const tempKey = keys[index];
      keys[index] = keys[index - 1];
      keys[index - 1] = tempKey;

      const tempUrl = urls[index];
      urls[index] = urls[index - 1];
      urls[index - 1] = tempUrl;
    } else if (direction === 'down' && index < keys.length - 1) {
      const tempKey = keys[index];
      keys[index] = keys[index + 1];
      keys[index + 1] = tempKey;

      const tempUrl = urls[index];
      urls[index] = urls[index + 1];
      urls[index + 1] = tempUrl;
    }

    setImageKeysByCombo(prev => ({ ...prev, [comboKey]: keys }));
    setImageUrlsByCombo(prev => ({ ...prev, [comboKey]: urls }));
  }
  
  // Build variant rows for the stock/image matrix
  let variantRows: { key: string; label: string }[] = [];
  if (activeColors.length && activePots.length && activeSizes.length) {
    // 3D: color + pot + size
    variantRows = activeColors.flatMap(color =>
      activePots.flatMap(pot =>
        activeSizes.map(size => ({
          key: `${color.slug}__${pot.slug}__${size.slug}`,
          label: `${color.name} / ${pot.name} / ${size.name}`,
        }))
      )
    );
  } else if (activeColors.length && activePots.length) {
    // 2D: color + pot
    variantRows = activeColors.flatMap((color) => activePots.map((pot) => ({
      key: `${color.slug}__${pot.slug}`,
      label: `${color.name} / ${pot.name}`,
    })));
  } else if (activeSizes.length && !activeColors.length && !activePots.length) {
    // Size-only
    variantRows = activeSizes.map(size => ({ key: size.slug, label: size.name }));
  }

  const hasVariants = colors.length > 0 || pots.length > 0 || sizes.length > 0 || defaultImageKey.trim().length > 0;

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
                  <strong>How variants work:</strong> Add different colors (e.g. Terracotta, Teal) and pot types (e.g. Ceramic, Plastic). The system automatically combines them so you can manage stock and custom images for each!
                </div>

                {variantError && (
                  <div className="rounded-lg bg-red-50 border border-red-100 p-3 flex gap-2 text-xs text-red-800">
                    <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                    <span>{variantError}</span>
                  </div>
                )}

                {/* Colors Setup */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-gray-700 block">1. Color Variants</span>
                      <span className="text-[10px] text-gray-400">Add the available pot/plant colors</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setColors([...colors, { name: '', hex: '#2D6A4F', image_key: '', image_url: '' }])}
                      className="px-2 py-1 text-xs text-primary font-medium hover:underline border border-primary/20 rounded"
                    >
                      + Add Color
                    </button>
                  </div>
                  <div className="space-y-2">
                    {colors.map((color, index) => (
                      <div key={index} className="rounded-xl border border-gray-200 p-3 space-y-3 bg-gray-50/40">
                        <div className="flex gap-2 items-center">
                          <input
                            value={color.name}
                            onChange={(e) => setColors(colors.map((c, i) => i === index ? { ...c, name: e.target.value } : c))}
                            placeholder="Color Name (e.g., Terracotta)"
                            className={`${inputClass} flex-1 bg-white`}
                          />
                          <input
                            type="color"
                            value={color.hex}
                            onChange={(e) => setColors(colors.map((c, i) => i === index ? { ...c, hex: e.target.value } : c))}
                            className="h-9 w-9 border border-gray-200 rounded-lg cursor-pointer bg-transparent p-0 shrink-0"
                          />
                          <button
                            type="button"
                            onClick={() => setColors(colors.filter((_, i) => i !== index))}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition shrink-0"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                        <div className="flex gap-3 items-center">
                          <div className="h-16 w-16 rounded-lg border overflow-hidden bg-white shrink-0 flex items-center justify-center">
                            {color.image_url ? (
                              <img src={color.image_url} alt={`${color.name || 'Color'} preview`} className="h-full w-full object-contain" />
                            ) : (
                              <ImageIcon size={22} className="text-gray-300" />
                            )}
                          </div>
                          <div className="flex-1">
                            <label className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border bg-white text-xs font-medium text-primary cursor-pointer hover:bg-green-50 w-full justify-center ${uploadingColorImage === index ? 'opacity-60 pointer-events-none' : ''}`}>
                              <Upload size={14} />
                              {uploadingColorImage === index ? 'Uploading…' : color.image_key ? 'Change color image' : 'Upload color image'}
                              <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                className="hidden"
                                onChange={(e) => {
                                  void handleColorImageUpload(index, e.target.files?.[0]);
                                  e.target.value = '';
                                }}
                              />
                            </label>
                            {color.image_key && (
                              <button
                                type="button"
                                onClick={() => setColors(colors.map((c, i) => i === index ? { ...c, image_key: '', image_url: '' } : c))}
                                className="text-xs text-red-500 hover:text-red-600 mt-1 font-medium"
                              >
                                Remove image
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    {colors.length === 0 && (
                      <p className="text-xs text-gray-400 italic text-center py-1">No custom colors.</p>
                    )}
                  </div>
                </div>

                {/* Pot Types Setup */}
                <div className="space-y-2 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-gray-700 block">2. Pot Types</span>
                      <span className="text-[10px] text-gray-400">Add each pot's name, price, and customer-facing image</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPots([...pots, { name: '', price_modifier: 0, image_key: '', image_url: '' }])}
                      className="px-2 py-1 text-xs text-primary font-medium hover:underline border border-primary/20 rounded"
                    >
                      + Add Pot Option
                    </button>
                  </div>
                  <div className="space-y-2">
                    {pots.map((pot, index) => (
                      <div key={index} className="rounded-xl border border-gray-200 p-3 space-y-3 bg-gray-50/40">
                        <div className="flex gap-2 items-center">
                          <input
                            value={pot.name}
                            onChange={(e) => setPots(pots.map((p, i) => i === index ? { ...p, name: e.target.value } : p))}
                            placeholder="Pot Type (e.g. Ceramic pot)"
                            className={`${inputClass} flex-1 bg-white`}
                          />
                          <div className="flex items-center gap-1.5 shrink-0 w-32">
                            <span className="text-xs text-gray-500">₹</span>
                            <input
                              type="number"
                              value={pot.price_modifier}
                              onChange={(e) => setPots(pots.map((p, i) => i === index ? { ...p, price_modifier: Number(e.target.value) } : p))}
                              placeholder="Price +/-"
                              className={`${inputClass} bg-white`}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => setPots(pots.filter((_, i) => i !== index))}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition shrink-0"
                            aria-label={`Remove ${pot.name || 'pot'} option`}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                        <div className="flex gap-3 items-center">
                          <div className="h-16 w-16 rounded-lg border overflow-hidden bg-white shrink-0 flex items-center justify-center">
                            {pot.image_url ? (
                              <img src={pot.image_url} alt={`${pot.name || 'Pot'} preview`} className="h-full w-full object-contain" />
                            ) : (
                              <ImageIcon size={22} className="text-gray-300" />
                            )}
                          </div>
                          <div className="flex-1">
                            <label className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border bg-white text-xs font-medium text-primary cursor-pointer hover:bg-green-50 w-full justify-center ${uploadingPotImage === index ? 'opacity-60 pointer-events-none' : ''}`}>
                              <Upload size={14} />
                              {uploadingPotImage === index ? 'Uploading…' : pot.image_key ? 'Change pot image' : 'Upload pot image'}
                              <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                className="hidden"
                                onChange={(e) => {
                                  void handlePotImageUpload(index, e.target.files?.[0]);
                                  e.target.value = '';
                                }}
                              />
                            </label>
                            {pot.image_key && (
                              <button
                                type="button"
                                onClick={() => setPots(pots.map((p, i) => i === index ? { ...p, image_key: '', image_url: '' } : p))}
                                className="text-xs text-red-500 hover:text-red-600 mt-1 font-medium"
                              >
                                Remove image
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    {pots.length === 0 && (
                      <p className="text-xs text-gray-400 italic text-center py-1">No custom pots.</p>
                    )}
                  </div>
                </div>

                {/* Plant Sizes Setup */}
                <div className="space-y-2 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-gray-700 block">3. Plant Sizes</span>
                      <span className="text-[10px] text-gray-400">Add size options (Small, Medium, Large) with optional price difference</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSizes([...sizes, { name: '', price_modifier: 0, description: '' }])}
                      className="px-2 py-1 text-xs text-primary font-medium hover:underline border border-primary/20 rounded"
                    >
                      + Add Size
                    </button>
                  </div>
                  <div className="space-y-2">
                    {sizes.map((size, index) => (
                      <div key={index} className="flex gap-2 items-center">
                        <select
                          value={size.name}
                          onChange={(e) => setSizes(sizes.map((s, i) => i === index ? { ...s, name: e.target.value } : s))}
                          className={`${inputClass} flex-1`}
                        >
                          <option value="">Select Size</option>
                          <option value="Small">Small</option>
                          <option value="Medium">Medium</option>
                          <option value="Large">Large</option>
                          <option value="Extra Large">Extra Large</option>
                        </select>
                        <input
                          value={size.description}
                          onChange={(e) => setSizes(sizes.map((s, i) => i === index ? { ...s, description: e.target.value } : s))}
                          placeholder="Hint (e.g. 6–12 in)"
                          className={`${inputClass} w-40`}
                        />
                        <div className="flex items-center gap-1.5 shrink-0 w-28">
                          <span className="text-xs text-gray-500">₹</span>
                          <input
                            type="number"
                            value={size.price_modifier}
                            onChange={(e) => setSizes(sizes.map((s, i) => i === index ? { ...s, price_modifier: Number(e.target.value) } : s))}
                            placeholder="+Price"
                            className={inputClass}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => setSizes(sizes.filter((_, i) => i !== index))}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition shrink-0"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                    {sizes.length === 0 && (
                      <p className="text-xs text-gray-400 italic text-center py-1">No size options. Add sizes like Small, Medium, Large.</p>
                    )}
                  </div>
                  {sizes.length > 0 && !colors.length && !pots.length && (
                    <p className="text-[10px] text-blue-600 bg-blue-50 rounded-lg px-3 py-1.5">
                      💡 Size-only mode: Stock will be tracked per size (no color/pot needed).
                    </p>
                  )}
                  {sizes.length > 0 && colors.length > 0 && pots.length > 0 && (
                    <p className="text-[10px] text-amber-700 bg-amber-50 rounded-lg px-3 py-1.5">
                      ⚠️ 3D mode: Stock will be tracked per Color × Pot × Size combination.
                    </p>
                  )}
                </div>

                {/* Default Fallback Image */}
                <div className="border-t pt-4 space-y-2">
                  <label className="text-xs font-semibold text-gray-700 block">4. Default Variant Image</label>
                  <p className="text-[10px] text-gray-400">This image is loaded if a specific combination lacks its own image.</p>
                  <div className="flex gap-3 items-center">
                    <div className="h-16 w-16 rounded-lg border overflow-hidden bg-white shrink-0 flex items-center justify-center">
                      {defaultImageUrl ? (
                        <img src={defaultImageUrl} alt="Default variant preview" className="h-full w-full object-cover" />
                      ) : (
                        <ImageIcon size={22} className="text-gray-300" />
                      )}
                    </div>
                    <div className="flex-1">
                      <label className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border bg-white text-xs font-medium text-primary cursor-pointer hover:bg-green-50 w-full justify-center ${uploadingDefaultImage ? 'opacity-60 pointer-events-none' : ''}`}>
                        <Upload size={14} />
                        {uploadingDefaultImage ? 'Uploading…' : defaultImageKey ? 'Change default image' : 'Upload default image'}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="hidden"
                          onChange={(e) => {
                            void handleDefaultImageUpload(e.target.files?.[0]);
                            e.target.value = '';
                          }}
                        />
                      </label>
                      {defaultImageKey && (
                        <button
                          type="button"
                          onClick={() => { setDefaultImageKey(''); setDefaultImageUrl(''); }}
                          className="text-xs text-red-500 hover:text-red-600 mt-1 font-medium"
                        >
                          Remove image
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Combinations Matrix */}
                {variantRows.length > 0 && (
                  <div className="border-t pt-4 space-y-2">
                    <span className="text-xs font-semibold text-gray-700 block">4. Variant Combinations stock & images</span>
                    <div className="overflow-x-auto border rounded-lg bg-gray-50/50">
                      <table className="w-full text-xs text-left">
                        <thead className="bg-gray-100 text-gray-600 border-b">
                          <tr>
                            <th className="p-3 font-medium">Combination</th>
                            <th className="p-3 font-medium w-28">Stock Qty</th>
                            <th className="p-3 font-medium">Image URL</th>
                          </tr>
                        </thead>
                        <tbody>
                          {variantRows.map((row) => (
                            <tr key={row.key} className="border-b last:border-0 bg-white">
                              <td className="p-3 font-semibold text-gray-800">{row.label}</td>
                              <td className="p-3">
                                <input
                                  type="number"
                                  min={0}
                                  value={stockByKey[row.key] ?? 0}
                                  onChange={(e) => setStockByKey({ ...stockByKey, [row.key]: Number(e.target.value) })}
                                  className="w-full px-2 py-1.5 border rounded-lg text-xs"
                                />
                              </td>
                              <td className="p-3">
                                <div className="flex flex-col gap-2">
                                  <div className="flex flex-wrap gap-1.5 max-w-sm">
                                    {(imageUrlsByCombo[row.key] || []).map((url, idx) => (
                                      <div key={idx} className="relative group h-12 w-12 rounded border overflow-hidden bg-gray-50 shrink-0 flex items-center justify-center">
                                        <img src={url} alt="" className="h-full w-full object-cover" />
                                        
                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                                          {idx > 0 && (
                                            <button
                                              type="button"
                                              onClick={() => handleMoveComboImage(row.key, idx, 'up')}
                                              className="p-0.5 text-white hover:text-gray-250 bg-black/40 rounded text-[9px] leading-none"
                                              title="Move left"
                                            >
                                              ←
                                            </button>
                                          )}
                                          {idx < (imageUrlsByCombo[row.key] || []).length - 1 && (
                                            <button
                                              type="button"
                                              onClick={() => handleMoveComboImage(row.key, idx, 'down')}
                                              className="p-0.5 text-white hover:text-gray-250 bg-black/40 rounded text-[9px] leading-none"
                                              title="Move right"
                                            >
                                              →
                                            </button>
                                          )}
                                          <button
                                            type="button"
                                            onClick={() => handleRemoveComboImage(row.key, idx)}
                                            className="p-0.5 text-red-400 hover:text-red-350 bg-black/40 rounded text-[9px] leading-none"
                                            title="Delete image"
                                          >
                                            ✕
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                  
                                  {(!imageKeysByCombo[row.key] || imageKeysByCombo[row.key].length < 8) && (
                                    <label className={`inline-flex items-center gap-1 px-2 py-1 rounded border bg-white text-[11px] font-medium text-primary cursor-pointer hover:bg-green-50 self-start ${uploadingComboImage === row.key ? 'opacity-60 pointer-events-none' : ''}`}>
                                      <Upload size={10} />
                                      {uploadingComboImage === row.key ? 'Uploading…' : 'Add Image'}
                                      <input
                                        type="file"
                                        accept="image/jpeg,image/png,image/webp"
                                        className="hidden"
                                        onChange={(e) => {
                                          void handleComboImageUpload(row.key, e.target.files?.[0]);
                                          e.target.value = '';
                                        }}
                                      />
                                    </label>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
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
            disabled={submitting || uploadingColorImage !== null || uploadingPotImage !== null || uploadingDefaultImage || uploadingComboImage !== null}
            className="flex-1 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/95 disabled:opacity-60 transition"
          >
            {uploadingColorImage !== null
              ? 'Uploading Color Image...'
              : uploadingPotImage !== null
              ? 'Uploading Pot Image...'
              : uploadingDefaultImage
                ? 'Uploading Default Image...'
                : uploadingComboImage !== null
                  ? 'Uploading Combo Image...'
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
