import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api';
export function useAdminStats() {
    return useQuery({
        queryKey: ['admin', 'stats'],
        queryFn: async () => {
            const { data } = await api.get('/admin/stats');
            return data;
        },
    });
}
export function useAdminOrders(status, page = 1) {
    return useQuery({
        queryKey: ['admin', 'orders', status, page],
        queryFn: async () => {
            const params = { page };
            if (status)
                params.status = status;
            const { data } = await api.get('/admin/orders', { params });
            return data;
        },
    });
}
export function useUpdateOrderStatus() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, status }) => {
            const { data } = await api.put(`/admin/orders/${id}/status`, { status });
            return data;
        },
        onSuccess: () => qc.invalidateQueries({ queryKey: ['admin'] }),
    });
}
export function useAdminUsers(page = 1) {
    return useQuery({
        queryKey: ['admin', 'users', page],
        queryFn: async () => {
            const { data } = await api.get('/admin/users', { params: { page } });
            return data;
        },
    });
}
export function useCreateProduct() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (formData) => {
            const { data } = await api.post('/products', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            return data;
        },
        onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
    });
}
export function useDeleteProduct() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (id) => {
            await api.delete(`/products/${id}`);
        },
        onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
    });
}
export function useDeleteCategory() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (id) => {
            await api.delete(`/categories/${id}`);
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['categories'] });
            qc.invalidateQueries({ queryKey: ['categories-admin'] });
        },
    });
}
export function useCreateCategory() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (body) => {
            const { data } = await api.post('/categories', body);
            return data;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['categories'] });
            qc.invalidateQueries({ queryKey: ['categories-admin'] });
        },
    });
}
export function useUpdateCategory() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, body, }) => {
            const { data } = await api.put(`/categories/${id}`, body);
            return data;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['categories'] });
            qc.invalidateQueries({ queryKey: ['categories-admin'] });
        },
    });
}
export function useCreateBlogPost() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (formData) => {
            const { data } = await api.post('/blog', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            return data;
        },
        onSuccess: () => qc.invalidateQueries({ queryKey: ['blog'] }),
    });
}
export function useUpdateBlogPost() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async ({ slug, body, }) => {
            const { data } = await api.put(`/blog/${slug}`, body);
            return data;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['blog'] });
        },
    });
}
export function useDeleteBlogPost() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (slug) => {
            await api.delete(`/blog/${slug}`);
        },
        onSuccess: () => qc.invalidateQueries({ queryKey: ['blog'] }),
    });
}
