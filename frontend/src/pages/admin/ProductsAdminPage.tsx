import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Edit2, Plus, Search, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useProducts } from '@/hooks/useProducts';
import { useCategories } from '@/hooks/useCategories';
import { useDeleteProduct } from '@/hooks/useAdmin';
import api from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import type { Product, ProductVariants } from '@/types';

const productSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  description: z.string().optional(),
  price: z.coerce.number().positive('Price must be positive'),
  original_price: z.coerce.number().positive().optional(),
  stock_qty: z.coerce.number().int().min(0),
  category_id: z.coerce.number().int().positive('Select a category'),
  badge: z.string().optional(),
  sunlight: z.string().optional(),
  watering: z.string().optional(),
  tags: z.array(z.object({ value: z.string() })).optional(),
  care_tips: z.array(z.object({ value: z.string() })).optional(),
});

type ProductFormData = z.infer<typeof productSchema>;
type VariantColorDraft = { name: string; hex: string; slug: string };
type VariantPotDraft = { name: string; slug: string; price_modifier: number };

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function validateVariants(value: any): value is ProductVariants {
  return Boolean(
    value
    && Array.isArray(value.colors)
    && Array.isArray(value.pot_types)
    && value.image_map
    && typeof value.image_map === 'object'
    && value.stock
    && typeof value.stock === 'object'
    && typeof value.default_image === 'string'
  );
}

