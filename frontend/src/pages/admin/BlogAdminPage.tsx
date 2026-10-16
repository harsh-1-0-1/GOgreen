import React, { useState, useCallback } from 'react';
import { Plus, Trash2, Edit2, X, Image as ImageIcon, Eye, Edit3, HelpCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useBlogPosts } from '@/hooks/useBlog';
import { useCreateBlogPost, useUpdateBlogPost, useDeleteBlogPost } from '@/hooks/useAdmin';
import { getApiErrorDetail } from '@/lib/apiError';
import type { BlogPost } from '@/types';

const CATEGORIES = [
  { value: 'GROW', label: '🌱 Plant Growth' },
  { value: 'CARE', label: '💧 Care & Maintenance' },
  { value: 'DIY', label: '🛠️ Garden Projects (DIY)' },
  { value: 'TIPS', label: '💡 Quick Gardening Tips' },
];

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
  const [category, setCategory] = useState('CARE');
  const [authorName, setAuthorName] = useState('Admin Desk');
  const [isPublished, setIsPublished] = useState(false);
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [coverImagePreview, setCoverImagePreview] = useState<string | null>(null);

  // Active Mode: 'edit' or 'preview'
  const [activeFormTab, setActiveFormTab] = useState<'write' | 'preview'>('write');

  // Defined with useCallback so the form-seed logic can safely call it.
  const resetForm = useCallback(() => {
    setTitle('');
    setExcerpt('');
    setContent('');
    setCategory('CARE');
    setAuthorName('Admin Desk');
    setIsPublished(false);
    setCoverImage(null);
    setCoverImagePreview(null);
    setEditingPost(null);
    setActiveFormTab('write');
  }, []);

  // Seed the form when entering edit mode (or reset for create). Guarded render-time
  // adjustment replaces a synchronous setState effect.
  const [lastEditedPost, setLastEditedPost] = useState<BlogPost | null>(null);
  if (editingPost !== lastEditedPost) {
    setLastEditedPost(editingPost);
    if (editingPost) {
      setTitle(editingPost.title);
      setExcerpt(editingPost.excerpt);
      setContent(editingPost.content);
      setCategory(editingPost.category);
      setAuthorName(editingPost.author_name);
      setIsPublished(editingPost.is_published);
      setCoverImage(null);
      setCoverImagePreview(editingPost.cover_image_url || null);
    } else {
      resetForm();
    }
  }

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

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCoverImage(file);
      setCoverImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !excerpt.trim() || !content.trim() || !category || !authorName.trim()) {
      toast.error('Please enter all required information');
      return;
    }

    try {
      if (editingPost) {
        await updateMutation.mutateAsync({
          slug: editingPost.slug,
          body: {
            title,
            excerpt,
            content,
            category,
            author_name: authorName,
            is_published: isPublished,
          },
        });
        toast.success('Article updated successfully!');
      } else {
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
        toast.success('New article published successfully!');
      }
      closeModal();
    } catch (err) {
      toast.error(getApiErrorDetail(err, 'Something went wrong. Verify inputs.'));
    }
  };

  const handleDelete = async (slug: string) => {
    if (confirm('Are you sure you want to delete this article? Customers will no longer be able to read it.')) {
      try {
        await deleteMutation.mutateAsync(slug);
        toast.success('Article deleted successfully!');
      } catch (err) {
        toast.error(getApiErrorDetail(err, 'Failed to delete'));
      }
    }
  };

  const inputClass = "w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors";

  return (
    <div className="space-y-4">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Blog Publications</h1>
          <p className="text-xs text-gray-500 mt-0.5">Write stories, care tips, plant science updates, and organic garden blogs for your customers.</p>
        </div>
        <button
          onClick={openCreateModal}
          className="px-4 py-2.5 bg-primary text-white text-sm rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-primary/95 transition shrink-0"
        >
          <Plus size={16} /> Write Article
        </button>
      </div>

      {/* Main List */}
      <div className="bg-white rounded-xl border overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-12 text-center text-gray-400 text-sm">Loading articles registry...</div>
        ) : blogData?.items.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm">No articles found. Click "Write Article" to start.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50 border-b text-gray-600">
                <tr>
                  <th className="px-5 py-3.5 font-semibold text-xs">Article Detail</th>
                  <th className="px-5 py-3.5 font-semibold text-xs">Topic Category</th>
                  <th className="px-5 py-3.5 font-semibold text-xs">Writer</th>
                  <th className="px-5 py-3.5 font-semibold text-xs">Status</th>
                  <th className="px-5 py-3.5 font-semibold text-xs text-right w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {blogData?.items.map((post) => (
                  <tr key={post.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        {post.cover_image_url ? (
                          <img src={post.cover_image_url} alt="" className="w-10 h-10 rounded-lg object-cover bg-gray-100 border shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 border shrink-0">
                            <ImageIcon size={16} />
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-gray-900 max-w-[200px] sm:max-w-xs truncate">{post.title}</p>
                          <p className="text-[10px] text-gray-400 font-medium mt-0.5">{new Date(post.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className="px-2.5 py-0.5 bg-gray-100 text-gray-700 rounded text-xs font-semibold uppercase">
                        {CATEGORIES.find(c => c.value === post.category)?.label || post.category}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-600 font-medium">{post.author_name}</td>
                    <td className="px-5 py-3">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${post.is_published ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                        {post.is_published ? 'Published' : 'Draft'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEditModal(post)}
                          className="p-1.5 text-gray-400 hover:text-primary rounded-lg hover:bg-gray-50 transition"
                          title="Edit article"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(post.slug)}
                          className="p-1.5 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition"
                          title="Delete article"
                        >
                          <Trash2 size={15} />
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
          <div className="p-4 border-t flex justify-center gap-1 bg-gray-50/30">
            {Array.from({ length: blogData.pages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`w-7 h-7 rounded-lg text-xs font-semibold transition ${page === p ? 'bg-primary text-white' : 'hover:bg-gray-200 text-gray-600'}`}
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Editor Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
          <div className="fixed inset-0 bg-black/55 transition-opacity" onClick={closeModal} />
          
          <div className="relative bg-[#FAFAF8] rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            
            {/* Modal Navigation */}
            <div className="flex items-center justify-between px-6 py-4 border-b bg-white shrink-0">
              <div className="flex items-center gap-6">
                <div>
                  <h2 className="text-base font-bold text-gray-900">{editingPost ? 'Edit Blog Publication' : 'Write New Article'}</h2>
                  <p className="text-[11px] text-gray-500 mt-0.5">Draft visual educational stories for your readers</p>
                </div>
                <div className="flex border rounded-lg overflow-hidden bg-gray-50 p-0.5 shrink-0 text-xs font-bold text-gray-600">
                  <button
                    type="button"
                    onClick={() => setActiveFormTab('write')}
                    className={`px-3 py-1 rounded flex items-center gap-1 transition ${activeFormTab === 'write' ? 'bg-white text-primary shadow-sm' : 'hover:bg-gray-100'}`}
                  >
                    <Edit3 size={13} /> Edit Article
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveFormTab('preview')}
                    className={`px-3 py-1 rounded flex items-center gap-1 transition ${activeFormTab === 'preview' ? 'bg-white text-primary shadow-sm' : 'hover:bg-gray-100'}`}
                  >
                    <Eye size={13} /> Live Preview
                  </button>
                </div>
              </div>
              <button onClick={closeModal} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors">
                <X size={20} />
              </button>
            </div>
            
            {activeFormTab === 'write' ? (
              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
                
                {/* Title */}
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Article Title *</label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. 5 Simple Steps to Grow Healthy Monsteras at Home"
                    className={inputClass}
                  />
                  <p className="text-[10px] text-gray-400 mt-1">Make your header catchy to attract clicks.</p>
                </div>

                {/* Excerpt */}
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Short Excerpt / Summary *</label>
                  <textarea
                    required
                    rows={2}
                    value={excerpt}
                    onChange={(e) => setExcerpt(e.target.value)}
                    className={inputClass}
                    placeholder="Provide a 1-2 sentence description summarizing this post..."
                  />
                  <p className="text-[10px] text-[#2D6A4F] font-semibold mt-1 flex items-center gap-1">
                    <HelpCircle size={12} /> Excerpt acts as SEO meta description. Keep under 160 characters for best display on Google.
                  </p>
                </div>

                {/* Content */}
                <div>
                  <label className="text-xs font-semibold text-gray-700 block mb-1">Article Body / Content *</label>
                  <textarea
                    required
                    rows={8}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className={`${inputClass} font-mono text-xs`}
                    placeholder="Type article content. You can write paragraphs, paste lists, or HTML tags."
                  />
                  <p className="text-[10px] text-gray-400 mt-1">Tip: Use blank lines between paragraphs to make reading easy.</p>
                </div>

                {/* Category & Author */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-700 block mb-1">Topic Category *</label>
                    <select
                      required
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full px-3 py-2 text-xs border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c.value} value={c.value}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 block mb-1">Writer Name *</label>
                    <input
                      type="text"
                      required
                      value={authorName}
                      onChange={(e) => setAuthorName(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>

                {/* Cover Image Upload (only for new creation since backend edit page uses JSON and lacks image file handler) */}
                {!editingPost && (
                  <div className="pt-2 border-t">
                    <label className="text-xs font-semibold text-gray-700 block mb-1.5">Article Cover Image</label>
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageChange}
                          className="w-full text-xs text-gray-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border file:text-xs file:font-semibold file:bg-primary-light/10 file:text-primary file:border-primary-light/20 hover:file:bg-primary-light/20 cursor-pointer"
                        />
                        <p className="text-[9px] text-gray-400 mt-1">Recommended size: 1200x600px landscape format.</p>
                      </div>
                      {coverImagePreview && (
                        <div className="h-12 w-20 border rounded-lg overflow-hidden shrink-0 bg-gray-50">
                          <img src={coverImagePreview} alt="" className="h-full w-full object-cover" />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Publish Toggle */}
                <div className="flex items-center justify-between pt-3 border-t">
                  <div>
                    <label className="text-xs font-semibold text-gray-800 block">Publication Visibility</label>
                    <span className="text-[10px] text-gray-400">Make this article immediately readable in the blog section.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsPublished(!isPublished)}
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      isPublished ? 'bg-primary' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                        isPublished ? 'translate-x-[22px]' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>

              </form>
            ) : (
              // Live Article Preview Tab
              <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-white">
                
                {/* Simulated Blog detail page */}
                <div className="max-w-2xl mx-auto space-y-4">
                  
                  {/* category */}
                  <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-2.5 py-1 rounded">
                    {CATEGORIES.find(c => c.value === category)?.label || category}
                  </span>
                  
                  {/* Title */}
                  <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight">
                    {title || 'Article Header Title'}
                  </h1>

                  {/* meta */}
                  <div className="flex items-center gap-3 text-xs text-gray-500 border-y py-2 border-gray-100">
                    <span className="font-semibold text-gray-800">By {authorName}</span>
                    <span>•</span>
                    <span>{new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>

                  {/* cover image */}
                  {coverImagePreview ? (
                    <div className="aspect-[2/1] rounded-xl overflow-hidden bg-gray-50 border">
                      <img src={coverImagePreview} alt="" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="aspect-[2/1] rounded-xl border border-dashed flex flex-col items-center justify-center text-gray-300 bg-gray-50">
                      <ImageIcon size={40} />
                      <span className="text-xs mt-1">No cover image uploaded</span>
                    </div>
                  )}

                  {/* Excerpt */}
                  {excerpt && (
                    <p className="text-sm font-medium text-gray-600 bg-gray-50 p-4 rounded-xl border-l-4 border-primary italic">
                      "{excerpt}"
                    </p>
                  )}

                  {/* Content body */}
                  <div className="prose prose-sm max-w-none text-xs sm:text-sm text-gray-700 leading-relaxed space-y-3 whitespace-pre-wrap">
                    {content || 'Start typing the body of your article. Your text structure will display here.'}
                  </div>
                </div>

              </div>
            )}

            {/* Footer buttons */}
            <div className="p-4 sm:p-5 border-t shrink-0 flex justify-end gap-3 bg-white">
              <button
                type="button"
                onClick={closeModal}
                className="px-4 py-2 border border-gray-300 rounded-xl text-xs font-semibold hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
                className="px-5 py-2 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary/95 transition disabled:opacity-50"
              >
                {editingPost ? 'Save Changes' : 'Publish Article'}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
