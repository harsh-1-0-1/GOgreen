import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, X, Image as ImageIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { useBlogPosts } from '@/hooks/useBlog';
import { useCreateBlogPost, useUpdateBlogPost, useDeleteBlogPost } from '@/hooks/useAdmin';
import type { BlogPost } from '@/types';

export default function BlogAdminPage() {
  const [page, setPage] = useState(1);
  const { data: blogData, isLoading } = useBlogPosts({ page, limit: 10 });
  const createMutation = useCreateBlogPost();
  const updateMutation = useUpdateBlogPost();
  const deleteMutation = useDeleteBlogPost();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);

  // Form states
  const [title, setTitle] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('CARE'); // Default based on enum: GROW, CARE, DIY, TIPS
  const [authorName, setAuthorName] = useState('Admin');
  const [isPublished, setIsPublished] = useState(false);
  const [coverImage, setCoverImage] = useState<File | null>(null);

  useEffect(() => {
    if (editingPost) {
      setTitle(editingPost.title);
      setExcerpt(editingPost.excerpt);
      setContent(editingPost.content);
      setCategory(editingPost.category);
      setAuthorName(editingPost.author_name);
      setIsPublished(editingPost.is_published);
      setCoverImage(null);
    } else {
      resetForm();
    }
  }, [editingPost]);

  const resetForm = () => {
    setTitle('');
    setExcerpt('');
    setContent('');
    setCategory('CARE');
    setAuthorName('Admin');
    setIsPublished(false);
    setCoverImage(null);
    setEditingPost(null);
  };

  const openCreateModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (post: BlogPost) => {
    setEditingPost(post);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    resetForm();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !excerpt || !content || !category || !authorName) {
      toast.error('Please fill all required fields');
      return;
    }

    try {
      if (editingPost) {
        // Update (uses JSON payload, cover image update via this route might not be fully supported in backend currently if it expects JSON, but let's send what we have)
        // Note: The backend update_post expects BlogPostUpdate which is JSON. It doesn't handle cover_image upload in the PUT route.
        await updateMutation.mutateAsync({
          slug: editingPost.slug,
          body: {
            title,
            excerpt,
            content,
            category,
            author_name: authorName,
            is_published: isPublished,
            // cover_image_url would need to be updated separately or handled differently if backend allows
          },
        });
        toast.success('Blog post updated successfully');
      } else {
        // Create (uses FormData)
        const formData = new FormData();
        formData.append('title', title);
        formData.append('excerpt', excerpt);
        formData.append('content', content);
        formData.append('category', category);
        formData.append('author_name', authorName);
        formData.append('is_published', String(isPublished));
        if (coverImage) {
          formData.append('cover_image', coverImage);
        }

        await createMutation.mutateAsync(formData);
        toast.success('Blog post created successfully');
      }
      closeModal();
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'An error occurred');
    }
  };

  const handleDelete = async (slug: string) => {
    if (confirm('Are you sure you want to delete this blog post?')) {
      try {
        await deleteMutation.mutateAsync(slug);
        toast.success('Blog post deleted successfully');
      } catch (err: any) {
        toast.error(err.response?.data?.detail || 'Failed to delete');
      }
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-xl sm:text-2xl font-bold">Blog Posts</h1>
        <button
          onClick={openCreateModal}
          className="px-4 py-2 bg-primary text-white text-sm rounded-lg font-medium flex items-center gap-2 hover:bg-primary/90 transition-colors"
        >
          <Plus size={16} /> New Post
        </button>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading blogs...</div>
        ) : blogData?.items.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No blog posts found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50 border-b text-gray-600">
                <tr>
                  <th className="px-4 py-3 font-medium">Post</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Author</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {blogData?.items.map((post) => (
                  <tr key={post.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {post.cover_image_url ? (
                          <img src={post.cover_image_url} alt="" className="w-10 h-10 rounded-lg object-cover bg-gray-100" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400">
                            <ImageIcon size={16} />
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-gray-900 max-w-[200px] sm:max-w-xs truncate">{post.title}</p>
                          <p className="text-xs text-gray-500">{new Date(post.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
                        {post.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{post.author_name}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${post.is_published ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {post.is_published ? 'Published' : 'Draft'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEditModal(post)}
                          className="p-1.5 text-gray-400 hover:text-primary transition-colors"
                          title="Edit"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(post.slug)}
                          className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {blogData && blogData.pages > 1 && (
          <div className="p-4 border-t flex justify-center gap-2">
            {Array.from({ length: blogData.pages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${page === p ? 'bg-primary text-white' : 'hover:bg-gray-100 text-gray-600'}`}
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
          <div className="fixed inset-0 bg-black/50 transition-opacity" onClick={closeModal} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 sm:p-6 border-b shrink-0">
              <h2 className="text-lg font-bold">{editingPost ? 'Edit Blog Post' : 'Create Blog Post'}</h2>
              <button onClick={closeModal} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Excerpt *</label>
                <textarea
                  required
                  rows={2}
                  value={excerpt}
                  onChange={(e) => setExcerpt(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  placeholder="Short description for blog lists"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Content * (Markdown/HTML supported)</label>
                <textarea
                  required
                  rows={6}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono text-sm"
                  placeholder="Write your blog content here..."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                  <select
                    required
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    <option value="GROW">Grow</option>
                    <option value="CARE">Care</option>
                    <option value="DIY">DIY</option>
                    <option value="TIPS">Tips</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Author Name *</label>
                  <input
                    type="text"
                    required
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPublished}
                    onChange={(e) => setIsPublished(e.target.checked)}
                    className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
                  />
                  <span className="text-sm font-medium text-gray-700">Publish immediately</span>
                </label>
              </div>

              {!editingPost && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cover Image</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setCoverImage(e.target.files?.[0] || null)}
                    className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-light/10 file:text-primary hover:file:bg-primary-light/20"
                  />
                </div>
              )}
            </form>

            <div className="p-4 sm:p-6 border-t shrink-0 flex justify-end gap-3 bg-gray-50/50 rounded-b-2xl">
              <button
                type="button"
                onClick={closeModal}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
                className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {editingPost ? 'Save Changes' : 'Create Post'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