function ProductModal({ onClose, product }: { onClose: () => void; product?: Product | null }) {
  const { data: categories } = useCategories();
  const qc = useQueryClient();
  const allCats = categories?.flatMap((c) => [c, ...(c.children ?? [])]) ?? [];
  const [submitting, setSubmitting] = useState(false);
  const [colors, setColors] = useState<VariantColorDraft[]>(product?.variants?.colors || []);
  const [pots, setPots] = useState<VariantPotDraft[]>(product?.variants?.pot_types || []);
  const [defaultImage, setDefaultImage] = useState(product?.variants?.default_image || '');
  const [stockByKey, setStockByKey] = useState<Record<string, number>>(product?.variants?.stock || {});
  const [imageByKey, setImageByKey] = useState<Record<string, string>>(product?.variants?.image_map || {});
  const [showRaw, setShowRaw] = useState(false);
  const [rawJson, setRawJson] = useState('');
  const [variantError, setVariantError] = useState<string | null>(null);

  useBodyScrollLock(true);

  const { register, handleSubmit, control, formState: { errors } } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema) as any,
    defaultValues: {
      name: product?.name || '',
      description: product?.description || '',
      price: product?.price || 0,
      original_price: product?.original_price || undefined,
      stock_qty: product?.stock_qty || 0,
      category_id: product?.category_id || undefined,
      badge: product?.badge || '',
      sunlight: product?.sunlight || '',
      watering: product?.watering || '',
      tags: product?.tags?.length ? product.tags.map((value) => ({ value })) : [{ value: '' }],
      care_tips: product?.care_tips?.length ? product.care_tips.map((value) => ({ value })) : [{ value: '' }],
    },
  });
  const { fields: tagFields, append: addTag, remove: removeTag } = useFieldArray({ control, name: 'tags' });
  const { fields: tipFields, append: addTip, remove: removeTip } = useFieldArray({ control, name: 'care_tips' });

  async function onSubmit(data: ProductFormData) {
    setSubmitting(true);
    try {
      setVariantError(null);
      let variants: ProductVariants | null = null;
      if (showRaw && rawJson.trim()) {
        const parsed = JSON.parse(rawJson);
        if (!validateVariants(parsed)) {
          setVariantError('Raw variants JSON must include colors, pot_types, image_map, stock, and default_image.');
          setSubmitting(false);
          return;
        }
        variants = parsed;
      } else if (colors.length || pots.length || defaultImage.trim()) {
        const cleanColors = colors.filter((c) => c.name.trim() && c.slug.trim());
        const cleanPots = pots.filter((p) => p.name.trim() && p.slug.trim());
        if (!cleanColors.length || !cleanPots.length) {
          setVariantError('Add at least one complete color and one complete pot type, or leave variants empty.');
          setSubmitting(false);
          return;
        }
        const rowKeys = cleanColors.flatMap((color) => cleanPots.map((pot) => `${color.slug}__${pot.slug}`));
        variants = {
          colors: cleanColors,
          pot_types: cleanPots,
          default_image: defaultImage,
          image_map: Object.fromEntries(rowKeys.map((key) => [key, imageByKey[key] || ''])),
          stock: Object.fromEntries(rowKeys.map((key) => [key, Number(stockByKey[key] || 0)])),
        };
      }

      const stockQty = variants ? Object.values(variants.stock).reduce((sum, qty) => sum + Number(qty || 0), 0) : data.stock_qty;
      const payload = {
        name: data.name,
        description: data.description || '',
        price: data.price,
        original_price: data.original_price || null,
        stock_qty: stockQty,
        category_id: data.category_id,
        badge: data.badge || null,
        sunlight: data.sunlight || null,
        watering: data.watering || null,
        tags: data.tags?.map((t) => t.value).filter(Boolean) || [],
        care_tips: data.care_tips?.map((t) => t.value).filter(Boolean) || [],
        variants,
      };

      if (product) {
        await api.put(`/products/${product.id}`, payload);
        toast.success('Product updated');
      } else {
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
        if (payload.variants) fd.append('variants', JSON.stringify(payload.variants));
        await api.post('/products', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        toast.success('Product created');
      }
      qc.invalidateQueries({ queryKey: ['products'] });
      onClose();
    } catch (err: any) {
      if (err instanceof SyntaxError) setVariantError('Raw variants JSON is malformed.');
      toast.error(err.response?.data?.detail || 'Failed to create product');
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass = "w-full px-3 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary-light";
  const variantRows = colors.flatMap((color) => pots.map((pot) => ({
    key: `${color.slug}__${pot.slug}`,
    label: `${color.name || color.slug || 'Color'} / ${pot.name || pot.slug || 'Pot'}`,
  }))).filter((row) => !row.key.includes('undefined') && !row.key.startsWith('__') && !row.key.endsWith('__'));

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />
      <div className="fixed inset-0 sm:inset-4 md:inset-y-8 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-2xl bg-white sm:rounded-2xl z-50 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-4 sm:p-5 border-b shrink-0">
          <h2 className="text-lg font-bold">{product ? 'Edit Product' : 'Add Product'}</h2>
          <button onClick={onClose} className="p-2 touch-target"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {/* Single column on mobile, 2-col on desktop */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="sm:col-span-2">
              <label className="text-xs font-medium text-gray-500 mb-1 block">Name *</label>
              <input {...register('name')} className={inputClass} />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Price (₹) *</label>
              <input type="number" step="0.01" {...register('price')} className={inputClass} />
              {errors.price && <p className="text-xs text-red-500 mt-1">{errors.price.message}</p>}
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Original Price</label>
              <input type="number" step="0.01" {...register('original_price')} className={inputClass} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Stock *</label>
              <input type="number" {...register('stock_qty')} className={inputClass} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Category *</label>
              <select {...register('category_id')} className={inputClass}>
                <option value="">Select</option>
                {allCats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {errors.category_id && <p className="text-xs text-red-500 mt-1">{errors.category_id.message}</p>}
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Badge</label>
              <input {...register('badge')} placeholder="e.g. Bestseller" className={inputClass} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Sunlight</label>
              <input {...register('sunlight')} placeholder="e.g. Indirect" className={inputClass} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Watering</label>
              <input {...register('watering')} placeholder="e.g. Weekly" className={inputClass} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Description</label>
            <textarea {...register('description')} rows={3} className={inputClass} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-gray-500">Tags</label>
              <button type="button" onClick={() => addTag({ value: '' })} className="text-xs text-primary hover:underline touch-target">+ Add</button>
            </div>
            <div className="flex flex-wrap gap-2">
              {tagFields.map((f, i) => (
                <div key={f.id} className="flex items-center gap-1">
                  <input {...register(`tags.${i}.value`)} placeholder="tag" className="w-24 sm:w-28 px-2 py-1.5 text-xs border rounded-lg" />
                  <button type="button" onClick={() => removeTag(i)} className="text-red-400 hover:text-red-600 touch-target"><X size={14} /></button>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-gray-500">Care Tips</label>
              <button type="button" onClick={() => addTip({ value: '' })} className="text-xs text-primary hover:underline touch-target">+ Add</button>
            </div>
            <div className="space-y-2">
              {tipFields.map((f, i) => (
                <div key={f.id} className="flex items-center gap-2">
                  <input {...register(`care_tips.${i}.value`)} placeholder="Tip" className="flex-1 px-3 py-2 text-sm border rounded-lg" />
                  <button type="button" onClick={() => removeTip(i)} className="text-red-400 hover:text-red-600 touch-target"><X size={14} /></button>
                </div>
              ))}
            </div>
          </div>

          <div className="border rounded-xl p-3 sm:p-4 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold">Product Variants</h3>
                <p className="text-xs text-gray-500">Configure color and pot combinations with their stock and image.</p>
              </div>
              <label className="flex items-center gap-2 text-xs text-gray-600">
                <input type="checkbox" checked={showRaw} onChange={(e) => {
                  const checked = e.target.checked;
                  setShowRaw(checked);
                  if (checked) {
                    setRawJson(JSON.stringify({
                      colors,
                      pot_types: pots,
                      default_image: defaultImage,
                      image_map: imageByKey,
                      stock: stockByKey,
                    }, null, 2));
                  }
                }} className="accent-primary" />
                Raw JSON
              </label>
            </div>

            {variantError && <p className="text-xs text-red-500">{variantError}</p>}

            {showRaw ? (
              <textarea
                value={rawJson}
                onChange={(e) => setRawJson(e.target.value)}
                rows={10}
                className={`${inputClass} font-mono text-xs`}
                placeholder='{"colors":[],"pot_types":[],"image_map":{},"stock":{},"default_image":""}'
              />
            ) : (
              <>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-gray-500">Colors</label>
                    <button type="button" onClick={() => setColors([...colors, { name: '', hex: '#7A9E7E', slug: '' }])} className="text-xs text-primary hover:underline">+ Add Color</button>
                  </div>
                  <div className="space-y-2">
                    {colors.map((color, index) => (
                      <div key={index} className="grid grid-cols-[1fr_90px_1fr_auto] gap-2 items-center">
                        <input value={color.name} onChange={(e) => setColors(colors.map((c, i) => i === index ? { ...c, name: e.target.value, slug: c.slug || slugify(e.target.value) } : c))} placeholder="Name" className={inputClass} />
                        <input type="color" value={color.hex} onChange={(e) => setColors(colors.map((c, i) => i === index ? { ...c, hex: e.target.value } : c))} className="h-10 w-full border rounded-lg" />
                        <input value={color.slug} onChange={(e) => setColors(colors.map((c, i) => i === index ? { ...c, slug: slugify(e.target.value) } : c))} placeholder="slug" className={inputClass} />
                        <button type="button" onClick={() => setColors(colors.filter((_, i) => i !== index))} className="p-2 text-red-400 hover:text-red-600"><Trash2 size={15} /></button>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-gray-500">Pot Types</label>
                    <button type="button" onClick={() => setPots([...pots, { name: '', slug: '', price_modifier: 0 }])} className="text-xs text-primary hover:underline">+ Add Pot</button>
                  </div>
                  <div className="space-y-2">
                    {pots.map((pot, index) => (
                      <div key={index} className="grid grid-cols-[1fr_1fr_100px_auto] gap-2 items-center">
                        <input value={pot.name} onChange={(e) => setPots(pots.map((p, i) => i === index ? { ...p, name: e.target.value, slug: p.slug || slugify(e.target.value) } : p))} placeholder="Name" className={inputClass} />
                        <input value={pot.slug} onChange={(e) => setPots(pots.map((p, i) => i === index ? { ...p, slug: slugify(e.target.value) } : p))} placeholder="slug" className={inputClass} />
                        <input type="number" value={pot.price_modifier} onChange={(e) => setPots(pots.map((p, i) => i === index ? { ...p, price_modifier: Number(e.target.value) } : p))} placeholder="Modifier" className={inputClass} />
                        <button type="button" onClick={() => setPots(pots.filter((_, i) => i !== index))} className="p-2 text-red-400 hover:text-red-600"><Trash2 size={15} /></button>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Default / Fallback Image URL</label>
                  <input value={defaultImage} onChange={(e) => setDefaultImage(e.target.value)} className={inputClass} placeholder="https://..." />
                </div>

                {variantRows.length > 0 && (
                  <div className="overflow-x-auto border rounded-lg">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 text-gray-500">
                        <tr>
                          <th className="text-left p-2 font-medium">Combination</th>
                          <th className="text-left p-2 font-medium">Stock</th>
                          <th className="text-left p-2 font-medium">Image URL</th>
                        </tr>
                      </thead>
                      <tbody>
                        {variantRows.map((row) => (
                          <tr key={row.key} className="border-t">
                            <td className="p-2 font-medium">{row.label}</td>
                            <td className="p-2">
                              <input type="number" min={0} value={stockByKey[row.key] ?? 0} onChange={(e) => setStockByKey({ ...stockByKey, [row.key]: Number(e.target.value) })} className="w-24 px-2 py-1.5 border rounded-lg" />
                            </td>
                            <td className="p-2">
                              <input value={imageByKey[row.key] || ''} onChange={(e) => setImageByKey({ ...imageByKey, [row.key]: e.target.value })} className="w-64 px-2 py-1.5 border rounded-lg" placeholder="https://..." />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
          <button type="submit" disabled={submitting} className="w-full py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 disabled:opacity-60">
            {submitting ? (product ? 'Saving...' : 'Creating...') : (product ? 'Save Product' : 'Create Product')}
          </button>
        </form>
      </div>
    </>
  );
}

export default function ProductsAdminPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const { data, isLoading } = useProducts({ search: search || undefined, page, limit: 20 });
  const deleteMutation = useDeleteProduct();

  async function handleDelete(id: number, name: string) {
    if (!confirm(`Delete "${name}"?`)) return;
    try {
      await deleteMutation.mutateAsync(id);
      toast.success('Product deleted');
    } catch {
      toast.error('Failed to delete');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold">Products</h1>
        <button onClick={() => { setEditingProduct(null); setShowModal(true); }} className="px-4 py-2.5 bg-primary text-white text-sm rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-primary/90 touch-target">
          <Plus size={16} /> Add Product
        </button>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          placeholder="Search products..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-full sm:max-w-sm pl-9 pr-4 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-light"
        />
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block bg-white rounded-xl border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b">
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Price</th>
              <th className="px-4 py-3 font-medium">Stock</th>
              <th className="px-4 py-3 font-medium">Active</th>
              <th className="px-4 py-3 font-medium w-24">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
            ) : data?.items?.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No products found</td></tr>
            ) : (
              data?.items?.map((p) => (
                <tr key={p.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{p.name}</td>
                  <td className="px-4 py-3">₹{p.price}</td>
                  <td className="px-4 py-3">{p.stock_qty}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${p.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {p.is_active ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => { setEditingProduct(p); setShowModal(true); }} className="p-1.5 text-gray-500 hover:text-primary touch-target"><Edit2 size={15} /></button>
                    <button onClick={() => handleDelete(p.id, p.name)} className="p-1.5 text-red-400 hover:text-red-600 touch-target"><Trash2 size={15} /></button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-2">
        {isLoading ? (
          <p className="text-center text-gray-400 py-8 text-sm">Loading...</p>
        ) : data?.items?.length === 0 ? (
          <p className="text-center text-gray-400 py-8 text-sm">No products found</p>
        ) : (
          data?.items?.map((p) => (
            <div key={p.id} className="bg-white rounded-xl border p-3 flex items-center gap-3">
              <img
                src={p.images?.[0] || 'https://placehold.co/60x60?text=P'}
                alt={p.name}
                className="w-12 h-12 rounded-lg object-cover shrink-0"
                loading="lazy"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium line-clamp-1">{p.name}</p>
                <p className="text-xs text-gray-500">₹{p.price} · Stock: {p.stock_qty}</p>
              </div>
              <button onClick={() => { setEditingProduct(p); setShowModal(true); }} className="p-2 text-gray-500 hover:text-primary shrink-0 touch-target">
                <Edit2 size={16} />
              </button>
              <button onClick={() => handleDelete(p.id, p.name)} className="p-2 text-red-400 hover:text-red-600 shrink-0 touch-target">
                <Trash2 size={16} />
              </button>
            </div>
          ))
        )}
      </div>

      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-30 touch-target">Prev</button>
          <span className="text-sm text-gray-500">Page {page} of {data.pages}</span>
          <button disabled={page >= data.pages} onClick={() => setPage(page + 1)} className="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-30 touch-target">Next</button>
        </div>
      )}

      {showModal && <ProductModal product={editingProduct} onClose={() => { setShowModal(false); setEditingProduct(null); }} />}
    </div>
  );
}
