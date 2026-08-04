import { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  FolderTree,
  Info,
  Pencil,
  Plus,
  Trash2,
  Upload,
  CheckCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useCategoriesAdmin } from '@/hooks/useCategories';
import { useCreateCategory, useDeleteCategory, useUpdateCategory } from '@/hooks/useAdmin';
import api from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';
import { getApiErrorDetail } from '@/lib/apiError';
import type { Category } from '@/types';

interface CategoryNodeProps {
  cat: Category;
  onDelete: (id: number, name: string) => void;
  onRename: (id: number, name: string) => Promise<void>;
  onToggleActive: (id: number, isActive: boolean) => Promise<void>;
  onMove: (id: number, direction: -1 | 1) => Promise<void>;
}

function CategoryNode({ cat, onDelete, onRename, onToggleActive, onMove }: CategoryNodeProps) {
  const [expanded, setExpanded] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(cat.name);
  const [busy, setBusy] = useState(false);
  const hasChildren = cat.children && cat.children.length > 0;

  async function saveRename() {
    const name = editValue.trim();
    if (!name || name === cat.name) {
      setEditing(false);
      setEditValue(cat.name);
      return;
    }
    setBusy(true);
    try {
      await onRename(cat.id, name);
      toast.success('Category renamed');
      setEditing(false);
    } catch (err) {
      toast.error(getApiErrorDetail(err, 'Rename failed'));
    } finally {
      setBusy(false);
    }
  }

  async function handleMove(direction: -1 | 1) {
    setBusy(true);
    try {
      await onMove(cat.id, direction);
    } catch (err) {
      toast.error(getApiErrorDetail(err, 'Reorder failed'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cat.is_active ? '' : 'opacity-60'}>
      <div className="flex items-center gap-2 py-3 px-3 hover:bg-gray-50 rounded-lg group transition-colors">
        <button onClick={() => setExpanded(!expanded)} className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 transition">
          {hasChildren ? (expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : <span className="w-3" />}
        </button>

        {cat.image_url ? (
          <img
            src={cat.image_url}
            alt=""
            className="w-7 h-7 rounded object-cover border bg-gray-50 shrink-0"
          />
        ) : (
          <FolderTree size={16} className="text-primary-light shrink-0" />
        )}

        {editing ? (
          <div className="flex items-center gap-1 flex-1 min-w-0">
            <input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveRename();
                if (e.key === 'Escape') {
                  setEditing(false);
                  setEditValue(cat.name);
                }
              }}
              autoFocus
              className="flex-1 min-w-0 px-2 py-1 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button onClick={saveRename} disabled={busy} className="p-1 text-green-600 hover:bg-green-50 rounded" title="Save">
              <Check size={14} />
            </button>
          </div>
        ) : (
          <span className="text-sm font-semibold text-gray-800 flex-1 min-w-0 truncate">{cat.name}</span>
        )}

        <span className="text-xs text-gray-400 hidden sm:inline shrink-0 font-medium">/{cat.slug}</span>

        {!cat.is_active && (
          <span className="text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-200 rounded-full px-1.5 py-0.5 shrink-0">
            Hidden
          </span>
        )}

        <div className="flex items-center sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
          <button
            onClick={() => setEditing(true)}
            className="p-1.5 text-gray-400 hover:text-primary transition"
            title="Rename"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={() => handleMove(-1)}
            disabled={busy}
            className="p-1.5 text-gray-400 hover:text-primary transition"
            title="Move up"
          >
            <ArrowUp size={13} />
          </button>
          <button
            onClick={() => handleMove(1)}
            disabled={busy}
            className="p-1.5 text-gray-400 hover:text-primary transition"
            title="Move down"
          >
            <ArrowDown size={13} />
          </button>
          <button
            onClick={() => onToggleActive(cat.id, cat.is_active)}
            disabled={busy}
            className="p-1.5 text-gray-400 hover:text-primary transition"
            title={cat.is_active ? 'Hide from site' : 'Show on site'}
          >
            {cat.is_active ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
          <button
            onClick={() => onDelete(cat.id, cat.name)}
            className="p-1.5 text-red-400 hover:text-red-600 transition"
            title="Delete category"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
      {expanded && hasChildren && (
        <div className="ml-4 sm:ml-6 border-l pl-2 space-y-0.5">
          {cat.children!.map((child) => (
            <CategoryNode
              key={child.id}
              cat={child}
              onDelete={onDelete}
              onRename={onRename}
              onToggleActive={onToggleActive}
              onMove={onMove}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface SiblingEntry {
  id: number;
  sort_order: number;
}

function findSiblings(nodes: Category[], id: number): SiblingEntry[] {
  for (const n of nodes) {
    if (n.id === id) return nodes.map((c) => ({ id: c.id, sort_order: c.sort_order }));
    const found = findSiblings(n.children ?? [], id);
    if (found) return found;
  }
  return [];
}

export default function CategoriesAdminPage() {
  const qc = useQueryClient();
  const { data: categories, isLoading, refetch } = useCategoriesAdmin();
  const createMutation = useCreateCategory();
  const deleteMutation = useDeleteCategory();
  const updateMutation = useUpdateCategory();

  const [newName, setNewName] = useState('');
  const [parentId, setParentId] = useState<string>('');

  // Image selection states
  const [imageMode, setImageMode] = useState<'none' | 'upload' | 'url'>('none');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [manualUrl, setManualUrl] = useState('');
  const [urlValid, setUrlValid] = useState<boolean | null>(null);

  const allCats = categories?.flatMap((c) => [c, ...(c.children ?? [])]) ?? [];
  const roots = categories?.filter((c) => !c.parent_id) ?? [];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setFilePreview(URL.createObjectURL(file));
    }
  };

  const handleUrlBlur = () => {
    if (!manualUrl) {
      setUrlValid(null);
      return;
    }
    const img = new window.Image();
    img.onload = () => setUrlValid(true);
    img.onerror = () => setUrlValid(false);
    img.src = manualUrl;
  };

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['categories'] });
    qc.invalidateQueries({ queryKey: ['categories-admin'] });
    refetch();
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;

    try {
      // 1. Create category basic structure (image_url accepted inline)
      const newCat = await createMutation.mutateAsync({
        name: newName.trim(),
        parent_id: parentId ? Number(parentId) : null,
        ...(imageMode === 'url' && manualUrl ? { image_url: manualUrl } : {}),
      });

      // 2. Upload image if chosen (file upload requires a follow-up request)
      if (imageMode === 'upload' && selectedFile) {
        const fd = new FormData();
        fd.append('image', selectedFile);
        await api.post(`/categories/${newCat.id}/image`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      toast.success('Category created successfully!');

      // Reset forms
      setNewName('');
      setParentId('');
      setImageMode('none');
      setSelectedFile(null);
      setFilePreview(null);
      setManualUrl('');
      setUrlValid(null);

      invalidate();
    } catch (err) {
      toast.error(getApiErrorDetail(err, 'Failed to create category'));
    }
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`Are you sure you want to delete "${name}"? Categories with active products attached cannot be deleted.`)) return;
    try {
      await deleteMutation.mutateAsync(id);
      toast.success('Category deleted successfully!');
      invalidate();
    } catch (err) {
      toast.error(getApiErrorDetail(err, 'Failed to delete (check if products are attached)'));
    }
  }

  async function handleRename(id: number, name: string) {
    await updateMutation.mutateAsync({ id, body: { name } });
    invalidate();
  }

  async function handleToggleActive(id: number, isActive: boolean) {
    await updateMutation.mutateAsync({ id, body: { is_active: !isActive } });
    toast.success(isActive ? 'Category hidden from site' : 'Category shown on site');
    invalidate();
  }

  async function handleMove(id: number, direction: -1 | 1) {
    const siblings = findSiblings(roots, id).sort((a, b) => a.sort_order - b.sort_order);
    const index = siblings.findIndex((s) => s.id === id);
    if (index === -1 || siblings.length < 2) return;
    const swapWith = index + direction;
    if (swapWith < 0 || swapWith >= siblings.length) return;

    const a = siblings[index];
    const b = siblings[swapWith];
    await updateMutation.mutateAsync({ id: a.id, body: { sort_order: b.sort_order } });
    await updateMutation.mutateAsync({ id: b.id, body: { sort_order: a.sort_order } });
    invalidate();
  }

  return (
    <div className="space-y-5">

      {/* Title */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Categories Management</h1>
        <p className="text-xs text-gray-500 mt-0.5">Organize store products into logical groups. Root categories drive the navigation menu.</p>
      </div>

      {/* Explanatory Banner */}
      <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex gap-3 shadow-sm">
        <div className="bg-primary/10 w-9 h-9 rounded-lg flex items-center justify-center text-primary shrink-0">
          <Info size={18} />
        </div>
        <div className="text-xs text-gray-600 leading-relaxed">
          <p className="font-bold text-primary">Where do categories show up on the website?</p>
          <ul className="list-disc pl-4 mt-1 space-y-0.5">
            <li><strong>Root Categories</strong> (no parent) appear in the main navigation menu, the mobile menu, the footer, and the homepage category slider. Use the arrows to control their order in the menu.</li>
            <li><strong>Subcategories</strong> (attached to a parent) show up as dropdown items under their root and in the catalog filters.</li>
            <li>Use the <strong>eye</strong> button to hide a category from the site; hidden categories still appear here so you can bring them back.</li>
          </ul>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">

        {/* Category Creation Form */}
        <div className="md:col-span-1 bg-white p-4 rounded-xl border shadow-sm space-y-4 h-fit">
          <h2 className="text-sm font-bold text-gray-800 pb-2 border-b">Add New Category</h2>

          <form onSubmit={handleCreate} className="space-y-3.5">
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">Category Name *</label>
              <input
                placeholder="e.g., Ferns, Bonsai, Ceramic Pots"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">Parent Category</label>
              <select
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                className="w-full px-3 py-2 text-xs border rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">No Parent (Root category)</option>
                {allCats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.parent_id ? `↳ ${c.name}` : c.name}
                  </option>
                ))}
              </select>
              <p className="text-[9px] text-gray-400 mt-1">If this is a subcategory, select its parent here.</p>
            </div>

            {/* Category Image Options */}
            <div className="pt-2 border-t space-y-2">
              <label className="text-xs font-semibold text-gray-700 block">Category Thumbnail / Image</label>
              <div className="flex gap-3 text-[10px] font-bold text-gray-500 mb-2">
                <label className="flex items-center gap-1 cursor-pointer">
                  <input type="radio" checked={imageMode === 'none'} onChange={() => setImageMode('none')} />
                  No Image
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input type="radio" checked={imageMode === 'upload'} onChange={() => setImageMode('upload')} />
                  Upload Image
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input type="radio" checked={imageMode === 'url'} onChange={() => setImageMode('url')} />
                  Paste URL
                </label>
              </div>

              {imageMode === 'upload' && (
                <div className="space-y-2">
                  <div className="border-2 border-dashed border-gray-100 hover:border-primary/40 rounded-lg p-4 text-center cursor-pointer relative transition-colors">
                    <input type="file" accept="image/*" onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer" />
                    {filePreview ? (
                      <img src={filePreview} alt="Preview" className="max-h-20 mx-auto object-cover rounded" />
                    ) : (
                      <div className="text-gray-400">
                        <Upload size={20} className="mx-auto mb-1" />
                        <span className="text-[10px] font-semibold block text-gray-700">Choose image file</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {imageMode === 'url' && (
                <div className="space-y-1.5">
                  <input
                    type="url"
                    value={manualUrl}
                    onChange={(e) => { setManualUrl(e.target.value); setUrlValid(null); }}
                    onBlur={handleUrlBlur}
                    placeholder="https://..."
                    className="w-full px-2.5 py-1.5 text-xs border rounded-lg focus:outline-none"
                  />
                  {urlValid === true && (
                    <p className="text-[10px] text-green-600 flex items-center gap-1 font-semibold">
                      <CheckCircle size={11} /> Image loaded
                    </p>
                  )}
                  {manualUrl && (
                    <div className="h-12 w-12 border rounded overflow-hidden mt-1.5 bg-gray-50">
                      <img src={manualUrl} alt="" className="h-full w-full object-cover" onError={(e) => e.currentTarget.style.display = 'none'} />
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={createMutation.isPending || !newName.trim()}
              className="w-full py-2.5 bg-primary text-white text-xs rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-primary/95 disabled:opacity-60 transition"
            >
              <Plus size={14} /> Add Category
            </button>
          </form>
        </div>

        {/* Categories Tree View */}
        <div className="md:col-span-2 bg-white p-4 rounded-xl border shadow-sm">
          <h2 className="text-sm font-bold text-gray-800 pb-2 border-b mb-3">Category Hierarchy</h2>
          {isLoading ? (
            <p className="text-center text-gray-400 py-12 text-xs">Loading categories tree...</p>
          ) : roots.length === 0 ? (
            <p className="text-center text-gray-400 py-12 text-xs">No categories registered yet. Create one on the left.</p>
          ) : (
            <div className="space-y-0.5">
              {roots.map((cat) => (
                <CategoryNode
                  key={cat.id}
                  cat={cat}
                  onDelete={handleDelete}
                  onRename={handleRename}
                  onToggleActive={handleToggleActive}
                  onMove={handleMove}
                />
              ))}
            </div>
          )}
          <p className="text-[10px] text-gray-400 mt-3 border-t pt-2">
            Tip: hover a category to see rename (pencil), reorder (arrows), hide/show (eye), and delete actions.
          </p>
        </div>

      </div>
    </div>
  );
}
