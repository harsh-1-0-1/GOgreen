import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, Video, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { getApiErrorDetail } from '@/lib/apiError';
import type { Story, ProductListResponse } from '@/types';
import Spinner from '@/components/ui/Spinner';
import ErrorBoundary from '@/components/ui/ErrorBoundary';

function StoryForm({ 
  storyId, 
  onClose, 
  onSuccess 
}: { 
  storyId: number | null; 
  onClose: () => void; 
  onSuccess: () => void;
}) {
  // Fetch products directly — avoids parent timing issues and limit=100 validation error
  const { data: productsData } = useQuery<ProductListResponse>({
    queryKey: ['products-minimal'],
    queryFn: async () => {
      const { data } = await api.get('/products?limit=50');
      return data;
    },
  });
  const products = productsData?.items || [];
  const { data: story, isLoading: isLoadingStory } = useQuery<Story>({
    queryKey: ['admin-story', storyId],
    queryFn: async () => {
      const { data } = await api.get('/stories/admin');
      return data.find((s: Story) => s.id === storyId);
    },
    enabled: !!storyId,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoading(true);
    
    const formData = new FormData(e.currentTarget);
    const fd = new FormData();
    
    fd.append('display_order', formData.get('display_order') as string || '0');
    fd.append('is_active', formData.get('is_active') === 'on' ? 'true' : 'false');
    
    const caption = formData.get('caption') as string;
    if (caption !== null) fd.append('caption', caption);
    
    const linked_product_id = formData.get('linked_product_id') as string;
    if (linked_product_id) {
      fd.append('linked_product_id', linked_product_id);
    } else {
      fd.append('linked_product_id', '0');
    }

    if (videoFile) fd.append('video', videoFile);
    if (thumbnailFile) fd.append('thumbnail', thumbnailFile);

    try {
      if (storyId) {
        await api.put(`/stories/admin/${storyId}`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        toast.success('Story updated');
      } else {
        if (!videoFile) {
          toast.error('Video is required for a new story');
          setIsLoading(false);
          return;
        }
        await api.post('/stories/admin', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        toast.success('Story created');
      }
      onSuccess();
    } catch (err) {
      toast.error(getApiErrorDetail(err, 'Failed to save story'));
    } finally {
      setIsLoading(false);
    }
  };

  if (storyId && isLoadingStory) return <div className="p-12"><Spinner /></div>;

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border">
      <h2 className="text-lg font-bold mb-6">{storyId ? 'Edit Story' : 'New Story'}</h2>
      <form onSubmit={handleSubmit} className="space-y-5 max-w-2xl">
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Video File (MP4/WebM) {storyId ? '' : '*'}</label>
          <input
            type="file"
            accept="video/mp4,video/webm"
            onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
            className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
          />
          {story?.video && !videoFile && (
            <p className="mt-2 text-xs text-gray-500">Current video is uploaded. Selecting a new file will replace it.</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Custom Thumbnail (Image)</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setThumbnailFile(e.target.files?.[0] || null)}
            className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
          />
          {story?.thumbnail && !thumbnailFile && (
            <div className="mt-2">
              <img src={story.thumbnail} alt="thumbnail" className="h-20 rounded" />
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Linked Product</label>
          <select
            name="linked_product_id"
            defaultValue={story?.linked_product_id || ''}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 outline-none"
          >
            <option value="">-- None --</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Caption (Optional)</label>
          <input
            type="text"
            name="caption"
            defaultValue={story?.caption || ''}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 outline-none"
            placeholder="Short text overlay..."
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Display Order</label>
            <input
              type="number"
              name="display_order"
              defaultValue={story?.display_order || 0}
              required
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <label className="flex items-center gap-2 mt-3 cursor-pointer">
              <input
                type="checkbox"
                name="is_active"
                defaultChecked={story ? story.is_active : true}
                className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
              />
              <span className="text-sm">Active</span>
            </label>
          </div>
        </div>

        <div className="pt-4 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="px-4 py-2 text-sm font-semibold bg-primary text-white rounded-lg hover:bg-primary/90 transition disabled:opacity-50"
          >
            {isLoading ? 'Saving...' : 'Save Story'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function StoriesAdminPage() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const { data: stories, isLoading } = useQuery<Story[]>({
    queryKey: ['admin-stories'],
    queryFn: async () => {
      const { data } = await api.get('/stories/admin');
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/stories/admin/${id}`);
    },
    onSuccess: () => {
      toast.success('Story deleted');
      queryClient.invalidateQueries({ queryKey: ['admin-stories'] });
      queryClient.invalidateQueries({ queryKey: ['stories'] });
    },
    onError: (err) => {
      toast.error(getApiErrorDetail(err, 'Failed to delete story'));
    },
  });

  const handleDelete = (id: number) => {
    if (confirm('Are you sure you want to delete this story?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleEdit = (id: number) => {
    setEditingId(id);
    setIsFormOpen(true);
  };

  return (
    <ErrorBoundary>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Stories Management</h1>
          <button
            onClick={() => {
              setEditingId(null);
              setIsFormOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition text-sm font-semibold"
          >
            <Plus size={16} /> Add Story
          </button>
        </div>

        {isFormOpen ? (
          <StoryForm
            storyId={editingId}
            onClose={() => setIsFormOpen(false)}
            onSuccess={() => {
              setIsFormOpen(false);
              queryClient.invalidateQueries({ queryKey: ['admin-stories'] });
              queryClient.invalidateQueries({ queryKey: ['stories'] });
            }}
          />
        ) : (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              {isLoading ? (
                <div className="p-12"><Spinner /></div>
              ) : stories && stories.length > 0 ? (
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-gray-50 text-gray-500">
                    <tr>
                      <th className="px-6 py-4 font-medium">Order</th>
                      <th className="px-6 py-4 font-medium">Video/Thumb</th>
                      <th className="px-6 py-4 font-medium">Linked Product</th>
                      <th className="px-6 py-4 font-medium">Status</th>
                      <th className="px-6 py-4 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {stories.map((story) => (
                      <tr key={story.id} className="hover:bg-gray-50/50">
                        <td className="px-6 py-4 font-medium">{story.display_order}</td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2 items-center">
                            {story.thumbnail ? (
                              <img src={story.thumbnail} alt="" className="w-10 h-10 object-cover rounded bg-gray-100" />
                            ) : (
                              <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center text-gray-400">
                                <Video size={16} />
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {story.linked_product ? (
                            <span className="truncate max-w-[200px] block" title={story.linked_product.name}>
                              {story.linked_product.name}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {story.is_active ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">
                              <CheckCircle size={12} /> Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                              <XCircle size={12} /> Inactive
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right space-x-2">
                          <button
                            onClick={() => handleEdit(story.id)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded transition"
                            title="Edit"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(story.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded transition"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-12 text-center text-gray-500">
                  No stories found. Add your first story to get started.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}

