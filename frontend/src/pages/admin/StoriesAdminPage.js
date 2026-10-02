import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, Video, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { getApiErrorDetail } from '@/lib/apiError';
import Spinner from '@/components/ui/Spinner';
import ErrorBoundary from '@/components/ui/ErrorBoundary';
function StoryForm({ storyId, onClose, onSuccess }) {
    // Fetch products directly — avoids parent timing issues and limit=100 validation error
    const { data: productsData } = useQuery({
        queryKey: ['products-minimal'],
        queryFn: async () => {
            const { data } = await api.get('/products?limit=50');
            return data;
        },
    });
    const products = productsData?.items || [];
    const { data: story, isLoading: isLoadingStory } = useQuery({
        queryKey: ['admin-story', storyId],
        queryFn: async () => {
            const { data } = await api.get('/stories/admin');
            return data.find((s) => s.id === storyId);
        },
        enabled: !!storyId,
    });
    const [isLoading, setIsLoading] = useState(false);
    const [videoFile, setVideoFile] = useState(null);
    const [thumbnailFile, setThumbnailFile] = useState(null);
    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        const formData = new FormData(e.currentTarget);
        const fd = new FormData();
        fd.append('display_order', formData.get('display_order') || '0');
        fd.append('is_active', formData.get('is_active') === 'on' ? 'true' : 'false');
        const caption = formData.get('caption');
        if (caption !== null)
            fd.append('caption', caption);
        const linked_product_id = formData.get('linked_product_id');
        if (linked_product_id) {
            fd.append('linked_product_id', linked_product_id);
        }
        else {
            fd.append('linked_product_id', '0');
        }
        if (videoFile)
            fd.append('video', videoFile);
        if (thumbnailFile)
            fd.append('thumbnail', thumbnailFile);
        try {
            if (storyId) {
                await api.put(`/stories/admin/${storyId}`, fd, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
                toast.success('Story updated');
            }
            else {
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
        }
        catch (err) {
            toast.error(getApiErrorDetail(err, 'Failed to save story'));
        }
        finally {
            setIsLoading(false);
        }
    };
    if (storyId && isLoadingStory)
        return _jsx("div", { className: "p-12", children: _jsx(Spinner, {}) });
    return (_jsxs("div", { className: "bg-white rounded-xl shadow-sm p-6 border", children: [_jsx("h2", { className: "text-lg font-bold mb-6", children: storyId ? 'Edit Story' : 'New Story' }), _jsxs("form", { onSubmit: handleSubmit, className: "space-y-5 max-w-2xl", children: [_jsxs("div", { children: [_jsxs("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: ["Video File (MP4/WebM) ", storyId ? '' : '*'] }), _jsx("input", { type: "file", accept: "video/mp4,video/webm", onChange: (e) => setVideoFile(e.target.files?.[0] || null), className: "w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20" }), story?.video && !videoFile && (_jsx("p", { className: "mt-2 text-xs text-gray-500", children: "Current video is uploaded. Selecting a new file will replace it." }))] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Custom Thumbnail (Image)" }), _jsx("input", { type: "file", accept: "image/*", onChange: (e) => setThumbnailFile(e.target.files?.[0] || null), className: "w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200" }), story?.thumbnail && !thumbnailFile && (_jsx("div", { className: "mt-2", children: _jsx("img", { src: story.thumbnail, alt: "thumbnail", className: "h-20 rounded" }) }))] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Linked Product" }), _jsxs("select", { name: "linked_product_id", defaultValue: story?.linked_product_id || '', className: "w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 outline-none", children: [_jsx("option", { value: "", children: "-- None --" }), products.map((p) => (_jsx("option", { value: p.id, children: p.name }, p.id)))] })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Caption (Optional)" }), _jsx("input", { type: "text", name: "caption", defaultValue: story?.caption || '', className: "w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 outline-none", placeholder: "Short text overlay..." })] }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Display Order" }), _jsx("input", { type: "number", name: "display_order", defaultValue: story?.display_order || 0, required: true, className: "w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 outline-none" })] }), _jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium text-gray-700 mb-1", children: "Status" }), _jsxs("label", { className: "flex items-center gap-2 mt-3 cursor-pointer", children: [_jsx("input", { type: "checkbox", name: "is_active", defaultChecked: story ? story.is_active : true, className: "w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary" }), _jsx("span", { className: "text-sm", children: "Active" })] })] })] }), _jsxs("div", { className: "pt-4 flex gap-3", children: [_jsx("button", { type: "button", onClick: onClose, className: "px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition", children: "Cancel" }), _jsx("button", { type: "submit", disabled: isLoading, className: "px-4 py-2 text-sm font-semibold bg-primary text-white rounded-lg hover:bg-primary/90 transition disabled:opacity-50", children: isLoading ? 'Saving...' : 'Save Story' })] })] })] }));
}
export default function StoriesAdminPage() {
    const queryClient = useQueryClient();
    const [editingId, setEditingId] = useState(null);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const { data: stories, isLoading } = useQuery({
        queryKey: ['admin-stories'],
        queryFn: async () => {
            const { data } = await api.get('/stories/admin');
            return data;
        },
    });
    const deleteMutation = useMutation({
        mutationFn: async (id) => {
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
    const handleDelete = (id) => {
        if (confirm('Are you sure you want to delete this story?')) {
            deleteMutation.mutate(id);
        }
    };
    const handleEdit = (id) => {
        setEditingId(id);
        setIsFormOpen(true);
    };
    return (_jsx(ErrorBoundary, { children: _jsxs("div", { className: "max-w-5xl mx-auto space-y-6", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h1", { className: "text-2xl font-bold", children: "Stories Management" }), _jsxs("button", { onClick: () => {
                                setEditingId(null);
                                setIsFormOpen(true);
                            }, className: "flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition text-sm font-semibold", children: [_jsx(Plus, { size: 16 }), " Add Story"] })] }), isFormOpen ? (_jsx(StoryForm, { storyId: editingId, onClose: () => setIsFormOpen(false), onSuccess: () => {
                        setIsFormOpen(false);
                        queryClient.invalidateQueries({ queryKey: ['admin-stories'] });
                        queryClient.invalidateQueries({ queryKey: ['stories'] });
                    } })) : (_jsx("div", { className: "bg-white rounded-xl shadow-sm overflow-hidden", children: _jsx("div", { className: "overflow-x-auto", children: isLoading ? (_jsx("div", { className: "p-12", children: _jsx(Spinner, {}) })) : stories && stories.length > 0 ? (_jsxs("table", { className: "w-full text-left text-sm whitespace-nowrap", children: [_jsx("thead", { className: "bg-gray-50 text-gray-500", children: _jsxs("tr", { children: [_jsx("th", { className: "px-6 py-4 font-medium", children: "Order" }), _jsx("th", { className: "px-6 py-4 font-medium", children: "Video/Thumb" }), _jsx("th", { className: "px-6 py-4 font-medium", children: "Linked Product" }), _jsx("th", { className: "px-6 py-4 font-medium", children: "Status" }), _jsx("th", { className: "px-6 py-4 font-medium text-right", children: "Actions" })] }) }), _jsx("tbody", { className: "divide-y", children: stories.map((story) => (_jsxs("tr", { className: "hover:bg-gray-50/50", children: [_jsx("td", { className: "px-6 py-4 font-medium", children: story.display_order }), _jsx("td", { className: "px-6 py-4", children: _jsx("div", { className: "flex gap-2 items-center", children: story.thumbnail ? (_jsx("img", { src: story.thumbnail, alt: "", className: "w-10 h-10 object-cover rounded bg-gray-100" })) : (_jsx("div", { className: "w-10 h-10 rounded bg-gray-100 flex items-center justify-center text-gray-400", children: _jsx(Video, { size: 16 }) })) }) }), _jsx("td", { className: "px-6 py-4", children: story.linked_product ? (_jsx("span", { className: "truncate max-w-[200px] block", title: story.linked_product.name, children: story.linked_product.name })) : (_jsx("span", { className: "text-gray-400", children: "-" })) }), _jsx("td", { className: "px-6 py-4", children: story.is_active ? (_jsxs("span", { className: "inline-flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full", children: [_jsx(CheckCircle, { size: 12 }), " Active"] })) : (_jsxs("span", { className: "inline-flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-full", children: [_jsx(XCircle, { size: 12 }), " Inactive"] })) }), _jsxs("td", { className: "px-6 py-4 text-right space-x-2", children: [_jsx("button", { onClick: () => handleEdit(story.id), className: "p-2 text-blue-600 hover:bg-blue-50 rounded transition", title: "Edit", children: _jsx(Edit2, { size: 16 }) }), _jsx("button", { onClick: () => handleDelete(story.id), className: "p-2 text-red-600 hover:bg-red-50 rounded transition", title: "Delete", children: _jsx(Trash2, { size: 16 }) })] })] }, story.id))) })] })) : (_jsx("div", { className: "p-12 text-center text-gray-500", children: "No stories found. Add your first story to get started." })) }) }))] }) }));
}
