import { useState, useCallback, useMemo } from 'react';
import { Plus, Trash2, GripVertical, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { arrayMove } from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useQueryClient } from '@tanstack/react-query';

import { useProducts } from '@/hooks/useProducts';
import { useAdminAllProducts } from '@/hooks/useProducts';
import {
  useAdminDoNotForgetList,
  useAddDoNotForgetProduct,
  useRemoveDoNotForgetProduct,
  useUpdateDoNotForgetProduct,
  useReorderDoNotForgetProducts,
} from '@/hooks/useDoNotForget';
import type { DoNotForgetProduct } from '@/types';
import SearchableProductSelect from '@/components/admin/SearchableProductSelect';

function SortableDoNotForgetRow({
  item,
  onToggle,
  onDelete,
  deleteConfirmId,
  setDeleteConfirmId,
}: {
  item: DoNotForgetProduct;
  onToggle: (id: number) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  deleteConfirmId: number | null;
  setDeleteConfirmId: (id: number | null) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleToggle() {
    setToggling(true);
    try {
      await onToggle(item.id);
      toast.success(item.is_active ? 'Hidden' : 'Shown');
    } catch {
      toast.error('Failed to update');
    } finally {
      setToggling(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await onDelete(item.id);
      toast.success('Removed');
    } catch {
      toast.error('Failed to remove');
    } finally {
      setDeleting(false);
      setDeleteConfirmId(null);
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="px-5 py-4 border-b last:border-0 hover:bg-gray-50/50 transition-colors flex items-center gap-4 group"
    >
      <button
        {...attributes}
        {...listeners}
        className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing"
        title="Drag to reorder"
      >
        <GripVertical size={18} />
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3">
          <img
            src={item.product.images?.[0] || 'https://placehold.co/60x60?text=P'}
            alt={item.product.name}
            className="w-10 h-10 rounded-lg object-cover bg-gray-100 shrink-0 border"
          />
          <div className="min-w-0">
            <h3 className="font-semibold text-gray-900 truncate">{item.product.name}</h3>
            <p className="text-xs text-gray-500">₹{item.product.price}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={handleToggle}
          disabled={toggling}
          className="p-2 text-gray-400 hover:text-primary rounded-lg hover:bg-primary/10 transition disabled:opacity-50"
          title={item.is_active ? 'Hide product' : 'Show product'}
        >
          {item.is_active ? (
            <Eye size={16} />
          ) : (
            <EyeOff size={16} />
          )}
        </button>

        {deleteConfirmId === item.id ? (
          <div className="flex gap-1">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-3 py-1.5 text-xs font-semibold bg-red-500 text-white rounded-lg hover:bg-red-600 transition disabled:opacity-50"
            >
              Confirm
            </button>
            <button
              onClick={() => setDeleteConfirmId(null)}
              className="px-3 py-1.5 text-xs font-semibold bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setDeleteConfirmId(item.id)}
            className="p-2 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition"
            title="Remove product"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

export default function DoNotForgetAdminPage() {
  const { data: doNotForgetData, isLoading, refetch } = useAdminDoNotForgetList();
  const { data: productsData, isLoading: isLoadingProducts, error: productsError } = useAdminAllProducts(1000);
  
  const addMutation = useAddDoNotForgetProduct();
  const removeMutation = useRemoveDoNotForgetProduct();
  const updateMutation = useUpdateDoNotForgetProduct();
  const reorderMutation = useReorderDoNotForgetProducts();

  const [localItems, setLocalItems] = useState<DoNotForgetProduct[]>(doNotForgetData?.items || []);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  // Debug logging
  console.log('Products data:', {
    total: productsData?.total,
    itemsCount: productsData?.items?.length,
    isLoading: isLoadingProducts,
    error: productsError,
  });

  // Mirror fetched items
  const [lastFetchedItems, setLastFetchedItems] = useState(doNotForgetData?.items || []);
  if (lastFetchedItems !== doNotForgetData?.items) {
    setLastFetchedItems(doNotForgetData?.items || []);
    setLocalItems(doNotForgetData?.items || []);
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

      const oldIndex = localItems.findIndex((item) => item.id === active.id);
      const newIndex = localItems.findIndex((item) => item.id === over.id);
      const reordered = arrayMove(localItems, oldIndex, newIndex);
      setLocalItems(reordered);

      const itemIds = reordered.map((item) => item.id);
      try {
        await reorderMutation.mutateAsync(itemIds);
        toast.success('Reordered successfully');
      } catch {
        toast.error('Failed to reorder');
        refetch();
      }
    },
    [localItems, reorderMutation, refetch],
  );

  async function handleToggle(id: number) {
    const item = localItems.find((i) => i.id === id);
    if (!item) return;

    try {
      await updateMutation.mutateAsync({
        itemId: id,
        data: { is_active: !item.is_active },
      });
    } catch {
      toast.error('Failed to update');
    }
  }

  async function handleDelete(id: number) {
    try {
      await removeMutation.mutateAsync(id);
    } catch {
      toast.error('Failed to remove');
    }
  }

  async function handleAddProduct(productId: number) {
    try {
      await addMutation.mutateAsync(productId);
      toast.success('Product added');
      setShowAddModal(false);
      refetch();
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || 'Failed to add product');
    }
  }

  // Get available products (not already in the list)
  const availableProducts = useMemo(() => {
    const inListIds = new Set(localItems.map((item) => item.product_id));
    return (productsData?.items || []).filter((p) => !inListIds.has(p.id));
  }, [productsData?.items, localItems]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            Do Not Forget to Buy
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Manage the product recommendations shown in the cart. Customers will see these when they open their cart.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2.5 bg-primary hover:bg-primary/95 text-white text-sm rounded-lg font-semibold flex items-center gap-2 transition shrink-0"
        >
          <Plus size={16} /> Add Product
        </button>
      </div>

      {/* Help card */}
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex gap-3">
        <div className="bg-green-100 w-10 h-10 rounded-lg flex items-center justify-center text-green-700 shrink-0 text-lg">
          💡
        </div>
        <div>
          <h3 className="font-semibold text-sm text-green-900">Pro Tip</h3>
          <p className="text-xs text-green-700 mt-0.5">
            Add complementary products that customers often forget to buy with their main purchase. 
            These will appear as quick-add recommendations in the cart.
          </p>
        </div>
      </div>

      {/* Product list */}
      <div className="bg-white rounded-xl border overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="px-4 py-12 text-center text-gray-400 text-sm">
            Loading products list...
          </div>
        ) : localItems.length === 0 ? (
          <div className="px-4 py-12 text-center text-gray-400 text-sm">
            No products added yet.{' '}
            <button
              onClick={() => setShowAddModal(true)}
              className="text-primary font-semibold hover:underline"
            >
              Add your first product
            </button>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={localItems.map((item) => item.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="divide-y">
                {localItems.map((item) => (
                  <SortableDoNotForgetRow
                    key={item.id}
                    item={item}
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

      {/* Add Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full">
            <div className="px-6 py-4 border-b">
              <h2 className="font-bold text-lg text-gray-900">Add Product</h2>
              <p className="text-xs text-gray-500 mt-1">
                {isLoadingProducts ? 'Loading products...' : `${availableProducts.length} products available`}
              </p>
            </div>
            <div className="px-6 py-4">
              {isLoadingProducts ? (
                <div className="text-center py-8 text-gray-400">
                  Loading products...
                </div>
              ) : availableProducts.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  {(productsData?.items?.length ?? 0) === 0
                    ? 'No products available in system'
                    : 'All products already added to the list'}
                </div>
              ) : (
                <SearchableProductSelect
                  products={availableProducts}
                  onSelect={handleAddProduct}
                  placeholder="Search and select a product..."
                />
              )}
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-2">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
