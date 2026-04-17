import { useState } from 'react';
import { ChevronDown, ChevronRight, FolderTree, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCategories } from '@/hooks/useCategories';
import { useCreateCategory, useDeleteCategory } from '@/hooks/useAdmin';
import type { Category } from '@/types';

function CategoryNode({ cat, onDelete }: { cat: Category; onDelete: (id: number, name: string) => void }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = cat.children && cat.children.length > 0;

  return (
    <div>
      <div className="flex items-center gap-2 py-2 px-3 hover:bg-gray-50 rounded-lg group">
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-5 h-5 flex items-center justify-center"
        >
          {hasChildren ? (expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : <span className="w-3" />}
        </button>
        <FolderTree size={16} className="text-primary-light" />
        <span className="text-sm font-medium flex-1">{cat.name}</span>
        <span className="text-xs text-gray-400">{cat.slug}</span>
        <button
          onClick={() => onDelete(cat.id, cat.name)}
          className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-600 transition-opacity"
        >
          <Trash2 size={14} />
        </button>
      </div>
      {expanded && hasChildren && (
        <div className="ml-6 border-l pl-2">
          {cat.children!.map((child) => (
            <CategoryNode key={child.id} cat={child} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function CategoriesAdminPage() {
  const { data: categories, isLoading } = useCategories();
  const createMutation = useCreateCategory();
  const deleteMutation = useDeleteCategory();

  const [newName, setNewName] = useState('');
  const [parentId, setParentId] = useState<string>('');

  const allCats = categories?.flatMap((c) => [c, ...(c.children ?? [])]) ?? [];
  const roots = categories?.filter((c) => !c.parent_id) ?? [];

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      await createMutation.mutateAsync({
        name: newName.trim(),
        parent_id: parentId ? Number(parentId) : null,
      });
      toast.success('Category created');
      setNewName('');
      setParentId('');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Failed to create');
    }
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`Delete "${name}"?`)) return;
    try {
      await deleteMutation.mutateAsync(id);
      toast.success('Category deleted');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Cannot delete (products attached?)');
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Categories</h1>

      <form onSubmit={handleCreate} className="flex flex-wrap gap-3 bg-white rounded-xl border p-4">
        <input
          placeholder="Category name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          required
          className="px-3 py-2 text-sm border rounded-lg flex-1 min-w-[200px] focus:outline-none focus:ring-1 focus:ring-primary-light"
        />
        <select
          value={parentId}
          onChange={(e) => setParentId(e.target.value)}
          className="px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-light"
        >
          <option value="">No Parent (root)</option>
          {allCats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button type="submit" disabled={createMutation.isPending} className="px-4 py-2 bg-primary text-white text-sm rounded-lg font-medium flex items-center gap-2 hover:bg-primary/90 disabled:opacity-60">
          <Plus size={16} /> Add
        </button>
      </form>

      <div className="bg-white rounded-xl border p-4">
        {isLoading ? (
          <p className="text-center text-gray-400 py-8">Loading...</p>
        ) : roots.length === 0 ? (
          <p className="text-center text-gray-400 py-8">No categories yet</p>
        ) : (
          <div className="space-y-1">
            {roots.map((cat) => (
              <CategoryNode key={cat.id} cat={cat} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
