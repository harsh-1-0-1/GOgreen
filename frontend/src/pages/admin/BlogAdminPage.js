import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useState, useCallback } from 'react';
import { Plus, Trash2, Edit2, X, Image as ImageIcon, Eye, Edit3, HelpCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useBlogPosts } from '@/hooks/useBlog';
import { useCreateBlogPost, useUpdateBlogPost, useDeleteBlogPost } from '@/hooks/useAdmin';
import { getApiErrorDetail } from '@/lib/apiError';
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
    const [editingPost, setEditingPost] = useState(null);
    // Form states
    const [title, setTitle] = useState('');
    const [excerpt, setExcerpt] = useState('');
    const [content, setContent] = useState('');
    const [category, setCategory] = useState('CARE');
    const [authorName, setAuthorName] = useState('Admin Desk');
    const [isPublished, setIsPublished] = useState(false);
    const [coverImage, setCoverImage] = useState(null);
    const [coverImagePreview, setCoverImagePreview] = useState(null);
    // Active Mode: 'edit' or 'preview'
    const [activeFormTab, setActiveFormTab] = useState('write');
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
    const [lastEditedPost, setLastEditedPost] = useState(null);
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
        }
        else {
            resetForm();
        }
    }
    const openCreateModal = () => {
        resetForm();
        setIsModalOpen(true);
    };
    const openEditModal = (post) => {
        setEditingPost(post);
        setIsModalOpen(true);
    };
    const closeModal = () => {
        setIsModalOpen(false);
        resetForm();
    };
    const handleImageChange = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            setCoverImage(file);
            setCoverImagePreview(URL.createObjectURL(file));
        }
    };
    const handleSubmit = async (e) => {
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
            }
            else {
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
        }
        catch (err) {
            toast.error(getApiErrorDetail(err, 'Something went wrong. Verify inputs.'));
        }
    };
    const handleDelete = async (slug) => {
        if (confirm('Are you sure you want to delete this article? Customers will no longer be able to read it.')) {
            try {
                await deleteMutation.mutateAsync(slug);
                toast.success('Article deleted successfully!');
            }
            catch (err) {
                toast.error(getApiErrorDetail(err, 'Failed to delete'));
            }
        }
    };
    const inputClass = "w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors";
    return (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "flex flex-col sm:flex-row sm:items-center justify-between gap-3", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-xl sm:text-2xl font-bold text-gray-900", children: "Blog Publications" }), _jsx("p", { className: "text-xs text-gray-500 mt-0.5", children: "Write stories, care tips, plant science updates, and organic garden blogs for your customers." })] }), _jsxs("button", { onClick: openCreateModal, className: "px-4 py-2.5 bg-primary text-white text-sm rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-primary/95 transition shrink-0", children: [_jsx(Plus, { size: 16 }), " Write Article"] })] }), _jsxs("div", { className: "bg-white rounded-xl border overflow-hidden shadow-sm", children: [isLoading ? (_jsx("div", { className: "p-12 text-center text-gray-400 text-sm", children: "Loading articles registry..." })) : blogData?.items.length === 0 ? (_jsx("div", { className: "p-12 text-center text-gray-400 text-sm", children: "No articles found. Click \"Write Article\" to start." })) : (_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-left text-sm whitespace-nowrap", children: [_jsx("thead", { className: "bg-gray-50 border-b text-gray-600", children: _jsxs("tr", { children: [_jsx("th", { className: "px-5 py-3.5 font-semibold text-xs", children: "Article Detail" }), _jsx("th", { className: "px-5 py-3.5 font-semibold text-xs", children: "Topic Category" }), _jsx("th", { className: "px-5 py-3.5 font-semibold text-xs", children: "Writer" }), _jsx("th", { className: "px-5 py-3.5 font-semibold text-xs", children: "Status" }), _jsx("th", { className: "px-5 py-3.5 font-semibold text-xs text-right w-24", children: "Actions" })] }) }), _jsx("tbody", { className: "divide-y", children: blogData?.items.map((post) => (_jsxs("tr", { className: "hover:bg-gray-50/50 transition-colors", children: [_jsx("td", { className: "px-5 py-3", children: _jsxs("div", { className: "flex items-center gap-3", children: [post.cover_image_url ? (_jsx("img", { src: post.cover_image_url, alt: "", className: "w-10 h-10 rounded-lg object-cover bg-gray-100 border shrink-0" })) : (_jsx("div", { className: "w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 border shrink-0", children: _jsx(ImageIcon, { size: 16 }) })), _jsxs("div", { children: [_jsx("p", { className: "font-semibold text-gray-900 max-w-[200px] sm:max-w-xs truncate", children: post.title }), _jsx("p", { className: "text-[10px] text-gray-400 font-medium mt-0.5", children: new Date(post.created_at).toLocaleDateString() })] })] }) }), _jsx("td", { className: "px-5 py-3", children: _jsx("span", { className: "px-2.5 py-0.5 bg-gray-100 text-gray-700 rounded text-xs font-semibold uppercase", children: CATEGORIES.find(c => c.value === post.category)?.label || post.category }) }), _jsx("td", { className: "px-5 py-3 text-gray-600 font-medium", children: post.author_name }), _jsx("td", { className: "px-5 py-3", children: _jsx("span", { className: `px-2.5 py-0.5 rounded-full text-xs font-bold ${post.is_published ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`, children: post.is_published ? 'Published' : 'Draft' }) }), _jsx("td", { className: "px-5 py-3 text-right", children: _jsxs("div", { className: "flex items-center justify-end gap-1", children: [_jsx("button", { onClick: () => openEditModal(post), className: "p-1.5 text-gray-400 hover:text-primary rounded-lg hover:bg-gray-50 transition", title: "Edit article", children: _jsx(Edit2, { size: 15 }) }), _jsx("button", { onClick: () => handleDelete(post.slug), className: "p-1.5 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition", title: "Delete article", children: _jsx(Trash2, { size: 15 }) })] }) })] }, post.id))) })] }) })), blogData && blogData.pages > 1 && (_jsx("div", { className: "p-4 border-t flex justify-center gap-1 bg-gray-50/30", children: Array.from({ length: blogData.pages }, (_, i) => i + 1).map((p) => (_jsx("button", { onClick: () => setPage(p), className: `w-7 h-7 rounded-lg text-xs font-semibold transition ${page === p ? 'bg-primary text-white' : 'hover:bg-gray-200 text-gray-600'}`, children: p }, p))) }))] }), isModalOpen && (_jsxs("div", { className: "fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0", children: [_jsx("div", { className: "fixed inset-0 bg-black/55 transition-opacity", onClick: closeModal }), _jsxs("div", { className: "relative bg-[#FAFAF8] rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden", children: [_jsxs("div", { className: "flex items-center justify-between px-6 py-4 border-b bg-white shrink-0", children: [_jsxs("div", { className: "flex items-center gap-6", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-base font-bold text-gray-900", children: editingPost ? 'Edit Blog Publication' : 'Write New Article' }), _jsx("p", { className: "text-[11px] text-gray-500 mt-0.5", children: "Draft visual educational stories for your readers" })] }), _jsxs("div", { className: "flex border rounded-lg overflow-hidden bg-gray-50 p-0.5 shrink-0 text-xs font-bold text-gray-600", children: [_jsxs("button", { type: "button", onClick: () => setActiveFormTab('write'), className: `px-3 py-1 rounded flex items-center gap-1 transition ${activeFormTab === 'write' ? 'bg-white text-primary shadow-sm' : 'hover:bg-gray-100'}`, children: [_jsx(Edit3, { size: 13 }), " Edit Article"] }), _jsxs("button", { type: "button", onClick: () => setActiveFormTab('preview'), className: `px-3 py-1 rounded flex items-center gap-1 transition ${activeFormTab === 'preview' ? 'bg-white text-primary shadow-sm' : 'hover:bg-gray-100'}`, children: [_jsx(Eye, { size: 13 }), " Live Preview"] })] })] }), _jsx("button", { onClick: closeModal, className: "p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors", children: _jsx(X, { size: 20 }) })] }), activeFormTab === 'write' ? (_jsxs("form", { onSubmit: handleSubmit, className: "flex-1 overflow-y-auto p-6 space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "text-xs font-semibold text-gray-700 block mb-1", children: "Article Title *" }), _jsx("input", { type: "text", required: true, value: title, onChange: (e) => setTitle(e.target.value), placeholder: "e.g. 5 Simple Steps to Grow Healthy Monsteras at Home", className: inputClass }), _jsx("p", { className: "text-[10px] text-gray-400 mt-1", children: "Make your header catchy to attract clicks." })] }), _jsxs("div", { children: [_jsx("label", { className: "text-xs font-semibold text-gray-700 block mb-1", children: "Short Excerpt / Summary *" }), _jsx("textarea", { required: true, rows: 2, value: excerpt, onChange: (e) => setExcerpt(e.target.value), className: inputClass, placeholder: "Provide a 1-2 sentence description summarizing this post..." }), _jsxs("p", { className: "text-[10px] text-[#2D6A4F] font-semibold mt-1 flex items-center gap-1", children: [_jsx(HelpCircle, { size: 12 }), " Excerpt acts as SEO meta description. Keep under 160 characters for best display on Google."] })] }), _jsxs("div", { children: [_jsx("label", { className: "text-xs font-semibold text-gray-700 block mb-1", children: "Article Body / Content *" }), _jsx("textarea", { required: true, rows: 8, value: content, onChange: (e) => setContent(e.target.value), className: `${inputClass} font-mono text-xs`, placeholder: "Type article content. You can write paragraphs, paste lists, or HTML tags." }), _jsx("p", { className: "text-[10px] text-gray-400 mt-1", children: "Tip: Use blank lines between paragraphs to make reading easy." })] }), _jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "text-xs font-semibold text-gray-700 block mb-1", children: "Topic Category *" }), _jsx("select", { required: true, value: category, onChange: (e) => setCategory(e.target.value), className: "w-full px-3 py-2 text-xs border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20", children: CATEGORIES.map((c) => (_jsx("option", { value: c.value, children: c.label }, c.value))) })] }), _jsxs("div", { children: [_jsx("label", { className: "text-xs font-semibold text-gray-700 block mb-1", children: "Writer Name *" }), _jsx("input", { type: "text", required: true, value: authorName, onChange: (e) => setAuthorName(e.target.value), className: inputClass })] })] }), !editingPost && (_jsxs("div", { className: "pt-2 border-t", children: [_jsx("label", { className: "text-xs font-semibold text-gray-700 block mb-1.5", children: "Article Cover Image" }), _jsxs("div", { className: "flex items-center gap-4", children: [_jsxs("div", { className: "flex-1", children: [_jsx("input", { type: "file", accept: "image/*", onChange: handleImageChange, className: "w-full text-xs text-gray-500 file:mr-4 file:py-1.5 file:px-3 file:rounded-lg file:border file:text-xs file:font-semibold file:bg-primary-light/10 file:text-primary file:border-primary-light/20 hover:file:bg-primary-light/20 cursor-pointer" }), _jsx("p", { className: "text-[9px] text-gray-400 mt-1", children: "Recommended size: 1200x600px landscape format." })] }), coverImagePreview && (_jsx("div", { className: "h-12 w-20 border rounded-lg overflow-hidden shrink-0 bg-gray-50", children: _jsx("img", { src: coverImagePreview, alt: "", className: "h-full w-full object-cover" }) }))] })] })), _jsxs("div", { className: "flex items-center justify-between pt-3 border-t", children: [_jsxs("div", { children: [_jsx("label", { className: "text-xs font-semibold text-gray-800 block", children: "Publication Visibility" }), _jsx("span", { className: "text-[10px] text-gray-400", children: "Make this article immediately readable in the blog section." })] }), _jsx("button", { type: "button", onClick: () => setIsPublished(!isPublished), className: `relative w-11 h-6 rounded-full transition-colors ${isPublished ? 'bg-primary' : 'bg-gray-300'}`, children: _jsx("span", { className: `absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${isPublished ? 'translate-x-[22px]' : 'translate-x-0.5'}` }) })] })] })) : (_jsx("div", { className: "flex-1 overflow-y-auto p-6 space-y-4 bg-white", children: _jsxs("div", { className: "max-w-2xl mx-auto space-y-4", children: [_jsx("span", { className: "inline-block text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-2.5 py-1 rounded", children: CATEGORIES.find(c => c.value === category)?.label || category }), _jsx("h1", { className: "text-2xl sm:text-3xl font-bold text-gray-900 leading-tight", children: title || 'Article Header Title' }), _jsxs("div", { className: "flex items-center gap-3 text-xs text-gray-500 border-y py-2 border-gray-100", children: [_jsxs("span", { className: "font-semibold text-gray-800", children: ["By ", authorName] }), _jsx("span", { children: "\u2022" }), _jsx("span", { children: new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) })] }), coverImagePreview ? (_jsx("div", { className: "aspect-[2/1] rounded-xl overflow-hidden bg-gray-50 border", children: _jsx("img", { src: coverImagePreview, alt: "", className: "w-full h-full object-cover" }) })) : (_jsxs("div", { className: "aspect-[2/1] rounded-xl border border-dashed flex flex-col items-center justify-center text-gray-300 bg-gray-50", children: [_jsx(ImageIcon, { size: 40 }), _jsx("span", { className: "text-xs mt-1", children: "No cover image uploaded" })] })), excerpt && (_jsxs("p", { className: "text-sm font-medium text-gray-600 bg-gray-50 p-4 rounded-xl border-l-4 border-primary italic", children: ["\"", excerpt, "\""] })), _jsx("div", { className: "prose prose-sm max-w-none text-xs sm:text-sm text-gray-700 leading-relaxed space-y-3 whitespace-pre-wrap", children: content || 'Start typing the body of your article. Your text structure will display here.' })] }) })), _jsxs("div", { className: "p-4 sm:p-5 border-t shrink-0 flex justify-end gap-3 bg-white", children: [_jsx("button", { type: "button", onClick: closeModal, className: "px-4 py-2 border border-gray-300 rounded-xl text-xs font-semibold hover:bg-gray-50 transition", children: "Cancel" }), _jsx("button", { type: "button", onClick: handleSubmit, disabled: createMutation.isPending || updateMutation.isPending, className: "px-5 py-2 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary/95 transition disabled:opacity-50", children: editingPost ? 'Save Changes' : 'Publish Article' })] })] })] }))] }));
}
