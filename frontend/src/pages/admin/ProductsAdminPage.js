import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Edit2, Plus, Search, Trash2, X, ChevronDown, ChevronUp, Image as ImageIcon, AlertTriangle, Upload, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useProduct, useProductRaw, useProducts, useAdminAllProducts } from '@/hooks/useProducts';
import { useCategories } from '@/hooks/useCategories';
import { useAdminTags, useDeleteTag, useTags, useUpsertTag } from '@/hooks/useTags';
import { useAdminDisplaySections } from '@/hooks/useDisplaySections';
import { useDeleteProduct } from '@/hooks/useAdmin';
import api from '@/lib/api';
import { getApiErrorDetail } from '@/lib/apiError';
import { toTagKey } from '@/lib/tagKey';
import PotPriceEditor, {} from '@/components/admin/PotPriceEditor';
import { useQueryClient } from '@tanstack/react-query';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
function genId(prefix) {
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}
function emptyOption() {
    return { id: genId('opt'), name: '', price: 0, image_keys: [], image_urls: [], color_hex: '', uploading: false };
}
function emptyGroup() {
    return { id: genId('vg'), label: '', always_show_options: false, options: [emptyOption()] };
}
// Stable empty array so `watch('additional_category_ids') ?? EMPTY` does not hand
// the derived memos a fresh identity on every render.
const EMPTY_CATEGORY_IDS = [];
const productSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    description: z.string().optional(),
    price: z.coerce.number().positive('Price must be a positive number'),
    original_price: z.coerce.number().positive().optional().or(z.literal(0)),
    stock_qty: z.coerce.number().int().min(0, 'Stock cannot be negative'),
    category_id: z.coerce.number().int().positive('Please select a category'),
    // Categories beyond the primary one. Kept as plain numbers (no field array) so
    // the checkbox group can be read straight off the form state.
    additional_category_ids: z.array(z.number().int().positive()).optional(),
    display_section: z.string().optional(),
    how_to_guide: z.string().optional(),
    tags: z.array(z.object({ value: z.string().optional() })).optional(),
    care_tips: z.array(z.object({ value: z.string() })).optional(),
});
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
async function cropToSquare(file) {
    // createImageBitmap applies EXIF orientation for us
    const bitmap = await createImageBitmap(file);
    const size = Math.min(bitmap.width, bitmap.height);
    const sx = (bitmap.width - size) / 2;
    const sy = (bitmap.height - size) / 2;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
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
        canvas.toBlob((blob) => {
            if (!blob) {
                reject(new Error('Canvas toBlob failed'));
                return;
            }
            resolve(new File([blob], file.name, { type: outputType, lastModified: Date.now() }));
        }, outputType, quality);
    });
}
function ProductModal({ onClose, editProduct }) {
    const isEdit = !!editProduct;
    // useProduct (public endpoint, resolved URLs) — used for display fields only (name, price, etc.)
    const { data: freshProduct, isLoading: isLoadingProduct } = useProduct(editProduct?.slug ?? '');
    // useProductRaw (admin endpoint, raw relative keys) — used to seed image key state for edit
    const { data: rawProduct } = useProductRaw(isEdit ? (editProduct?.id ?? null) : null);
    const { data: categories } = useCategories();
    const { data: displaySections = [] } = useAdminDisplaySections();
    const { data: globalTags = [] } = useTags();
    const qc = useQueryClient();
    const allCats = categories?.flatMap((c) => [c, ...(c.children ?? [])]) ?? [];
    const globalTagColors = useMemo(() => {
        const map = {};
        globalTags.forEach((t) => {
            if (t.color)
                map[toTagKey(t.name)] = t.color;
        });
        return map;
    }, [globalTags]);
    const [submitting, setSubmitting] = useState(false);
    const [variantError, setVariantError] = useState(null);
    const upsertTag = useUpsertTag();
    const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
    const [showNewTagForm, setShowNewTagForm] = useState(false);
    const [showManageTags, setShowManageTags] = useState(false);
    const [newTagName, setNewTagName] = useState('');
    const [newTagColor, setNewTagColor] = useState('#1B4332');
    // `/tags/admin` also returns inactive tags, so hidden ones stay deletable.
    const { data: allTags = [] } = useAdminTags();
    const deleteTag = useDeleteTag();
    const matchingSavedTag = useMemo(() => allTags.find((t) => newTagName.trim().toLowerCase() === t.name.trim().toLowerCase()) ?? null, [allTags, newTagName]);
    const [formInitialized, setFormInitialized] = useState(!isEdit);
    // Form Collapsible Sections
    const [openSections, setOpenSections] = useState({
        basic: true,
        pricing: true,
        details: false,
        images: false,
        faqs: false,
        variants: false,
        seo: false,
        related: false,
        badges: false,
    });
    const toggleSection = (section) => {
        setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
    };
    // Image Management
    const [productImages, setProductImages] = useState([]);
    const [newImageUrl, setNewImageUrl] = useState('');
    const [uploadedFiles, setUploadedFiles] = useState([]);
    const [filePreviews, setFilePreviews] = useState([]);
    const handleAddImageUrl = () => {
        if (newImageUrl.trim()) {
            setProductImages([...productImages, newImageUrl.trim()]);
            setNewImageUrl('');
        }
    };
    const handleRemoveImageUrl = (index) => {
        setProductImages(productImages.filter((_, i) => i !== index));
    };
    const handleFileChange = async (e) => {
        const files = e.target.files;
        if (!files)
            return;
        const cropped = await Promise.all(Array.from(files).map(cropToSquare));
        setUploadedFiles((prev) => [...prev, ...cropped]);
        const previews = cropped.map((f) => URL.createObjectURL(f));
        setFilePreviews((prev) => [...prev, ...previews]);
    };
    const handleRemoveFile = (index) => {
        setUploadedFiles(uploadedFiles.filter((_, i) => i !== index));
        setFilePreviews(filePreviews.filter((_, i) => i !== index));
    };
    // Variant States — new flexible variant groups
    const [variantGroups, setVariantGroups] = useState([]);
    const [uploadingOptionImage, setUploadingOptionImage] = useState(null); // optionId
    const [uploadingDefaultImage, setUploadingDefaultImage] = useState(false);
    // defaultImageKey: relative key sent to backend. defaultImageUrl: full URL for preview only.
    const [defaultImageKey, setDefaultImageKey] = useState('');
    const [defaultImageUrl, setDefaultImageUrl] = useState('');
    // Combo image map: keyed by "optId1__optId2__..." joining one optId per group in group order.
    // image_keys = relative keys (sent to backend). image_urls = resolved URLs (display only).
    const [comboImageKeys, setComboImageKeys] = useState({});
    const [comboImageUrls, setComboImageUrls] = useState({});
    // Per-combination stock: keyed by combo_key (same space as comboImageKeys). Dense on save.
    const [comboStock, setComboStock] = useState({});
    // Per-combination price: keyed by combo_key (same space as comboImageKeys). When a row
    // has a value it overrides the per-option sum, letting each combination carry its own
    // price (e.g. Small/Krish ₹300 vs Medium/Krish ₹350). Dense on save.
    const [uploadingComboKey, setUploadingComboKey] = useState(null);
    // pot_price: the N-axis grid, and the ONLY place a variant product's price is authored.
    const [potPriceDraft, setPotPriceDraft] = useState(null);
    // Plantoga Promise banner — per-product image replacing the four hardcoded cards
    // promiseBannerKey: relative key stored in DB. promiseBannerUrl: resolved URL for preview only.
    const [promiseBannerKey, setPromiseBannerKey] = useState('');
    const [promiseBannerUrl, setPromiseBannerUrl] = useState('');
    const [uploadingPromiseBanner, setUploadingPromiseBanner] = useState(false);
    // Why Plantoga banner — per-product image replacing the comparison table
    const [whyPlantogaBannerKey, setWhyPlantogaBannerKey] = useState('');
    const [whyPlantogaBannerUrl, setWhyPlantogaBannerUrl] = useState('');
    const [uploadingWhyPlantogaBanner, setUploadingWhyPlantogaBanner] = useState(false);
    // Care Card image — per-product image shown above the care card tiles
    const [careCardImageKey, setCareCardImageKey] = useState('');
    const [careCardImageUrl, setCareCardImageUrl] = useState('');
    const [uploadingCareCardImage, setUploadingCareCardImage] = useState(false);
    // Per-product image overlay badge controls
    const [isBestseller, setIsBestseller] = useState(false);
    // Per-product FAQ entries
    const [faqItems, setFaqItems] = useState([]);
    const DEFAULT_FAQ = { question: '', answer: '' };
    // Related products (You May Also Like)
    const [relatedProductIds, setRelatedProductIds] = useState([]);
    const [relatedSearch, setRelatedSearch] = useState('');
    const { data: allProductsData } = useAdminAllProducts();
    const allProducts = allProductsData?.items ?? [];
    // Tracks whether the raw product image keys have been seeded into variant state.
    // Stored as state (not a ref) so that changing it triggers a re-render, which is
    // required for formReady to update the Save button's disabled state correctly.
    // The ref-during-render lint error fires if this is a useRef.
    const [rawProductSeededId, setRawProductSeededId] = useState(null);
    // True once form fields are initialized. For edit mode, also wait for rawProduct
    // to be seeded so option image_keys are populated — saving before that would wipe
    // existing variant images.
    const rawProductSeeded = !isEdit || rawProductSeededId === (editProduct?.id ?? null);
    const formReady = formInitialized && rawProductSeeded;
    // Derive a display URL from a relative storage key.
    // Full URLs pass through unchanged (external images, legacy data).
    function resolveImageUrl(key) {
        if (!key)
            return '';
        if (key.startsWith('http://') || key.startsWith('https://'))
            return key;
        const cdn = import.meta.env.VITE_CDN_BASE_URL || '';
        if (cdn)
            return `${cdn.replace(/\/$/, '')}/${key.replace(/^\//, '')}`;
        const backendUrl = import.meta.env.VITE_API_BASE_URL || '';
        return `${backendUrl.replace(/\/api\/v1$/, '').replace(/\/$/, '')}/static/${key.replace(/^\//, '')}`;
    }
    useBodyScrollLock(true);
    const { register, handleSubmit, control, watch, reset, setValue, formState: { errors } } = useForm({
        resolver: zodResolver(productSchema),
        defaultValues: {
            name: '',
            description: '',
            price: 0,
            original_price: undefined,
            stock_qty: 0,
            category_id: undefined,
            additional_category_ids: [],
            display_section: '',
            how_to_guide: '',
            tags: [],
            care_tips: [],
        },
    });
    const selectedDisplaySection = watch('display_section');
    const primaryCategoryId = watch('category_id');
    const selectedExtraCategoryIds = watch('additional_category_ids') ?? EMPTY_CATEGORY_IDS;
    function toggleAdditionalCategory(catId) {
        const current = selectedExtraCategoryIds ?? [];
        const next = current.includes(catId)
            ? current.filter((id) => id !== catId)
            : [...current, catId];
        setValue('additional_category_ids', next, { shouldDirty: true, shouldValidate: true });
    }
    // Nested tree of parents with their subcategories underneath, so an admin can see
    // where a product will surface before ticking it. Parents stay open unless
    // explicitly collapsed.
    const [collapsedCatParents, setCollapsedCatParents] = useState({});
    const extraCategorySet = useMemo(() => new Set(selectedExtraCategoryIds), [selectedExtraCategoryIds]);
    function CategoryPill({ cat, isChild = false, }) {
        const isPrimary = primaryCategoryId === cat.id;
        const isChecked = isPrimary || extraCategorySet.has(cat.id);
        return (_jsxs("button", { type: "button", disabled: isPrimary, "aria-pressed": isChecked, onClick: () => toggleAdditionalCategory(cat.id), title: isPrimary
                ? 'This is the primary category'
                : isChecked
                    ? `Remove ${cat.name} from this product`
                    : `Also list this product under ${cat.name}`, className: `inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-xs transition touch-target ${isPrimary
                ? 'bg-primary/10 border-primary/30 text-primary cursor-not-allowed'
                : isChecked
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-gray-400'}`, children: [_jsx("span", { "aria-hidden": "true", children: isChecked ? '✓' : '+' }), isChild && _jsx("span", { "aria-hidden": "true", className: isChecked ? 'opacity-80' : 'text-gray-300', children: "\u21B3" }), cat.name, isPrimary && _jsx("span", { className: "opacity-70", children: "primary" })] }));
    }
    const assignableSections = useMemo(() => displaySections.filter((section) => section.is_active), [displaySections]);
    const hiddenSectionName = useMemo(() => {
        if (!selectedDisplaySection)
            return null;
        return displaySections.find((section) => section.key === selectedDisplaySection)?.name ?? null;
    }, [displaySections, selectedDisplaySection]);
    const { fields: tagFields, append: addTag, remove: removeTag } = useFieldArray({ control, name: 'tags' });
    const { fields: tipFields, append: addTip, remove: removeTip } = useFieldArray({ control, name: 'care_tips' });
    const addTagByName = (name) => {
        const trimmed = name.trim();
        if (!trimmed)
            return;
        const exists = tagFields.some((f) => (f.value || '').trim().toLowerCase() === trimmed.toLowerCase());
        if (!exists)
            addTag({ value: trimmed });
    };
    const availableTags = globalTags.filter((t) => t.is_active && !tagFields.some((f) => (f.value || '').trim().toLowerCase() === t.name.toLowerCase()));
    const createNewTag = async () => {
        const name = newTagName.trim();
        if (!name)
            return;
        try {
            // Re-submitting an existing name must recolour that tag, not append a
            // duplicate row. The service de-duplicates slugs with a `-2` suffix, so a
            // blind POST would create `vastu-friendly-2` and leave the badge — which
            // resolves by the original slug — stuck on the old colour.
            const existing = matchingSavedTag;
            if (existing) {
                await upsertTag.mutateAsync({ id: existing.id, name, color: newTagColor });
            }
            else {
                await upsertTag.mutateAsync({ name, color: newTagColor });
            }
            addTagByName(name);
            setNewTagName('');
            setNewTagColor('#1B4332');
            toast.success(existing ? `Tag "${name}" updated` : `Tag "${name}" saved`);
        }
        catch (err) {
            toast.error(getApiErrorDetail(err, 'Could not create tag'));
        }
    };
    const recolorTag = async (tag, color) => {
        try {
            await upsertTag.mutateAsync({ id: tag.id, name: tag.name, color });
            toast.success(`Tag "${tag.name}" recoloured`);
        }
        catch (err) {
            toast.error(getApiErrorDetail(err, 'Could not update tag colour'));
        }
    };
    const deleteSavedTag = async (tag) => {
        if (!window.confirm(`Delete the saved tag "${tag.name}"?\n\nProducts already using it will simply stop showing the badge.`)) {
            return;
        }
        try {
            await deleteTag.mutateAsync(tag.id);
            toast.success(`Tag "${tag.name}" deleted`);
        }
        catch (err) {
            toast.error(getApiErrorDetail(err, 'Could not delete tag'));
        }
    };
    const applyProductToForm = (p) => {
        reset({
            name: p.name || '',
            description: p.description || '',
            price: p.price || 0,
            original_price: p.original_price || undefined,
            stock_qty: p.stock_qty ?? 0,
            category_id: p.category_id,
            additional_category_ids: p.additional_category_ids ?? [],
            display_section: p.display_section || '',
            how_to_guide: p.how_to_guide || '',
            tags: p.tags?.length ? p.tags.map((value) => ({ value })) : [],
            care_tips: p.care_tips?.length ? p.care_tips.map((value) => ({ value })) : [],
        });
        setProductImages(p.images || []);
        setNewImageUrl('');
        setUploadedFiles([]);
        setFilePreviews([]);
        // Seed variant groups from new format (variant_groups)
        const vg = p.variants?.variant_groups;
        if (Array.isArray(vg)) {
            setVariantGroups(vg.map((group) => ({
                id: group.id || genId('vg'),
                label: group.label || '',
                always_show_options: Boolean(group.always_show_options),
                options: (group.options || []).map((opt) => ({
                    id: opt.id || genId('opt'),
                    name: opt.name || '',
                    price: Number(opt.price ?? 0),
                    // images are already resolved URLs from the API; store first as preview
                    // backend /admin/raw returns relative keys — handled in rawProduct effect
                    image_keys: [],
                    image_urls: opt.images?.filter(Boolean) || [],
                    color_hex: opt.color_hex || '',
                    uploading: false,
                })),
            })));
        }
        else {
            setVariantGroups([]);
        }
        setDefaultImageKey('');
        setDefaultImageUrl('');
        setComboImageKeys({});
        setComboImageUrls({});
        setComboStock({});
        setVariantError(null);
        // Promise banner URL comes pre-resolved from the public API response.
        // The raw key is seeded separately from rawProduct in the useEffect below.
        setPromiseBannerUrl(p.promise_banner_image || '');
        setPromiseBannerKey(''); // will be overwritten by rawProduct effect
        setWhyPlantogaBannerUrl(p.why_plantoga_banner_image || '');
        setWhyPlantogaBannerKey(''); // will be overwritten by rawProduct effect
        setCareCardImageUrl(p.care_card_image || '');
        setCareCardImageKey(''); // will be overwritten by rawProduct effect
        setFaqItems(p.faqs || []);
        setRelatedProductIds(p.related_product_ids || []);
        // Reset badge controls (will be overwritten by rawProduct effect on edit)
        setIsBestseller(Boolean(p.is_bestseller));
    };
    // Seed default_image from the raw admin endpoint (relative key, not resolved URL).
    // Must wait for formInitialized so that variantGroups is already populated before
    // we patch image_keys into options — otherwise prev.map() iterates an empty array.
    // Guard (rawProductSeededId) prevents re-seeding on background refetches.
    // Run during render (guarded by seed id) instead of an effect to avoid the
    // set-state-in-effect hook violation.
    if (isEdit && rawProduct && formInitialized) {
        const incomingId = rawProduct.id ?? null;
        if (rawProductSeededId !== incomingId) {
            setRawProductSeededId(incomingId);
            const v = rawProduct.variants ?? { variant_groups: [] };
            // Seed the pot_price grid. A product with no pot_price starts with no axes ticked
            // rather than a default one, so existing products are not silently repriced.
            if (v.pot_price) {
                setPotPriceDraft({
                    group_ids: [...(v.pot_price.group_ids ?? [])],
                    independent_group_ids: [...(v.pot_price.independent_group_ids ?? [])],
                    map: { ...(v.pot_price.map ?? {}) },
                });
            }
            else {
                setPotPriceDraft(null);
            }
            // Seed default image relative key
            setDefaultImageKey(v.default_image || '');
            setDefaultImageUrl(resolveImageUrl(v.default_image));
            // Seed combo image_map from raw product
            if (v.image_map && typeof v.image_map === 'object') {
                const seedKeys = {};
                const seedUrls = {};
                Object.entries(v.image_map).forEach(([key, imgs]) => {
                    if (Array.isArray(imgs) && imgs.length > 0) {
                        seedKeys[key] = imgs.filter(Boolean);
                        seedUrls[key] = imgs.filter(Boolean).map((k) => resolveImageUrl(k));
                    }
                });
                setComboImageKeys(seedKeys);
                setComboImageUrls(seedUrls);
            }
            // Seed per-combination stock from raw stock_map
            if (v.stock_map && typeof v.stock_map === 'object') {
                const seedStock = {};
                Object.entries(v.stock_map).forEach(([key, qty]) => {
                    const n = Number(qty);
                    seedStock[key] = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
                });
                setComboStock(seedStock);
            }
            // Seed per-option image keys from raw variant_groups
            if (Array.isArray(v.variant_groups)) {
                setVariantGroups(prev => prev.map((group) => {
                    const rawGroup = v.variant_groups.find((rg) => rg.id === group.id);
                    if (!rawGroup)
                        return group;
                    return {
                        ...group,
                        options: group.options.map((opt) => {
                            const rawOpt = rawGroup.options?.find((ro) => ro.id === opt.id);
                            if (!rawOpt)
                                return opt;
                            const rawKeys = (rawOpt.images || []).filter(Boolean);
                            const rawUrls = rawKeys.map((k) => resolveImageUrl(k));
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
            // Seed promise banner raw key
            const rawBannerKey = rawProduct.promise_banner_image || '';
            setPromiseBannerKey(rawBannerKey);
            if (rawBannerKey)
                setPromiseBannerUrl(resolveImageUrl(rawBannerKey));
            // Seed why plantoga banner raw key
            const rawWhyBannerKey = rawProduct.why_plantoga_banner_image || '';
            setWhyPlantogaBannerKey(rawWhyBannerKey);
            if (rawWhyBannerKey)
                setWhyPlantogaBannerUrl(resolveImageUrl(rawWhyBannerKey));
            // Seed care card image raw key
            const rawCareCardKey = rawProduct.care_card_image || '';
            setCareCardImageKey(rawCareCardKey);
            if (rawCareCardKey)
                setCareCardImageUrl(resolveImageUrl(rawCareCardKey));
            // Seed FAQs from raw product
            const rawFaqs = rawProduct.faqs;
            if (Array.isArray(rawFaqs) && rawFaqs.length > 0) {
                setFaqItems(rawFaqs.map((f) => ({ question: f.question || '', answer: f.answer || '' })));
            }
            // Seed related product IDs from raw product
            const rawRelatedIds = rawProduct.related_product_ids;
            if (Array.isArray(rawRelatedIds)) {
                setRelatedProductIds(rawRelatedIds);
            }
            // Seed badge controls from raw product
            setIsBestseller(Boolean(rawProduct.is_bestseller));
        }
    }
    // Initialize the form from the freshly-fetched product. Kept as an effect because it
    // calls react-hook-form's reset() (an external-store mutation that must not run during
    // render). The render-time rawProduct seeding block above waits on formInitialized.
    useEffect(() => {
        if (!isEdit)
            return;
        const source = freshProduct ?? editProduct;
        if (source && !formInitialized) {
            // eslint-disable-next-line react-hooks/set-state-in-effect -- reset() belongs in an effect
            applyProductToForm(source);
            setFormInitialized(true);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- applyProductToForm is recreated each render; the effect re-runs whenever editProduct/freshProduct changes identity anyway
    }, [isEdit, freshProduct, editProduct, formInitialized]);
    // ─── Cartesian product helper ────────────────────────────────────────────
    // Returns rows of { key: "optId1__optId2__...", label: "Name1 / Name2 / ..." }
    //
    // The label is built purely from the option names the admin typed, joined in group order —
    // nothing about it is hardcoded, so renaming a variant type or option relabels the table.
    //
    // Keys are built over EVERY group, including ones that are not fully named yet. The
    // backend's build_combo_key also walks all variant_groups, so dropping an unnamed group
    // here would produce a short key that the backend can never match — stock and images
    // would be written to a key nothing reads, and the product would look out of stock with no
    // error anywhere. Unnamed groups mark their rows `ready: false` so the table can explain
    // itself instead of silently omitting them.
    const COMBO_CAP = 50;
    function buildComboRows(groups) {
        if (groups.length === 0)
            return [];
        // Cartesian product
        let rows = [{ key: '', label: '', ready: true }];
        for (const group of groups) {
            const next = [];
            const groupNamed = !!group.label.trim();
            for (const row of rows) {
                for (const opt of group.options) {
                    const optNamed = !!opt.name.trim();
                    next.push({
                        key: row.key ? `${row.key}__${opt.id}` : opt.id,
                        // Names only, no group prefixes — a group prefix would be a second, differently
                        // formatted copy of the same information in the same cell.
                        label: row.label ? `${row.label} / ${opt.name}` : opt.name,
                        ready: row.ready && groupNamed && optNamed,
                    });
                }
            }
            rows = next;
        }
        return rows;
    }
    // Full dense stock_map (no COMBO_CAP) for the save payload. Every cartesian combo
    // gets a row. Editable rows come from comboStock; overflow rows not present in state
    // fall back to the existing stock_map value (preserves untouched combos), else 0.
    function buildDenseStockMap(groups, comboStockMap, existing) {
        const rows = buildComboRows(groups);
        const map = {};
        for (const row of rows) {
            const qty = comboStockMap[row.key] ?? existing?.[row.key] ?? 0;
            const n = Number(qty);
            map[row.key] = Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0;
        }
        return map;
    }
    async function onSubmit(data) {
        setSubmitting(true);
        try {
            setVariantError(null);
            let variants = null;
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
            let stockMap = null;
            if (cleanGroups.length > 0 || defaultImageKey.trim()) {
                // Build image_map: only include combos that actually have images
                const imageMap = {};
                Object.entries(comboImageKeys).forEach(([key, keys]) => {
                    if (keys.length > 0)
                        imageMap[key] = keys;
                });
                // Build dense stock_map over every cartesian combo (comboStock state, falling
                // back to the existing stock_map for overflow rows, else 0).
                const existingStockMap = rawProduct?.variants?.stock_map;
                stockMap = cleanGroups.length
                    ? buildDenseStockMap(cleanGroups, comboStock, existingStockMap)
                    : null;
                // price_map is RETIRED, not rebuilt.
                //
                // There is no longer a second place to type a price: the grid above is the only
                // pricing surface, so a per-combination table is a second source of truth that can
                // only ever disagree with it. It is also the one entry in the resolver that overrides
                // the grid outright, so a stale map left in the DB would silently keep winning while
                // the admin believed the grid was live.
                //
                // `null` (not omission) is what clears the stored value — the column is part of a
                // whole-object replace, so leaving the key out would preserve the old map.
                //
                // The safety net is that calculate_variant_price now always adds `product.price` as a
                // floor. That matters here: this save also zeroes every per-option delta, so without
                // the floor a product left with no grid would fall to the delta sum and be ₹0.
                variants = {
                    variant_groups: cleanGroups.map(group => ({
                        id: group.id,
                        label: group.label.trim(),
                        always_show_options: group.always_show_options,
                        options: group.options
                            .filter(o => o.name.trim())
                            .map(o => ({
                            id: o.id,
                            name: o.name.trim(),
                            // Retired with the price inputs: any delta still in the draft is stale data
                            // from before the grid, and re-saving it would keep a second pricing source
                            // alive behind the admin's back. Surcharges belong in the grid now.
                            price: 0,
                            // Per-option images — used as colour fallback on product page
                            ...(o.image_keys.length ? { images: o.image_keys } : {}),
                            ...(o.color_hex.trim() ? { color_hex: o.color_hex.trim() } : {}),
                        })),
                    })),
                    ...(Object.keys(imageMap).length ? { image_map: imageMap } : {}),
                    ...(stockMap ? { stock_map: stockMap } : {}),
                    ...(cleanGroups.length ? { price_map: null } : {}),
                    ...(potPriceDraft && (potPriceDraft.group_ids?.length ?? 0) > 0
                        ? {
                            pot_price: {
                                group_ids: potPriceDraft.group_ids,
                                independent_group_ids: potPriceDraft.independent_group_ids ?? [],
                                map: potPriceDraft.map ?? {},
                            },
                        }
                        : {}),
                    default_image: defaultImageKey || undefined,
                };
            }
            // Total stock = sum of all per-combination stock rows (sum(stock_map.values())).
            // Each combination is an independent pool, so total sellable units is the sum.
            // If no variants, fall through to the form field value.
            const totalStock = stockMap
                ? Object.values(stockMap).reduce((sum, n) => sum + (Number(n) || 0), 0)
                : data.stock_qty;
            // The backend drops the primary from the extra set and rejects unknown ids, but
            // sending a clean list keeps the request honest about what the admin picked.
            const additionalCategoryIds = (data.additional_category_ids ?? []).filter((id) => id !== data.category_id);
            const payload = {
                name: data.name,
                description: data.description || '',
                price: data.price,
                original_price: data.original_price || null,
                stock_qty: totalStock,
                category_id: data.category_id,
                additional_category_ids: additionalCategoryIds,
                display_section: data.display_section || null,
                how_to_guide: data.how_to_guide?.trim() || null,
                tags: data.tags?.map((t) => (t.value || '').trim()).filter(Boolean) || [],
                care_tips: data.care_tips?.map((t) => t.value).filter(Boolean) || [],
            };
            if (variants !== null) {
                payload.variants = variants;
            }
            if (editProduct) {
                // Upload any newly selected files first
                const uploadedUrls = [];
                for (const file of uploadedFiles) {
                    const squared = await cropToSquare(file);
                    const fd = new FormData();
                    fd.append('image', squared);
                    fd.append('product_id', String(editProduct.id));
                    const { data: uploadResult } = await api.post('/products/upload-image', fd);
                    uploadedUrls.push(uploadResult.url);
                }
                const finalImages = [...productImages, ...uploadedUrls];
                // Edit page updates via JSON PUT (including product images URL list)
                const updatePayload = {
                    ...payload,
                    images: finalImages,
                    promise_banner_image: promiseBannerKey || null,
                    why_plantoga_banner_image: whyPlantogaBannerKey || null,
                    care_card_image: careCardImageKey || null,
                    faqs: faqItems.filter(f => f.question.trim() && f.answer.trim()),
                    related_product_ids: relatedProductIds.length > 0 ? relatedProductIds : null,
                    is_bestseller: isBestseller,
                };
                const { data: updatedProduct } = await api.put(`/products/${editProduct.id}`, updatePayload);
                toast.success('Product updated successfully!');
                // Replace = delete the previous default image file (admin request):
                // only when the key actually changed, the old key is a managed
                // storage key (not a remote URL), and nothing else still references it
                // (combo image_map, option images, product gallery).
                const oldDefaultKey = rawProduct?.variants?.default_image;
                if (oldDefaultKey &&
                    oldDefaultKey !== defaultImageKey &&
                    !oldDefaultKey.startsWith('http')) {
                    const refs = new Set();
                    const addRef = (x) => {
                        if (typeof x === 'string') {
                            if (x)
                                refs.add(x);
                        }
                        else if (Array.isArray(x))
                            x.forEach(addRef);
                        else if (x && typeof x === 'object')
                            Object.values(x).forEach(addRef);
                    };
                    addRef(rawProduct?.variants);
                    addRef(rawProduct?.images);
                    if (!refs.has(oldDefaultKey)) {
                        void api.delete(`/products/image/${oldDefaultKey}`).catch(() => { });
                    }
                }
                // Update the product detail cache immediately
                qc.setQueryData(['product', updatedProduct.slug], updatedProduct);
                // Patch every cached products-list page that contains this product so
                // the admin list reflects the new stock/images without waiting for a refetch
                qc.setQueriesData({ queryKey: ['products'] }, (old) => {
                    if (!old)
                        return old;
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
            }
            else {
                // New creation uses FormData to support file uploads
                const fd = new FormData();
                fd.append('name', payload.name);
                fd.append('price', String(payload.price));
                fd.append('category_id', String(payload.category_id));
                fd.append('additional_category_ids', JSON.stringify(payload.additional_category_ids));
                fd.append('description', payload.description);
                if (payload.original_price)
                    fd.append('original_price', String(payload.original_price));
                fd.append('stock_qty', String(payload.stock_qty));
                fd.append('tags', JSON.stringify(payload.tags));
                fd.append('care_tips', JSON.stringify(payload.care_tips));
                if (payload.display_section)
                    fd.append('display_section', payload.display_section);
                if (payload.how_to_guide)
                    fd.append('how_to_guide', payload.how_to_guide);
                if (payload.variants)
                    fd.append('variants', JSON.stringify(payload.variants));
                if (promiseBannerKey)
                    fd.append('promise_banner_image', promiseBannerKey);
                if (whyPlantogaBannerKey)
                    fd.append('why_plantoga_banner_image', whyPlantogaBannerKey);
                if (careCardImageKey)
                    fd.append('care_card_image', careCardImageKey);
                const cleanFaqs = faqItems.filter(f => f.question.trim() && f.answer.trim());
                if (cleanFaqs.length)
                    fd.append('faqs', JSON.stringify(cleanFaqs));
                if (relatedProductIds.length)
                    fd.append('related_product_ids', JSON.stringify(relatedProductIds));
                fd.append('is_bestseller', String(isBestseller));
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
        }
        catch (err) {
            toast.error(getApiErrorDetail(err, 'Failed to save product'));
        }
        finally {
            setSubmitting(false);
        }
    }
    const inputClass = "w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors";
    // hasVariants: true if any groups exist or default image is set
    const hasVariants = variantGroups.length > 0 || defaultImageKey.trim().length > 0;
    async function handleOptionImageUpload(groupId, optionId, file) {
        if (!file)
            return;
        setUploadingOptionImage(optionId);
        try {
            const squared = await cropToSquare(file);
            const fd = new FormData();
            fd.append('image', squared);
            if (editProduct?.id)
                fd.append('product_id', String(editProduct.id));
            const { data } = await api.post('/products/variant-image', fd);
            setVariantGroups(prev => prev.map(g => g.id !== groupId ? g : {
                ...g,
                options: g.options.map(o => o.id !== optionId ? o : {
                    ...o,
                    image_keys: [...o.image_keys, data.key],
                    image_urls: [...o.image_urls, data.url],
                }),
            }));
            toast.success('Image uploaded');
        }
        catch (err) {
            toast.error(getApiErrorDetail(err, 'Failed to upload image'));
        }
        finally {
            setUploadingOptionImage(null);
        }
    }
    // ─── Combo image upload / remove ────────────────────────────────────────
    async function handleComboImageUpload(comboKey, file) {
        if (!file)
            return;
        const current = comboImageKeys[comboKey] || [];
        if (current.length >= 8) {
            toast.error('Limit of 8 images per combination');
            return;
        }
        setUploadingComboKey(comboKey);
        try {
            const squared = await cropToSquare(file);
            const fd = new FormData();
            fd.append('image', squared);
            if (editProduct?.id)
                fd.append('product_id', String(editProduct.id));
            const { data } = await api.post('/products/variant-image', fd);
            setComboImageKeys(prev => ({ ...prev, [comboKey]: [...(prev[comboKey] || []), data.key] }));
            setComboImageUrls(prev => ({ ...prev, [comboKey]: [...(prev[comboKey] || []), data.url] }));
            toast.success('Combination image uploaded');
        }
        catch (err) {
            toast.error(getApiErrorDetail(err, 'Failed to upload combination image'));
        }
        finally {
            setUploadingComboKey(null);
        }
    }
    function handleRemoveComboImage(comboKey, index) {
        setComboImageKeys(prev => ({ ...prev, [comboKey]: (prev[comboKey] || []).filter((_, i) => i !== index) }));
        setComboImageUrls(prev => ({ ...prev, [comboKey]: (prev[comboKey] || []).filter((_, i) => i !== index) }));
    }
    async function handleDefaultImageUpload(file) {
        if (!file)
            return;
        setUploadingDefaultImage(true);
        try {
            const squared = await cropToSquare(file);
            const fd = new FormData();
            fd.append('image', squared);
            if (editProduct?.id)
                fd.append('product_id', String(editProduct.id));
            const { data } = await api.post('/products/upload-image', fd);
            // key → stored in payload; url → display only
            setDefaultImageKey(data.key);
            setDefaultImageUrl(data.url);
            toast.success('Default image uploaded');
        }
        catch (err) {
            toast.error(getApiErrorDetail(err, 'Failed to upload default image'));
        }
        finally {
            setUploadingDefaultImage(false);
        }
    }
    async function handlePromiseBannerUpload(file) {
        if (!file)
            return;
        setUploadingPromiseBanner(true);
        try {
            const fd = new FormData();
            fd.append('image', file);
            if (editProduct?.id)
                fd.append('product_id', String(editProduct.id));
            const { data } = await api.post('/products/upload-image', fd);
            setPromiseBannerKey(data.key);
            setPromiseBannerUrl(data.url);
            toast.success('Promise banner uploaded');
        }
        catch (err) {
            toast.error(getApiErrorDetail(err, 'Failed to upload banner image'));
        }
        finally {
            setUploadingPromiseBanner(false);
        }
    }
    async function handleWhyPlantogaBannerUpload(file) {
        if (!file)
            return;
        setUploadingWhyPlantogaBanner(true);
        try {
            const fd = new FormData();
            fd.append('image', file);
            if (editProduct?.id)
                fd.append('product_id', String(editProduct.id));
            const { data } = await api.post('/products/upload-image', fd);
            setWhyPlantogaBannerKey(data.key);
            setWhyPlantogaBannerUrl(data.url);
            toast.success('Why Plantoga banner uploaded');
        }
        catch (err) {
            toast.error(getApiErrorDetail(err, 'Failed to upload banner image'));
        }
        finally {
            setUploadingWhyPlantogaBanner(false);
        }
    }
    async function handleCareCardImageUpload(file) {
        if (!file)
            return;
        setUploadingCareCardImage(true);
        try {
            const fd = new FormData();
            fd.append('image', file);
            if (editProduct?.id)
                fd.append('product_id', String(editProduct.id));
            const { data } = await api.post('/products/upload-image', fd);
            setCareCardImageKey(data.key);
            setCareCardImageUrl(data.url);
            toast.success('Care card image uploaded');
        }
        catch (err) {
            toast.error(getApiErrorDetail(err, 'Failed to upload care card image'));
        }
        finally {
            setUploadingCareCardImage(false);
        }
    }
    // ─── end of handlers ──────────────────────────────────────────────────────
    if (isEdit && (isLoadingProduct || !formInitialized)) {
        return (_jsxs(_Fragment, { children: [_jsx("div", { className: "fixed inset-0 bg-black/55 z-50 transition-opacity", onClick: onClose }), _jsx("div", { className: "fixed inset-y-0 right-0 w-full sm:max-w-2xl bg-[#FAFAF8] shadow-2xl z-50 flex flex-col items-center justify-center", children: _jsx("p", { className: "text-sm text-gray-500", children: "Loading product details..." }) })] }));
    }
    return (_jsxs(_Fragment, { children: [_jsx("div", { className: "fixed inset-0 bg-black/55 z-50 transition-opacity", onClick: onClose }), _jsxs("div", { className: "fixed inset-y-0 right-0 w-full sm:max-w-2xl bg-[#FAFAF8] shadow-2xl z-50 flex flex-col overflow-hidden", children: [_jsxs("div", { className: "flex items-center justify-between px-6 py-4 border-b bg-white shrink-0", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-lg font-bold text-gray-900", children: isEdit ? 'Edit Product' : 'Add New Product' }), _jsx("p", { className: "text-xs text-gray-500 mt-0.5", children: "Fill out product details to display on your website" })] }), _jsx("button", { onClick: onClose, className: "p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors", children: _jsx(X, { size: 20 }) })] }), _jsxs("form", { onSubmit: handleSubmit(onSubmit), className: "flex-1 overflow-y-auto p-6 space-y-4", children: [_jsxs("div", { className: "bg-white rounded-xl border border-gray-200 overflow-hidden", children: [_jsxs("button", { type: "button", onClick: () => toggleSection('basic'), className: "w-full flex items-center justify-between px-5 py-4 font-semibold text-sm text-gray-800 hover:bg-gray-50 text-left", children: [_jsxs("span", { className: "flex items-center gap-2", children: ["\uD83D\uDCE6 ", _jsx("span", { children: "Basic Information" })] }), openSections.basic ? _jsx(ChevronUp, { size: 16 }) : _jsx(ChevronDown, { size: 16 })] }), openSections.basic && (_jsxs("div", { className: "p-5 border-t border-gray-100 space-y-4 bg-white", children: [_jsxs("div", { children: [_jsx("label", { className: "text-xs font-semibold text-gray-700 mb-1 block", children: "Product Name *" }), _jsx("input", { ...register('name'), placeholder: "e.g., Fiddle Leaf Fig", className: inputClass }), _jsx("p", { className: "text-[11px] text-gray-400 mt-1", children: "This is the title customers will see on the website." }), errors.name && _jsx("p", { className: "text-xs text-red-500 mt-1", children: errors.name.message })] }), _jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "text-xs font-semibold text-gray-700 mb-1 block", children: "Category *" }), _jsxs("select", { ...register('category_id'), className: inputClass, children: [_jsx("option", { value: "", children: "Select Category" }), allCats.map((c) => (_jsx("option", { value: c.id, children: c.parent_id ? `↳ ${c.name}` : c.name }, c.id)))] }), _jsx("p", { className: "text-[11px] text-gray-400 mt-1", children: "Select the collection this product belongs to." }), errors.category_id && _jsx("p", { className: "text-xs text-red-500 mt-1", children: errors.category_id.message })] }), _jsxs("div", { children: [_jsx("label", { className: "text-xs font-semibold text-gray-700 mb-1 block", children: "Display Section" }), _jsxs("select", { ...register('display_section'), className: inputClass, children: [_jsx("option", { value: "", children: "None (Hidden from sections)" }), assignableSections.map((section) => (_jsx("option", { value: section.key, children: section.name }, section.id))), selectedDisplaySection &&
                                                                        !assignableSections.some((section) => section.key === selectedDisplaySection) && (_jsxs("option", { value: selectedDisplaySection, children: [hiddenSectionName ?? selectedDisplaySection, " (hidden)"] }))] }), _jsx("p", { className: "text-[11px] text-gray-400 mt-1", children: "Where this product appears on the home page. Hidden sections keep existing assignments but are not offered for new ones." })] })] }), _jsxs("div", { children: [_jsx("label", { className: "text-xs font-semibold text-gray-700 mb-1 block", children: "Also show in" }), categories?.length ? (_jsx("div", { className: "rounded-lg border border-gray-200 p-2 space-y-2", children: categories.map((parent) => {
                                                            const children = parent.children ?? [];
                                                            const isCollapsed = collapsedCatParents[parent.id] ?? false;
                                                            // A collapsed parent would otherwise hide a ticked subcategory,
                                                            // so surface the count on the toggle.
                                                            const selectedChildCount = children.filter((child) => extraCategorySet.has(child.id)).length;
                                                            return (_jsxs("div", { children: [_jsxs("div", { className: "flex items-start gap-1", children: [_jsx("div", { className: "min-w-0 flex-1", children: _jsx(CategoryPill, { cat: parent }) }), children.length > 0 && (_jsxs("div", { className: "flex shrink-0 items-center gap-1", children: [isCollapsed && selectedChildCount > 0 && (_jsx("span", { className: "rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-medium leading-none text-white", children: selectedChildCount })), _jsx("button", { type: "button", onClick: () => setCollapsedCatParents((prev) => ({
                                                                                            ...prev,
                                                                                            [parent.id]: !isCollapsed,
                                                                                        })), "aria-expanded": !isCollapsed, "aria-label": `${isCollapsed ? 'Show' : 'Hide'} subcategories of ${parent.name}`, className: "mt-1 rounded-md p-1.5 text-gray-400 transition hover:bg-gray-50 hover:text-gray-600", children: _jsx(ChevronDown, { className: `h-3.5 w-3.5 transition-transform ${isCollapsed ? '' : 'rotate-180'}` }) })] }))] }), !isCollapsed && children.length > 0 && (_jsx("div", { className: "ml-3 mt-1.5 flex flex-wrap gap-1.5 border-l-2 border-gray-100 pl-3", children: children.map((child) => (_jsx(CategoryPill, { cat: child, isChild: true }, child.id))) }))] }, parent.id));
                                                        }) })) : (_jsx("p", { className: "text-[11px] text-gray-400", children: "No categories created yet." })), _jsx("p", { className: "text-[11px] text-gray-400 mt-1", children: "A product can live in several categories. Shoppers filtering by any of them will find it. The primary category above is always included and cannot be picked twice." })] }), _jsxs("div", { children: [_jsx("label", { className: "text-xs font-semibold text-gray-700 mb-1 block", children: "Product Tags" }), _jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsxs("div", { className: "relative", children: [_jsxs("button", { type: "button", onClick: () => {
                                                                                    setTagDropdownOpen((v) => !v);
                                                                                    setShowNewTagForm(false);
                                                                                }, className: "flex items-center gap-2 px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg bg-white hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20", children: [_jsx("span", { className: "whitespace-nowrap text-gray-500", children: "Choose saved tag\u2026" }), _jsx(ChevronDown, { size: 14, className: `text-gray-400 transition-transform ${tagDropdownOpen ? 'rotate-180' : ''}` })] }), tagDropdownOpen && (_jsx("div", { className: "absolute z-20 mt-1 w-56 max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg p-1", children: availableTags.length === 0 ? (_jsx("p", { className: "px-2 py-2 text-xs text-gray-400", children: "No saved tags yet \u2014 create one below." })) : (availableTags.map((t) => (_jsxs("button", { type: "button", onClick: () => {
                                                                                        addTagByName(t.name);
                                                                                        setTagDropdownOpen(false);
                                                                                    }, className: "w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-primary-light/10 text-left", children: [_jsx("span", { className: "shrink-0 w-3.5 h-3.5 rounded-full border border-gray-200 block", style: { backgroundColor: t.color || '#E5E7EB' } }), _jsx("span", { className: "text-xs text-gray-700", children: t.name })] }, t.id)))) }))] }), _jsx("button", { type: "button", onClick: () => {
                                                                            setShowNewTagForm((v) => !v);
                                                                            setTagDropdownOpen(false);
                                                                        }, className: "px-2.5 py-1.5 text-xs text-gray-600 font-medium hover:bg-gray-100 border border-gray-200 rounded transition", children: showNewTagForm ? 'Hide new tag' : '+ New tag' })] }), showNewTagForm && (_jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2 bg-primary-light/5 border border-primary/10 rounded-lg p-2.5", children: [_jsx("input", { value: newTagName, onChange: (e) => setNewTagName(e.target.value), onKeyDown: (e) => e.key === 'Enter' && createNewTag(), placeholder: "Type a tag name", autoFocus: true, className: "w-40 px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" }), _jsxs("label", { className: "relative flex-1 min-w-[160px] h-8 rounded-lg border border-gray-200 overflow-hidden cursor-pointer block", title: "Tag colour (used everywhere in the catalog)", children: [_jsx("span", { className: "absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-white/90", style: { backgroundColor: newTagColor, textShadow: '0 1px 2px rgba(0,0,0,0.35)' }, children: "colour" }), _jsx("input", { type: "color", value: newTagColor, onChange: (e) => setNewTagColor(e.target.value), className: "absolute inset-0 opacity-0 cursor-pointer w-full h-full" })] }), _jsx("button", { type: "button", onClick: createNewTag, disabled: upsertTag.isPending || !newTagName.trim(), className: "px-2.5 py-1.5 text-xs bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition disabled:opacity-50", children: upsertTag.isPending
                                                                                    ? 'Saving…'
                                                                                    : matchingSavedTag
                                                                                        ? 'Update tag'
                                                                                        : 'Add tag' })] }), matchingSavedTag && (_jsxs("p", { className: "flex items-center gap-1.5 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5", children: [_jsx("span", { className: "shrink-0 w-3 h-3 rounded-full border border-gray-300", style: { backgroundColor: matchingSavedTag.color || '#E5E7EB' } }), _jsxs("span", { children: ["\u201C", matchingSavedTag.name, "\u201D already exists \u2014 saving will change its colour, not create a second tag."] })] }))] })), _jsxs("div", { children: [_jsx("button", { type: "button", onClick: () => setShowManageTags((v) => !v), className: "px-2.5 py-1.5 text-xs text-gray-600 font-medium hover:bg-gray-100 border border-gray-200 rounded transition", children: showManageTags ? 'Hide saved tags' : `Manage saved tags${allTags.length ? ` (${allTags.length})` : ''}` }), showManageTags && (_jsx("div", { className: "mt-2 space-y-1.5 border border-gray-200 rounded-lg bg-white p-2", children: allTags.length === 0 ? (_jsx("p", { className: "px-2 py-2 text-xs text-gray-400", children: "No saved tags yet \u2014 create one above." })) : (allTags.map((t) => (_jsxs("div", { className: "flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-50", children: [_jsxs("label", { className: "relative shrink-0 w-8 h-8 rounded-lg border border-gray-200 overflow-hidden cursor-pointer block", title: `Change colour of "${t.name}"`, children: [_jsx("span", { className: "absolute inset-0", style: { backgroundColor: t.color || '#E5E7EB' } }), _jsx("input", { type: "color", value: t.color || '#E5E7EB', onChange: (e) => recolorTag(t, e.target.value), className: "absolute inset-0 opacity-0 cursor-pointer w-full h-full" })] }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("p", { className: "text-xs font-medium text-gray-700 truncate", children: t.name }), _jsxs("p", { className: "text-[10px] text-gray-400 truncate", children: [t.color || 'no colour', " \u00B7 ", t.slug, !t.is_active && ' · hidden'] })] }), _jsx("button", { type: "button", onClick: () => deleteSavedTag(t), disabled: deleteTag.isPending, className: "shrink-0 p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition", title: `Delete "${t.name}"`, children: _jsx(Trash2, { size: 14 }) })] }, t.id)))) }))] }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [tagFields.map((f, i) => {
                                                                        // Live colour preview from the global tag definition (slugified key)
                                                                        const previewColor = globalTagColors[toTagKey(watch(`tags.${i}.value`) ?? '')] || '#E5E7EB';
                                                                        return (_jsxs("span", { className: "inline-flex items-center gap-1.5 border rounded-full bg-gray-50 px-2.5 py-1", children: [_jsx("span", { className: "shrink-0 w-3.5 h-3.5 rounded-full border border-gray-200 block", style: { backgroundColor: previewColor }, title: "Colour from the global tag" }), _jsx("span", { className: "text-xs text-gray-700", children: f.value }), _jsx("button", { type: "button", onClick: () => removeTag(i), className: "text-red-400 hover:text-red-600", title: "Remove tag", children: _jsx(X, { size: 12 }) })] }, f.id));
                                                                    }), tagFields.length === 0 && (_jsx("p", { className: "text-xs text-gray-400 italic py-2", children: "No tags added yet." }))] }), _jsx("p", { className: "text-[11px] text-gray-400", children: "Pick from saved tags, or create a new one with a colour \u2014 it saves to the tags table and appears under this product." })] })] }), _jsxs("div", { children: [_jsx("label", { className: "text-xs font-semibold text-gray-700 mb-1 block", children: "Description" }), _jsx("textarea", { ...register('description'), rows: 4, placeholder: "Provide details about the plant, its beauty, growth habits, etc.", className: inputClass }), _jsx("p", { className: "text-[11px] text-gray-400 mt-1", children: "Use blank lines for paragraphs and start lines with - for bullet points." })] })] }))] }), _jsxs("div", { className: "bg-white rounded-xl border border-gray-200 overflow-hidden", children: [_jsxs("button", { type: "button", onClick: () => toggleSection('pricing'), className: "w-full flex items-center justify-between px-5 py-4 font-semibold text-sm text-gray-800 hover:bg-gray-50 text-left", children: [_jsxs("span", { className: "flex items-center gap-2", children: ["\uD83D\uDCB0 ", _jsx("span", { children: "Pricing & Inventory" })] }), openSections.pricing ? _jsx(ChevronUp, { size: 16 }) : _jsx(ChevronDown, { size: 16 })] }), openSections.pricing && (_jsx("div", { className: "p-5 border-t border-gray-100 space-y-4 bg-white", children: _jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-3 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "text-xs font-semibold text-gray-700 mb-1 block", children: "Selling Price (\u20B9) *" }), _jsx("input", { type: "number", step: "0.01", ...register('price'), className: inputClass, placeholder: "699" }), _jsx("p", { className: "text-[11px] text-gray-400 mt-1", children: "Active price customers will pay." }), errors.price && _jsx("p", { className: "text-xs text-red-500 mt-1", children: errors.price.message })] }), _jsxs("div", { children: [_jsx("label", { className: "text-xs font-semibold text-gray-700 mb-1 block", children: "Original Price (\u20B9)" }), _jsx("input", { type: "number", step: "0.01", ...register('original_price'), className: inputClass, placeholder: "999" }), _jsxs("p", { className: "text-[11px] text-gray-400 mt-1", children: ["Shows a strikethrough sale price (e.g. ", _jsx("del", { children: "\u20B9999" }), ")."] })] }), _jsxs("div", { children: [_jsx("label", { className: "text-xs font-semibold text-gray-700 mb-1 block", children: "Base Stock Quantity *" }), _jsx("input", { type: "number", ...register('stock_qty'), className: inputClass, placeholder: "10", disabled: hasVariants }), _jsx("p", { className: "text-[11px] text-gray-400 mt-1", children: hasVariants
                                                                ? 'Stock is managed per variant combination below.'
                                                                : 'Total units available for this product.' }), errors.stock_qty && _jsx("p", { className: "text-xs text-red-500 mt-1", children: errors.stock_qty.message })] })] }) }))] }), _jsxs("div", { className: "bg-white rounded-xl border border-gray-200 overflow-hidden", children: [_jsxs("button", { type: "button", onClick: () => toggleSection('details'), className: "w-full flex items-center justify-between px-5 py-4 font-semibold text-sm text-gray-800 hover:bg-gray-50 text-left", children: [_jsxs("span", { className: "flex items-center gap-2", children: ["\uD83C\uDF3F ", _jsx("span", { children: "Plant Care Details" })] }), openSections.details ? _jsx(ChevronUp, { size: 16 }) : _jsx(ChevronDown, { size: 16 })] }), openSections.details && (_jsxs("div", { className: "p-5 border-t border-gray-100 space-y-4 bg-white", children: [_jsxs("div", { className: "border-t pt-4 space-y-2", children: [_jsx("label", { className: "text-xs font-semibold text-gray-700 block", children: "Care Card Image" }), _jsx("p", { className: "text-[10px] text-gray-400", children: "Optional image displayed above the care card tiles." }), _jsxs("div", { className: "flex gap-3 items-center", children: [_jsx("div", { className: "h-16 w-16 rounded-lg border overflow-hidden bg-white shrink-0 flex items-center justify-center", children: careCardImageUrl
                                                                    ? _jsx("img", { src: careCardImageUrl, alt: "Care card", className: "h-full w-full object-cover" })
                                                                    : _jsx(ImageIcon, { size: 22, className: "text-gray-300" }) }), _jsxs("div", { className: "flex-1", children: [_jsxs("label", { className: `inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border bg-white text-xs font-medium text-primary cursor-pointer hover:bg-green-50 w-full justify-center ${uploadingCareCardImage ? 'opacity-60 pointer-events-none' : ''}`, children: [_jsx(Upload, { size: 14 }), uploadingCareCardImage ? 'Uploading…' : careCardImageKey ? 'Change image' : 'Upload image', _jsx("input", { type: "file", accept: "image/jpeg,image/png,image/webp", className: "hidden", onChange: (e) => { void handleCareCardImageUpload(e.target.files?.[0]); e.target.value = ''; } })] }), careCardImageKey && (_jsx("button", { type: "button", onClick: () => { setCareCardImageKey(''); setCareCardImageUrl(''); }, className: "text-xs text-red-500 hover:text-red-600 mt-1 font-medium", children: "Remove image" }))] })] })] }), _jsxs("div", { children: [_jsx("label", { className: "text-xs font-semibold text-gray-700 mb-1 block", children: "How to Guide" }), _jsx("textarea", { ...register('how_to_guide'), rows: 4, placeholder: "e.g. Use well-draining soil and keep it in a spot with soft, indirect light...", className: "w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary resize-y" }), _jsx("p", { className: "text-[11px] text-gray-400 mt-1", children: "Shown as a green card on the product page. Leave blank to auto-build from care tips." })] }), _jsxs("div", { children: [_jsxs("div", { className: "flex items-center justify-between mb-1.5", children: [_jsxs("div", { children: [_jsx("label", { className: "text-xs font-semibold text-gray-700", children: "Care Tips / Bullet Points" }), _jsx("p", { className: "text-[11px] text-gray-400", children: "Step-by-step tips displayed on product page." })] }), _jsx("button", { type: "button", onClick: () => addTip({ value: '' }), className: "px-2.5 py-1 text-xs text-primary font-medium hover:bg-primary-light/10 border border-primary/20 rounded transition", children: "+ Add Tip" })] }), _jsxs("div", { className: "space-y-2", children: [tipFields.map((f, i) => (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("input", { ...register(`care_tips.${i}.value`), placeholder: "e.g. Keep away from air conditioner drafts", className: "flex-1 px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary" }), _jsx("button", { type: "button", onClick: () => removeTip(i), className: "p-2 text-red-500 hover:bg-red-50 rounded-lg transition", children: _jsx(X, { size: 15 }) })] }, f.id))), tipFields.length === 0 && (_jsx("p", { className: "text-xs text-gray-400 italic text-center py-2", children: "No care tips added yet." }))] })] })] }))] }), _jsxs("div", { className: "bg-white rounded-xl border border-gray-200 overflow-hidden", children: [_jsxs("button", { type: "button", onClick: () => toggleSection('images'), className: "w-full flex items-center justify-between px-5 py-4 font-semibold text-sm text-gray-800 hover:bg-gray-50 text-left", children: [_jsxs("span", { className: "flex items-center gap-2", children: ["\uD83D\uDDBC\uFE0F ", _jsx("span", { children: "Images & Gallery" })] }), openSections.images ? _jsx(ChevronUp, { size: 16 }) : _jsx(ChevronDown, { size: 16 })] }), openSections.images && (_jsxs("div", { className: "p-5 border-t border-gray-100 space-y-4 bg-white", children: [_jsxs("div", { children: [_jsx("label", { className: "text-xs font-semibold text-gray-700 mb-1.5 block", children: "Upload Images (Files)" }), _jsxs("div", { className: "border-2 border-dashed border-gray-200 hover:border-primary/50 rounded-xl p-6 text-center transition-colors cursor-pointer relative", children: [_jsx("input", { type: "file", multiple: true, accept: "image/*", onChange: handleFileChange, className: "absolute inset-0 w-full h-full opacity-0 cursor-pointer" }), _jsx(Upload, { size: 28, className: "mx-auto text-gray-400 mb-2" }), _jsx("p", { className: "text-xs font-medium text-gray-700", children: "Click or drag images here to upload" }), _jsx("p", { className: "text-[10px] text-gray-400 mt-1", children: "Supports JPG, PNG, WEBP. Max 5MB per file." })] }), filePreviews.length > 0 && (_jsx("div", { className: "grid grid-cols-4 gap-3 mt-4", children: filePreviews.map((preview, idx) => (_jsxs("div", { className: "relative aspect-square border rounded-lg overflow-hidden group", children: [_jsx("img", { src: preview, alt: "Upload preview", className: "w-full h-full object-cover" }), _jsx("button", { type: "button", onClick: () => handleRemoveFile(idx), className: "absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 shadow transition opacity-90", children: _jsx(X, { size: 12 }) })] }, idx))) }))] }), _jsxs("div", { children: [_jsx("label", { className: "text-xs font-semibold text-gray-700 mb-1.5 block", children: "Image URLs List" }), _jsxs("div", { className: "flex gap-2", children: [_jsx("input", { type: "url", value: newImageUrl, onChange: (e) => setNewImageUrl(e.target.value), placeholder: "Paste image web address (https://...)", className: "flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none" }), _jsx("button", { type: "button", onClick: handleAddImageUrl, className: "px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/95 transition font-semibold", children: "Add URL" })] }), _jsx("p", { className: "text-[11px] text-gray-400 mt-1", children: "You can also paste links from Unsplash, ImageKit, or external hosting." }), productImages.length > 0 && (_jsx("div", { className: "grid grid-cols-4 gap-3 mt-4", children: productImages.map((url, idx) => (_jsxs("div", { className: "relative aspect-square border rounded-lg overflow-hidden group bg-gray-50", children: [_jsx("img", { src: url, alt: "Gallery", className: "w-full h-full object-cover" }), _jsx("button", { type: "button", onClick: () => handleRemoveImageUrl(idx), className: "absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 shadow transition opacity-90", children: _jsx(X, { size: 12 }) })] }, idx))) })), productImages.length === 0 && !filePreviews.length && (_jsx("p", { className: "text-xs text-gray-400 italic text-center py-4 border rounded-xl bg-gray-50/50 mt-4", children: "No images added yet." }))] }), _jsxs("div", { className: "border-t pt-4 space-y-2", children: [_jsx("label", { className: "text-xs font-semibold text-gray-700 block", children: "Plantoga Promise Banner" }), _jsx("p", { className: "text-[10px] text-gray-400", children: "Replaces the four trust cards when set." }), _jsxs("div", { className: "flex gap-3 items-center", children: [_jsx("div", { className: "h-16 w-16 rounded-lg border overflow-hidden bg-white shrink-0 flex items-center justify-center", children: promiseBannerUrl
                                                                    ? _jsx("img", { src: promiseBannerUrl, alt: "Promise banner", className: "h-full w-full object-cover" })
                                                                    : _jsx(ImageIcon, { size: 22, className: "text-gray-300" }) }), _jsxs("div", { className: "flex-1", children: [_jsxs("label", { className: `inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border bg-white text-xs font-medium text-primary cursor-pointer hover:bg-green-50 w-full justify-center ${uploadingPromiseBanner ? 'opacity-60 pointer-events-none' : ''}`, children: [_jsx(Upload, { size: 14 }), uploadingPromiseBanner ? 'Uploading…' : promiseBannerKey ? 'Change banner' : 'Upload banner', _jsx("input", { type: "file", accept: "image/jpeg,image/png,image/webp", className: "hidden", onChange: (e) => { void handlePromiseBannerUpload(e.target.files?.[0]); e.target.value = ''; } })] }), promiseBannerKey && (_jsx("button", { type: "button", onClick: () => { setPromiseBannerKey(''); setPromiseBannerUrl(''); }, className: "text-xs text-red-500 hover:text-red-600 mt-1 font-medium", children: "Remove banner" }))] })] })] }), _jsxs("div", { className: "border-t pt-4 space-y-2", children: [_jsx("label", { className: "text-xs font-semibold text-gray-700 block", children: "Why Plantoga Banner" }), _jsx("p", { className: "text-[10px] text-gray-400", children: "Replaces the \"Plantoga vs the rest\" comparison table when set." }), _jsxs("div", { className: "flex gap-3 items-center", children: [_jsx("div", { className: "h-16 w-16 rounded-lg border overflow-hidden bg-white shrink-0 flex items-center justify-center", children: whyPlantogaBannerUrl
                                                                    ? _jsx("img", { src: whyPlantogaBannerUrl, alt: "Why Plantoga banner", className: "h-full w-full object-cover" })
                                                                    : _jsx(ImageIcon, { size: 22, className: "text-gray-300" }) }), _jsxs("div", { className: "flex-1", children: [_jsxs("label", { className: `inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border bg-white text-xs font-medium text-primary cursor-pointer hover:bg-green-50 w-full justify-center ${uploadingWhyPlantogaBanner ? 'opacity-60 pointer-events-none' : ''}`, children: [_jsx(Upload, { size: 14 }), uploadingWhyPlantogaBanner ? 'Uploading…' : whyPlantogaBannerKey ? 'Change banner' : 'Upload banner', _jsx("input", { type: "file", accept: "image/jpeg,image/png,image/webp", className: "hidden", onChange: (e) => { void handleWhyPlantogaBannerUpload(e.target.files?.[0]); e.target.value = ''; } })] }), whyPlantogaBannerKey && (_jsx("button", { type: "button", onClick: () => { setWhyPlantogaBannerKey(''); setWhyPlantogaBannerUrl(''); }, className: "text-xs text-red-500 hover:text-red-600 mt-1 font-medium", children: "Remove banner" }))] })] })] })] }))] }), _jsxs("div", { className: "bg-white rounded-xl border border-gray-200 overflow-hidden", children: [_jsxs("button", { type: "button", onClick: () => toggleSection('faqs'), className: "w-full flex items-center justify-between px-5 py-4 font-semibold text-sm text-gray-800 hover:bg-gray-50 text-left", children: [_jsxs("span", { className: "flex items-center gap-2", children: ["\u2753 ", _jsx("span", { children: "FAQs" })] }), openSections.faqs ? _jsx(ChevronUp, { size: 16 }) : _jsx(ChevronDown, { size: 16 })] }), openSections.faqs && (_jsx("div", { className: "p-5 border-t border-gray-100 space-y-4 bg-white", children: _jsxs("div", { children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsxs("div", { children: [_jsx("label", { className: "text-xs font-semibold text-gray-700 block", children: "Product FAQs" }), _jsx("p", { className: "text-[11px] text-gray-400", children: "Questions & answers shown on the product page. Leave empty to show default FAQs." })] }), _jsx("button", { type: "button", onClick: () => setFaqItems(prev => [...prev, { ...DEFAULT_FAQ }]), className: "px-2.5 py-1 text-xs text-primary font-medium hover:bg-primary-light/10 border border-primary/20 rounded transition", children: "+ Add FAQ" })] }), _jsxs("div", { className: "space-y-3", children: [faqItems.map((item, index) => (_jsx("div", { className: "rounded-xl border border-gray-200 p-3 bg-gray-50/40 space-y-2", children: _jsxs("div", { className: "flex items-start gap-2", children: [_jsxs("div", { className: "flex-1 space-y-1.5", children: [_jsx("input", { value: item.question, onChange: (e) => setFaqItems(prev => prev.map((f, i) => i === index ? { ...f, question: e.target.value } : f)), placeholder: "Question (e.g. How do I care for my plant?)", className: "w-full px-2.5 py-1.5 text-xs border rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-primary" }), _jsx("textarea", { value: item.answer, onChange: (e) => setFaqItems(prev => prev.map((f, i) => i === index ? { ...f, answer: e.target.value } : f)), placeholder: "Answer", rows: 2, className: "w-full px-2.5 py-1.5 text-xs border rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-primary resize-y" })] }), _jsx("button", { type: "button", onClick: () => setFaqItems(prev => prev.filter((_, i) => i !== index)), className: "p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition shrink-0 mt-0.5", children: _jsx(X, { size: 14 }) })] }) }, index))), faqItems.length === 0 && (_jsx("p", { className: "text-xs text-gray-400 italic text-center py-2", children: "No FAQs added yet. Default FAQs will be shown on the product page." }))] })] }) }))] }), _jsxs("div", { className: "bg-white rounded-xl border border-gray-200 overflow-hidden", children: [_jsxs("button", { type: "button", onClick: () => toggleSection('variants'), className: "w-full flex items-center justify-between px-5 py-4 font-semibold text-sm text-gray-800 hover:bg-gray-50 text-left", children: [_jsxs("span", { className: "flex items-center gap-2", children: ["\uD83C\uDFA8 ", _jsx("span", { children: "Product Variants (Advanced)" })] }), openSections.variants ? _jsx(ChevronUp, { size: 16 }) : _jsx(ChevronDown, { size: 16 })] }), openSections.variants && (_jsxs("div", { className: "p-5 border-t border-gray-100 space-y-5 bg-white", children: [_jsxs("div", { className: "rounded-lg bg-green-50 border border-green-100 p-3 text-xs text-green-800 leading-relaxed", children: [_jsx("strong", { children: "How variants work:" }), " Click \u201C+ Add Variant Type\u201D, type a label (e.g. \u201CSelect Size\u201D, \u201CSelect Packet Size\u201D), then add options with name and price. Stock is set per combination in the \u201CVariant Combinations\u201D table below \u2014 the only stock field that matters. Admin controls all labels \u2014 no category rules."] }), variantError && (_jsxs("div", { className: "rounded-lg bg-red-50 border border-red-100 p-3 flex gap-2 text-xs text-red-800", children: [_jsx(AlertTriangle, { size: 15, className: "shrink-0 mt-0.5" }), _jsx("span", { children: variantError })] })), _jsx("div", { className: "space-y-3", children: variantGroups.map((group) => (_jsxs("div", { className: "rounded-xl border border-gray-200 bg-gray-50/40 overflow-hidden", children: [_jsxs("div", { className: "flex items-center gap-2 px-3 pt-3 pb-2", children: [_jsx("input", { value: group.label, onChange: (e) => {
                                                                        const v = e.target.value;
                                                                        setVariantGroups(prev => prev.map(g => g.id === group.id ? { ...g, label: v } : g));
                                                                    }, placeholder: 'Variant label shown to customer (e.g. "Select Size", "Select Packet Size", "Select Colour")', className: `${inputClass} flex-1 bg-white font-medium` }), _jsx("button", { type: "button", onClick: () => setVariantGroups(prev => prev.filter(g => g.id !== group.id)), className: "p-2 text-red-400 hover:bg-red-50 rounded-lg transition shrink-0", "aria-label": "Remove variant type", children: _jsx(Trash2, { size: 15 }) })] }), _jsxs("div", { className: "flex items-center gap-2 px-3 pb-2", children: [_jsxs("label", { className: "flex items-center gap-2 text-xs text-gray-600 cursor-pointer select-none", children: [_jsx("input", { type: "checkbox", checked: group.always_show_options, onChange: (e) => {
                                                                                const v = e.target.checked;
                                                                                setVariantGroups(prev => prev.map(g => g.id === group.id ? { ...g, always_show_options: v } : g));
                                                                            }, className: "h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" }), _jsxs("span", { children: ["Always show every option (ignores stock)", _jsx("span", { className: "text-gray-400 font-normal", children: "\u00A0\u2014 e.g. always display Small / Medium / Large" })] })] }), /size/i.test(group.label) && !group.always_show_options && (_jsx("span", { className: "text-[10px] font-medium text-amber-600 bg-amber-50 border border-amber-100 rounded-full px-2 py-0.5", children: "Tip: this label looks like a size group \u2014 tick the box so sizes always appear" }))] }), _jsxs("div", { className: "px-3 pb-3 space-y-2", children: [group.options.map((opt) => {
                                                                    const isColourGroup = /colou?r/i.test(group.label);
                                                                    return (_jsxs("div", { className: "rounded-lg border border-gray-200 bg-white p-2.5 space-y-2", children: [_jsxs("div", { className: "flex gap-2 items-center", children: [isColourGroup ? (_jsx("label", { className: "relative h-10 w-10 rounded-full border-2 border-gray-300 overflow-hidden shrink-0 cursor-pointer hover:border-primary/60 transition shadow-sm", title: opt.color_hex ? `Colour: ${opt.color_hex}` : 'Click to pick a colour', style: { backgroundColor: opt.color_hex || '#e5e7eb' }, children: _jsx("input", { type: "color", value: opt.color_hex || '#000000', onChange: (e) => {
                                                                                                const v = e.target.value;
                                                                                                setVariantGroups(prev => prev.map(g => g.id !== group.id ? g : {
                                                                                                    ...g, options: g.options.map(o => o.id !== opt.id ? o : { ...o, color_hex: v }),
                                                                                                }));
                                                                                            }, className: "absolute inset-0 w-full h-full opacity-0 cursor-pointer" }) })) : (_jsxs("label", { className: `relative h-10 w-10 rounded-lg border border-gray-200 overflow-hidden bg-gray-50 shrink-0 flex items-center justify-center cursor-pointer hover:border-primary/60 transition group ${uploadingOptionImage === opt.id ? 'opacity-60 pointer-events-none' : ''}`, title: opt.image_urls[0] ? 'Add more images below' : 'Upload image', children: [uploadingOptionImage === opt.id ? (_jsx(Loader2, { size: 14, className: "animate-spin text-primary" })) : opt.image_urls[0] ? (_jsxs(_Fragment, { children: [_jsx("img", { src: opt.image_urls[0], alt: opt.name || 'option', className: "h-full w-full object-cover" }), _jsx("span", { className: "absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-primary text-white text-[9px] font-bold flex items-center justify-center", children: opt.image_urls.length })] })) : (_jsxs("div", { className: "flex flex-col items-center gap-0.5 text-primary/60", children: [_jsx(Upload, { size: 13 }), _jsx("span", { className: "text-[8px] font-medium leading-none", children: "Image" })] })), _jsx("input", { type: "file", accept: "image/jpeg,image/png,image/webp", className: "hidden", onChange: (e) => { void handleOptionImageUpload(group.id, opt.id, e.target.files?.[0]); e.target.value = ''; } })] })), _jsxs("div", { className: "flex-1 flex flex-col gap-1", children: [_jsx("input", { value: opt.name, onChange: (e) => {
                                                                                                    const v = e.target.value;
                                                                                                    setVariantGroups(prev => prev.map(g => g.id !== group.id ? g : {
                                                                                                        ...g, options: g.options.map(o => o.id !== opt.id ? o : { ...o, name: v }),
                                                                                                    }));
                                                                                                }, placeholder: isColourGroup ? 'Colour name (e.g. "Forest Green")' : 'Name (e.g. "4 Inch", "100 gm")', className: `${inputClass} flex-1` }), isColourGroup && (_jsx("span", { className: "text-[10px] text-gray-400 pl-1", children: opt.color_hex ? opt.color_hex : 'Click the circle to pick a colour' }))] }), _jsx("button", { type: "button", onClick: () => setVariantGroups(prev => prev.map(g => g.id !== group.id ? g : {
                                                                                            ...g, options: g.options.filter(o => o.id !== opt.id),
                                                                                        })), disabled: group.options.length <= 1, className: "p-2 text-red-400 hover:bg-red-50 rounded-lg transition shrink-0 disabled:opacity-30", "aria-label": "Remove option", children: _jsx(X, { size: 14 }) })] }), _jsx("div", { className: "flex gap-2 items-center flex-wrap pl-12", children: isColourGroup && (_jsxs("label", { className: `inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border bg-gray-50 text-[11px] font-medium text-primary cursor-pointer hover:bg-green-50 shrink-0 ${uploadingOptionImage === opt.id ? 'opacity-60 pointer-events-none' : ''}`, title: "Upload colour photo", children: [uploadingOptionImage === opt.id
                                                                                            ? _jsx(Loader2, { size: 12, className: "animate-spin" })
                                                                                            : opt.image_urls[0]
                                                                                                ? _jsx("img", { src: opt.image_urls[0], alt: "", className: "h-4 w-4 rounded object-cover" })
                                                                                                : _jsx(Upload, { size: 12 }), _jsx("span", { children: opt.image_urls.length > 0 ? `${opt.image_urls.length} photo${opt.image_urls.length > 1 ? 's' : ''}` : 'Add photo' }), _jsx("input", { type: "file", accept: "image/jpeg,image/png,image/webp", className: "hidden", onChange: (e) => { void handleOptionImageUpload(group.id, opt.id, e.target.files?.[0]); e.target.value = ''; } })] })) })] }, opt.id));
                                                                }), _jsx("button", { type: "button", onClick: () => setVariantGroups(prev => prev.map(g => g.id !== group.id ? g : {
                                                                        ...g, options: [...g.options, emptyOption()],
                                                                    })), className: "w-full py-1.5 border border-dashed border-primary/30 rounded-lg text-xs text-primary font-medium hover:bg-green-50/50 hover:border-primary/50 transition", children: "+ Add Option" })] })] }, group.id))) }), _jsxs("button", { type: "button", onClick: () => setVariantGroups(prev => [...prev, emptyGroup()]), className: "w-full py-2.5 border-2 border-dashed border-primary/25 rounded-xl text-sm font-semibold text-primary hover:bg-green-50/50 hover:border-primary/50 transition flex items-center justify-center gap-2", children: [_jsx(Plus, { size: 15 }), "Add Variant Type"] }), variantGroups.length > 0 && (_jsxs("div", { className: "mt-4 border-t pt-4 space-y-3", children: [_jsxs("div", { children: [_jsx("h4", { className: "text-sm font-semibold text-gray-800", children: "Pot Price" }), _jsx("p", { className: "text-xs text-gray-500 mt-0.5", children: "A price that can depend on more than one choice \u2014 e.g. the pot costing more for a bigger plant. Set it here once, instead of retuning a price on every combination row." })] }), _jsx(PotPriceEditor, { productId: editProduct?.id ?? null, groups: variantGroups, draft: potPriceDraft, onChange: setPotPriceDraft, existingPriceMap: rawProduct?.variants?.price_map ?? null, priceMapActive: !!(rawProduct?.variants?.price_map && Object.keys(rawProduct.variants.price_map).length) })] })), (() => {
                                                const comboRows = buildComboRows(variantGroups);
                                                if (comboRows.length === 0)
                                                    return null;
                                                // Only rows whose every group and option is named can be labelled, so only
                                                // those get a row. The rest are counted and explained rather than dropped
                                                // silently — an unlabelled row looks identical to a product with no stock.
                                                const namedRows = comboRows.filter(r => r.ready);
                                                const unnamedCount = comboRows.length - namedRows.length;
                                                const overCap = namedRows.length > COMBO_CAP;
                                                const visibleRows = overCap ? namedRows.slice(0, COMBO_CAP) : namedRows;
                                                const hasAnyComboImage = Object.values(comboImageUrls).some(a => a.length > 0);
                                                return (_jsxs("div", { className: "border-t pt-4 space-y-2", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("span", { className: "text-xs font-semibold text-gray-700 block", children: "Variant Combinations & Images" }), _jsx("p", { className: "text-[10px] text-gray-400 mt-0.5", children: "Set the price and stock for each combination. The price field overrides the summed option prices (each combination can have its own price). Upload a photo per combination \u2014 shown in the gallery when that exact combo is selected. Combinations without a photo fall back to the colour option's image, then the default image." })] }), hasAnyComboImage && (_jsx("button", { type: "button", onClick: () => {
                                                                        if (!confirm('Clear all combination images?'))
                                                                            return;
                                                                        setComboImageKeys({});
                                                                        setComboImageUrls({});
                                                                    }, className: "text-xs text-red-500 hover:text-red-600 font-medium border border-red-200 px-2 py-1 rounded hover:bg-red-50 transition shrink-0", children: "Clear all combo images" }))] }), overCap && (_jsxs("div", { className: "rounded-lg bg-amber-50 border border-amber-200 p-2.5 flex gap-2 items-start text-xs text-amber-800", children: [_jsx(AlertTriangle, { size: 13, className: "shrink-0 mt-0.5" }), _jsxs("span", { children: [namedRows.length, " combinations total \u2014 showing first ", COMBO_CAP, ". Reduce options or groups to see all combinations."] })] })), unnamedCount > 0 && (_jsxs("div", { className: "rounded-lg bg-amber-50 border border-amber-200 p-2.5 flex gap-2 items-start text-xs text-amber-800", children: [_jsx(AlertTriangle, { size: 13, className: "shrink-0 mt-0.5" }), _jsxs("span", { children: [unnamedCount, " combination", unnamedCount > 1 ? 's are' : ' is', " hidden because a variant type or one of its options has no name yet. Name", ' ', unnamedCount > 1 ? 'them' : 'it', " above to set stock and images."] })] })), namedRows.length === 0 && unnamedCount > 0 ? (_jsx("div", { className: "rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4 text-sm text-gray-500", children: "Name every variant type and option to list its combinations here." })) : (_jsx("div", { className: "overflow-x-auto border rounded-lg bg-gray-50/50", children: _jsxs("table", { className: "w-full text-xs text-left", children: [_jsx("thead", { className: "bg-gray-100 text-gray-600 border-b", children: _jsxs("tr", { children: [_jsxs("th", { className: "p-3 font-medium", children: ["Combination", _jsx("span", { className: "font-normal text-gray-400 ml-1", children: "(the option names for this pick)" })] }), _jsxs("th", { className: "p-3 font-medium", children: ["Stock", _jsx("span", { className: "font-normal text-gray-400 ml-1", children: "(per combination)" })] }), _jsxs("th", { className: "p-3 font-medium", children: ["Images", _jsx("span", { className: "font-normal text-gray-400 ml-1", children: "(optional \u2014 falls back to colour / default image)" })] })] }) }), _jsx("tbody", { children: visibleRows.map((row) => {
                                                                            const imgs = comboImageUrls[row.key] || [];
                                                                            const keys = comboImageKeys[row.key] || [];
                                                                            return (_jsxs("tr", { className: "border-b last:border-0 bg-white", children: [_jsx("td", { className: "p-3 font-semibold text-gray-800 align-top pt-4 min-w-[180px]", title: row.label, children: _jsx("span", { className: "break-words", children: row.label }) }), _jsx("td", { className: "p-3 align-top pt-3.5", children: _jsx("input", { type: "number", min: 0, step: 1, value: comboStock[row.key] ?? 0, onChange: (e) => {
                                                                                                const n = Number(e.target.value);
                                                                                                setComboStock(prev => ({
                                                                                                    ...prev,
                                                                                                    [row.key]: Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0,
                                                                                                }));
                                                                                            }, className: "w-20 rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-gray-800 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary/30" }) }), _jsx("td", { className: "p-3", children: _jsxs("div", { className: "flex flex-col gap-2", children: [imgs.length > 0 && (_jsx("div", { className: "flex flex-wrap gap-1.5", children: imgs.map((url, idx) => (_jsxs("div", { className: "relative group h-12 w-12 rounded border overflow-hidden bg-gray-50 shrink-0", children: [_jsx("img", { src: url, alt: "", className: "h-full w-full object-cover" }), _jsx("div", { className: "absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center", children: _jsx("button", { type: "button", onClick: () => handleRemoveComboImage(row.key, idx), className: "p-0.5 text-red-400 hover:text-red-300 bg-black/40 rounded text-[9px] leading-none", title: "Remove", children: "\u2715" }) })] }, idx))) })), imgs.length === 0 && (_jsx("p", { className: "text-[10px] text-gray-400 italic", children: "No image \u2014 will use fallback" })), keys.length < 8 && (_jsxs("label", { className: `inline-flex items-center gap-1 px-2 py-1 rounded border bg-white text-[11px] font-medium text-primary cursor-pointer hover:bg-green-50 self-start transition ${uploadingComboKey === row.key ? 'opacity-60 pointer-events-none' : ''}`, children: [uploadingComboKey === row.key
                                                                                                            ? _jsx(Loader2, { size: 10, className: "animate-spin" })
                                                                                                            : _jsx(Upload, { size: 10 }), uploadingComboKey === row.key ? 'Uploading…' : 'Add Image', _jsx("input", { type: "file", accept: "image/jpeg,image/png,image/webp", className: "hidden", onChange: (e) => { void handleComboImageUpload(row.key, e.target.files?.[0]); e.target.value = ''; } })] }))] }) })] }, row.key));
                                                                        }) })] }) }))] }));
                                            })(), _jsxs("div", { className: "border-t pt-4 space-y-2", children: [_jsx("label", { className: "text-xs font-semibold text-gray-700 block", children: "Default Variant Image" }), _jsx("p", { className: "text-[10px] text-gray-400", children: "Fallback shown if a selected option has no image of its own." }), _jsxs("div", { className: "flex gap-3 items-center", children: [_jsx("div", { className: "h-16 w-16 rounded-lg border overflow-hidden bg-white shrink-0 flex items-center justify-center", children: defaultImageUrl
                                                                    ? _jsx("img", { src: defaultImageUrl, alt: "Default", className: "h-full w-full object-cover" })
                                                                    : _jsx(ImageIcon, { size: 22, className: "text-gray-300" }) }), _jsxs("div", { className: "flex-1", children: [_jsxs("label", { className: `inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border bg-white text-xs font-medium text-primary cursor-pointer hover:bg-green-50 w-full justify-center ${uploadingDefaultImage ? 'opacity-60 pointer-events-none' : ''}`, children: [_jsx(Upload, { size: 14 }), uploadingDefaultImage ? 'Uploading…' : defaultImageKey ? 'Change default image' : 'Upload default image', _jsx("input", { type: "file", accept: "image/jpeg,image/png,image/webp", className: "hidden", onChange: (e) => { void handleDefaultImageUpload(e.target.files?.[0]); e.target.value = ''; } })] }), defaultImageKey && (_jsx("button", { type: "button", onClick: () => { setDefaultImageKey(''); setDefaultImageUrl(''); }, className: "text-xs text-red-500 hover:text-red-600 mt-1 font-medium", children: "Remove image" }))] })] })] })] }))] }), _jsxs("div", { className: "bg-white rounded-xl border border-gray-200 overflow-hidden", children: [_jsxs("button", { type: "button", onClick: () => toggleSection('seo'), className: "w-full flex items-center justify-between px-5 py-4 font-semibold text-sm text-gray-800 hover:bg-gray-50 text-left", children: [_jsxs("span", { className: "flex items-center gap-2", children: ["\uD83D\uDD0D ", _jsx("span", { children: "SEO & Search Tags" })] }), openSections.seo ? _jsx(ChevronUp, { size: 16 }) : _jsx(ChevronDown, { size: 16 })] }), openSections.seo && (_jsx("div", { className: "p-5 border-t border-gray-100 space-y-4 bg-white", children: _jsxs("div", { children: [_jsxs("div", { className: "flex items-center justify-between mb-1.5", children: [_jsxs("div", { children: [_jsx("label", { className: "text-xs font-semibold text-gray-700", children: "Search Tags" }), _jsx("p", { className: "text-[11px] text-gray-400", children: "Add words customers might type in the search bar (e.g. \"indoor\", \"fern\")." })] }), _jsx("button", { type: "button", onClick: () => addTag({ value: '' }), className: "px-2.5 py-1 text-xs text-primary font-medium hover:bg-primary-light/10 border border-primary/20 rounded transition", children: "+ Add Tag" })] }), _jsxs("div", { className: "flex flex-wrap gap-2", children: [tagFields.map((f, i) => (_jsxs("div", { className: "flex items-center gap-1 border rounded-lg bg-gray-50 px-2 py-1", children: [_jsx("input", { ...register(`tags.${i}.value`), placeholder: "tag", className: "w-20 bg-transparent border-0 outline-none text-xs p-0 focus:ring-0" }), _jsx("button", { type: "button", onClick: () => removeTag(i), className: "text-red-400 hover:text-red-600", children: _jsx(X, { size: 12 }) })] }, f.id))), tagFields.length === 0 && (_jsx("p", { className: "text-xs text-gray-400 italic py-2", children: "No tags added yet." }))] })] }) }))] }), _jsxs("div", { className: "bg-white rounded-xl border border-gray-200 overflow-hidden", children: [_jsxs("button", { type: "button", onClick: () => toggleSection('badges'), className: "w-full flex items-center justify-between px-5 py-4 font-semibold text-sm text-gray-800 hover:bg-gray-50 text-left", children: [_jsxs("span", { className: "flex items-center gap-2", children: ["\uD83C\uDFF7\uFE0F ", _jsx("span", { children: "Image Badges" })] }), openSections.badges ? _jsx(ChevronUp, { size: 16 }) : _jsx(ChevronDown, { size: 16 })] }), openSections.badges && (_jsxs("div", { className: "p-5 border-t border-gray-100 space-y-4 bg-white", children: [_jsxs("p", { className: "text-[11px] text-gray-400 leading-relaxed", children: ["The ", _jsx("strong", { children: "% OFF" }), " and ", _jsx("strong", { children: "\u2B50 rating" }), " badges appear on their own whenever a discount or review exists. The bestseller badge is opt-in per product, so tick it here to let this product wear it."] }), _jsxs("label", { className: "flex items-center gap-2.5 cursor-pointer select-none", children: [_jsx("input", { type: "checkbox", checked: isBestseller, onChange: (e) => setIsBestseller(e.target.checked), className: "h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary" }), _jsx("span", { className: "text-xs text-gray-700", children: "Show the bestseller badge on this product image" })] }), _jsxs("p", { className: "text-[11px] text-gray-400 leading-relaxed", children: ["What the badge says and what colour it is are set per category under", ' ', _jsx("strong", { children: "Image Badges" }), " in the admin menu, so one edit covers every product in that category."] })] }))] }), _jsxs("div", { className: "bg-white rounded-xl border border-gray-200 overflow-hidden", children: [_jsxs("button", { type: "button", onClick: () => toggleSection('related'), className: "w-full flex items-center justify-between px-5 py-4 font-semibold text-sm text-gray-800 hover:bg-gray-50 text-left", children: [_jsxs("span", { className: "flex items-center gap-2", children: ["\uD83D\uDCA1 ", _jsx("span", { children: "Related Products (You May Also Like)" })] }), openSections.related ? _jsx(ChevronUp, { size: 16 }) : _jsx(ChevronDown, { size: 16 })] }), openSections.related && (_jsxs("div", { className: "p-5 border-t border-gray-100 space-y-4 bg-white", children: [_jsx("p", { className: "text-[11px] text-gray-400", children: "Select products to show in the \"You May Also Like\" section on this product's detail page. If none are selected, the latest products are shown instead." }), relatedProductIds.length > 0 && (_jsx("div", { className: "flex flex-wrap gap-2", children: relatedProductIds.map((id) => {
                                                    const p = allProducts.find((ap) => ap.id === id);
                                                    return (_jsxs("div", { className: "flex items-center gap-1.5 border rounded-lg bg-primary/5 border-primary/20 px-2.5 py-1.5", children: [_jsx("span", { className: "text-xs font-medium text-gray-700 truncate max-w-[160px]", children: p?.name ?? `#${id}` }), _jsx("button", { type: "button", onClick: () => setRelatedProductIds((prev) => prev.filter((rid) => rid !== id)), className: "text-red-400 hover:text-red-600", children: _jsx(X, { size: 12 }) })] }, id));
                                                }) })), _jsxs("div", { className: "relative", children: [_jsx(Search, { size: 14, className: "absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" }), _jsx("input", { type: "text", value: relatedSearch, onChange: (e) => setRelatedSearch(e.target.value), placeholder: "Search products by name...", className: `${inputClass} pl-8` })] }), relatedSearch.trim() && (_jsxs("div", { className: "border rounded-lg max-h-48 overflow-y-auto bg-white", children: [allProducts
                                                        .filter((p) => p.name.toLowerCase().includes(relatedSearch.toLowerCase()) &&
                                                        p.id !== editProduct?.id &&
                                                        !relatedProductIds.includes(p.id))
                                                        .slice(0, 20)
                                                        .map((p) => (_jsxs("button", { type: "button", onClick: () => {
                                                            setRelatedProductIds((prev) => [...prev, p.id]);
                                                            setRelatedSearch('');
                                                        }, className: "w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2 border-b border-gray-50 last:border-0", children: [_jsx("div", { className: "h-8 w-8 rounded border overflow-hidden bg-gray-100 shrink-0", children: p.images?.[0] ? (_jsx("img", { src: p.images[0], alt: "", className: "h-full w-full object-cover" })) : (_jsx("div", { className: "h-full w-full flex items-center justify-center text-gray-300", children: _jsx(ImageIcon, { size: 14 }) })) }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("p", { className: "text-sm font-medium text-gray-700 truncate", children: p.name }), _jsxs("p", { className: "text-[11px] text-gray-400", children: ["\u20B9", p.price] })] })] }, p.id))), allProducts.filter((p) => p.name.toLowerCase().includes(relatedSearch.toLowerCase()) &&
                                                        p.id !== editProduct?.id &&
                                                        !relatedProductIds.includes(p.id)).length === 0 && (_jsx("p", { className: "px-3 py-2 text-xs text-gray-400 italic", children: "No matching products found." }))] }))] }))] })] }), _jsxs("div", { className: "p-4 sm:p-5 border-t bg-white shrink-0 flex gap-3", children: [_jsx("button", { type: "button", onClick: onClose, className: "flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50 transition", children: "Cancel" }), _jsx("button", { type: "button", onClick: handleSubmit(onSubmit), disabled: !formReady || submitting || uploadingOptionImage !== null || uploadingDefaultImage || uploadingComboKey !== null, className: "flex-1 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/95 disabled:opacity-60 transition", children: !formReady
                                    ? (!formInitialized ? 'Loading...' : 'Loading image keys...')
                                    : uploadingOptionImage !== null
                                        ? 'Uploading Image...'
                                        : uploadingDefaultImage
                                            ? 'Uploading Default Image...'
                                            : submitting
                                                ? 'Saving Product...'
                                                : (isEdit ? 'Save Changes' : 'Publish Product') })] })] })] }));
}
export default function ProductsAdminPage() {
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [showModal, setShowModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState(null);
    // Stock alert filter tab
    const [activeTab, setActiveTab] = useState('all');
    const { data, isLoading } = useProducts({ search: search || undefined, page, limit: 20 });
    const deleteMutation = useDeleteProduct();
    async function handleDelete(id, name) {
        if (!confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`))
            return;
        try {
            await deleteMutation.mutateAsync(id);
            toast.success('Product deleted');
        }
        catch {
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
    const getStockBadge = (qty) => {
        if (qty === 0) {
            return (_jsxs("span", { className: "inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-red-100 text-red-800", children: [_jsx("span", { className: "w-1.5 h-1.5 rounded-full bg-red-500" }), "Out of Stock"] }));
        }
        if (qty <= 5) {
            return (_jsxs("span", { className: "inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 animate-pulse", children: [_jsx("span", { className: "w-1.5 h-1.5 rounded-full bg-amber-500" }), "Low Stock (", qty, ")"] }));
        }
        return (_jsxs("span", { className: "inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full bg-green-100 text-green-800", children: [_jsx("span", { className: "w-1.5 h-1.5 rounded-full bg-green-500" }), "Healthy (", qty, ")"] }));
    };
    return (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex flex-col sm:flex-row sm:items-center justify-between gap-3", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-xl sm:text-2xl font-bold text-gray-900", children: "Products Catalog" }), _jsx("p", { className: "text-xs text-gray-500 mt-0.5", children: "Manage details, stock levels, variants, and visibility of plants on the website." })] }), _jsxs("button", { onClick: () => { setEditingProduct(null); setShowModal(true); }, className: "px-4 py-2.5 bg-primary hover:bg-primary/95 text-white text-sm rounded-lg font-semibold flex items-center justify-center gap-2 transition", children: [_jsx(Plus, { size: 16 }), " Add Product"] })] }), _jsxs("div", { className: "bg-white p-3 border rounded-xl flex flex-col md:flex-row gap-3 items-center justify-between", children: [_jsxs("div", { className: "flex gap-1 border-b md:border-b-0 pb-2 md:pb-0 w-full md:w-auto", children: [_jsx("button", { onClick: () => { setActiveTab('all'); setPage(1); }, className: `px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${activeTab === 'all'
                                    ? 'bg-primary/10 text-primary'
                                    : 'text-gray-600 hover:bg-gray-100'}`, children: "All Products" }), _jsxs("button", { onClick: () => { setActiveTab('low_stock'); setPage(1); }, className: `px-4 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap ${activeTab === 'low_stock'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'text-gray-600 hover:bg-amber-50 hover:text-amber-800'}`, children: [_jsx(AlertTriangle, { size: 13 }), "Low Stock Alerts"] })] }), _jsxs("div", { className: "relative w-full md:max-w-xs", children: [_jsx(Search, { size: 15, className: "absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" }), _jsx("input", { placeholder: "Search products...", value: search, onChange: (e) => { setSearch(e.target.value); setPage(1); }, className: "w-full pl-9 pr-4 py-2 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-light" })] })] }), _jsx("div", { className: "hidden sm:block bg-white rounded-xl border overflow-x-auto shadow-sm", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-left text-gray-500 border-b bg-gray-50", children: [_jsx("th", { className: "px-5 py-3.5 font-semibold text-xs", children: "Product Details" }), _jsx("th", { className: "px-5 py-3.5 font-semibold text-xs", children: "Price" }), _jsx("th", { className: "px-5 py-3.5 font-semibold text-xs", children: "Inventory Status" }), _jsx("th", { className: "px-5 py-3.5 font-semibold text-xs", children: "Active on Site" }), _jsx("th", { className: "px-5 py-3.5 font-semibold text-xs w-24", children: "Actions" })] }) }), _jsx("tbody", { children: isLoading ? (_jsx("tr", { children: _jsx("td", { colSpan: 5, className: "px-5 py-12 text-center text-gray-400", children: "Loading products database..." }) })) : displayedItems.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 5, className: "px-5 py-12 text-center text-gray-400", children: activeTab === 'low_stock' ? 'Excellent! No products are currently low in stock.' : 'No products found.' }) })) : (displayedItems.map((p) => (_jsxs("tr", { className: "border-b last:border-0 hover:bg-gray-50/50 transition-colors", children: [_jsx("td", { className: "px-5 py-3", children: _jsxs("div", { className: "flex items-center gap-3", children: [p.images?.[0] ? (_jsx("img", { src: p.images?.[0], alt: p.name, className: "w-10 h-10 rounded-lg object-cover bg-gray-100 shrink-0 border" })) : (_jsx("div", { className: "w-10 h-10 rounded-lg bg-gray-100 shrink-0 border" })), _jsx("div", { children: _jsx("span", { className: "font-semibold text-gray-900 block", children: p.name }) })] }) }), _jsxs("td", { className: "px-5 py-3", children: [_jsxs("span", { className: "font-medium text-gray-900", children: ["\u20B9", p.price] }), p.original_price && (_jsxs("span", { className: "text-gray-400 text-xs line-through ml-1.5", children: ["\u20B9", p.original_price] }))] }), _jsx("td", { className: "px-5 py-3", children: getStockBadge(p.stock_qty) }), _jsx("td", { className: "px-5 py-3", children: _jsx("span", { className: `text-[11px] font-semibold px-2 py-0.5 rounded-full ${p.is_active ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`, children: p.is_active ? 'Published' : 'Hidden' }) }), _jsx("td", { className: "px-5 py-3", children: _jsxs("div", { className: "flex gap-1", children: [_jsx("button", { onClick: () => { setEditingProduct(p); setShowModal(true); }, className: "p-1.5 text-gray-400 hover:text-primary rounded-lg hover:bg-gray-50 transition", title: "Edit product info", children: _jsx(Edit2, { size: 15 }) }), _jsx("button", { onClick: () => handleDelete(p.id, p.name), className: "p-1.5 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition", title: "Delete product", children: _jsx(Trash2, { size: 15 }) })] }) })] }, p.id)))) })] }) }), _jsx("div", { className: "sm:hidden space-y-2", children: isLoading ? (_jsx("p", { className: "text-center text-gray-400 py-8 text-sm", children: "Loading products..." })) : displayedItems.length === 0 ? (_jsx("p", { className: "text-center text-gray-400 py-8 text-sm", children: activeTab === 'low_stock' ? 'No products low in stock.' : 'No products found.' })) : (displayedItems.map((p) => (_jsxs("div", { className: "bg-white rounded-xl border p-3 flex gap-3 shadow-sm", children: [p.images?.[0] ? (_jsx("img", { src: p.images?.[0], alt: p.name, className: "w-12 h-12 rounded-lg object-cover shrink-0 border bg-gray-50", loading: "lazy" })) : (_jsx("div", { className: "w-12 h-12 rounded-lg bg-gray-100 shrink-0 border" })), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("span", { className: "font-semibold text-sm block truncate text-gray-900", children: p.name }), _jsxs("p", { className: "text-xs font-semibold text-primary mt-0.5", children: ["\u20B9", p.price] }), _jsx("div", { className: "mt-1.5 flex flex-wrap gap-1.5 items-center", children: getStockBadge(p.stock_qty) })] }), _jsxs("div", { className: "flex flex-col gap-1 items-end shrink-0 justify-between", children: [_jsxs("div", { className: "flex", children: [_jsx("button", { onClick: () => { setEditingProduct(p); setShowModal(true); }, className: "p-2 text-gray-500 hover:text-primary", children: _jsx(Edit2, { size: 15 }) }), _jsx("button", { onClick: () => handleDelete(p.id, p.name), className: "p-2 text-red-400 hover:text-red-600", children: _jsx(Trash2, { size: 15 }) })] }), _jsx("span", { className: `text-[9px] font-bold px-1.5 py-0.5 rounded ${p.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`, children: p.is_active ? 'Active' : 'Hidden' })] })] }, p.id)))) }), data && data.pages > 1 && (_jsxs("div", { className: "flex items-center justify-center gap-2 pt-2", children: [_jsx("button", { disabled: page <= 1, onClick: () => setPage(page - 1), className: "px-3 py-1.5 border bg-white rounded-lg text-xs font-semibold disabled:opacity-30", children: "Prev" }), _jsxs("span", { className: "text-xs text-gray-500 font-medium", children: ["Page ", page, " of ", data.pages] }), _jsx("button", { disabled: page >= data.pages, onClick: () => setPage(page + 1), className: "px-3 py-1.5 border bg-white rounded-lg text-xs font-semibold disabled:opacity-30", children: "Next" })] })), showModal && (_jsx(ProductModal, { editProduct: editingProduct, onClose: () => { setShowModal(false); setEditingProduct(null); } }, editingProduct?.id ?? 'new'))] }));
}
