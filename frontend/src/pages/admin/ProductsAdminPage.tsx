import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useProducts } from '@/hooks/useProducts';
import { useCategories } from '@/hooks/useCategories';
import { useDeleteProduct } from '@/hooks/useAdmin';
import api from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';

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

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function ProductModal({ onClose }: { onClose: () => void }) {
  const { data: categories } = useCategories();
  const qc = useQueryClient();
  const allCats = categories?.flatMap((c) => [c, ...(c.children ?? [])]) ?? [];
  const [submitting, setSubmitting] = useState(false);

  const { register, handleSubmit, control, formState: { errors } } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema) as any,
    defaultValues: { tags: [{ value: '' }], care_tips: [{ value: '' }], stock_qty: 0 },
  });
  const { fields: tagFields, append: addTag, remove: removeTag } = useFieldArray({ control, name: 'tags' });
  const { fields: tipFields, append: addTip, remove: removeTip } = useFieldArray({ control, name: 'care_tips' });

  async function onSubmit(data: ProductFormData) {
    setSubmitting(true);
    try {
      const fd = new FormData();
      const slug = slugify(data.name);
      fd.append('body', JSON.stringify({
        name: data.name,
        slug,
        description: data.description || '',
        price: data.price,
        original_price: data.original_price || null,
        stock_qty: data.stock_qty,
        category_id: data.category_id,
        badge: data.badge || null,
        sunlight: data.sunlight || null,
        watering: data.watering || null,
        tags: data.tags?.map((t) => t.value).filter(Boolean) || [],
        care_tips: data.care_tips?.map((t) => t.value).filter(Boolean) || [],
        images: [],
      }));
      await api.post('/products', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      toast.success('Product created');
      qc.invalidateQueries({ queryKey: ['products'] });
      onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to create product');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50" onClick={onClose} />
      <div className="fixed inset-4 md:inset-y-8 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-2xl bg-white rounded-2xl z-50 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-bold">Add Product</h2>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-xs font-medium text-gray-500 mb-1 block">Name *</label>
              <input {...register('name')} className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary-light" />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Price (₹) *</label>
              <input type="number" step="0.01" {...register('price')} className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary-light" />
              {errors.price && <p className="text-xs text-red-500 mt-1">{errors.price.message}</p>}
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Original Price</label>
              <input type="number" step="0.01" {...register('original_price')} className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary-light" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Stock *</label>
              <input type="number" {...register('stock_qty')} className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary-light" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Category *</label>
              <select {...register('category_id')} className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary-light">
                <option value="">Select</option>
                {allCats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {errors.category_id && <p className="text-xs text-red-500 mt-1">{errors.category_id.message}</p>}
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Badge</label>
              <input {...register('badge')} placeholder="e.g. Bestseller" className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary-light" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Sunlight</label>
              <input {...register('sunlight')} placeholder="e.g. Indirect" className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary-light" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Watering</label>
              <input {...register('watering')} placeholder="e.g. Weekly" className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary-light" />
            </div>
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium text-gray-500 mb-1 block">Description</label>
            <textarea {...register('description')} rows={3} className="w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary-light" />
          </div>

          {/* Tags */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-gray-500">Tags</label>
              <button type="button" onClick={() => addTag({ value: '' })} className="text-xs text-primary hover:underline">+ Add</button>
            </div>
            <div className="flex flex-wrap gap-2">
              {tagFields.map((f, i) => (
                <div key={f.id} className="flex items-center gap-1">
                  <input {...register(`tags.${i}.value`)} placeholder="tag" className="w-28 px-2 py-1.5 text-xs border rounded-lg" />
                  <button type="button" onClick={() => removeTag(i)} className="text-red-400 hover:text-red-600"><X size={14} /></button>
                </div>
              ))}
            </div>
          </div>

          {/* Care tips */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-gray-500">Care Tips</label>
              <button type="button" onClick={() => addTip({ value: '' })} className="text-xs text-primary hover:underline">+ Add</button>
            </div>
            <div className="space-y-2">
              {tipFields.map((f, i) => (
                <div key={f.id} className="flex items-center gap-2">
                  <input {...register(`care_tips.${i}.value`)} placeholder="Tip" className="flex-1 px-3 py-2 text-sm border rounded-lg" />
                  <button type="button" onClick={() => removeTip(i)} className="text-red-400 hover:text-red-600"><X size={14} /></button>
                </div>
              ))}
            </div>
          </div>

          <button type="submit" disabled={submitting} className="w-full py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 disabled:opacity-60">
            {submitting ? 'Creating...' : 'Create Product'}
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Products</h1>
        <button onClick={() => setShowModal(true)} className="px-4 py-2 bg-primary text-white text-sm rounded-lg font-medium flex items-center gap-2 hover:bg-primary/90">
          <Plus size={16} /> Add Product
        </button>
      </div>

      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          placeholder="Search products..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-full pl-9 pr-4 py-2 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-light"
        />
      </div>

      <div className="bg-white rounded-xl border overflow-x-auto">
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
                    <button onClick={() => handleDelete(p.id, p.name)} className="p-1.5 text-red-400 hover:text-red-600">
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-30">Prev</button>
          <span className="text-sm text-gray-500">Page {page} of {data.pages}</span>
          <button disabled={page >= data.pages} onClick={() => setPage(page + 1)} className="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-30">Next</button>
        </div>
      )}

      {showModal && <ProductModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
