import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, CheckCircle2, ChevronDown, Loader2, ShieldCheck, Upload, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useDeliveredOrders, useSubmitDamageClaim } from '@/hooks/useDamageClaims';
const ISSUE_TYPES = [
    { value: 'broken_pot', label: 'Broken Pot / Planter' },
    { value: 'damaged_plant', label: 'Broken Stems / Leaves (Transit)' },
    { value: 'withered_plant', label: 'Withered / Dead Plant' },
    { value: 'wrong_item', label: 'Incorrect Product Delivered' },
    { value: 'missing_item', label: 'Missing Items' },
];
function orderSummaryLabel(order) {
    const names = order.items
        .map((i) => i.product_name ?? `Product #${i.product_id}`)
        .slice(0, 2)
        .join(', ');
    const extra = order.items.length > 2 ? ` +${order.items.length - 2} more` : '';
    return `#${order.id} — ${names}${extra}`;
}
function orderItemsSummary(order) {
    return order.items
        .map((i) => {
        const name = i.product_name ?? `Product #${i.product_id}`;
        return i.selected_options
            ? `${name} (${Object.values(i.selected_options).join(', ')})`
            : name;
    })
        .join(', ');
}
export default function DamageReplacementPage() {
    const navigate = useNavigate();
    const fileInputRef = useRef(null);
    // Server state
    const { data: deliveredOrders, isLoading: ordersLoading } = useDeliveredOrders();
    const submitMutation = useSubmitDamageClaim();
    // Form state
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [issueType, setIssueType] = useState('');
    const [description, setDescription] = useState('');
    const [photoFiles, setPhotoFiles] = useState([]);
    const [photoPreviews, setPhotoPreviews] = useState([]);
    // UI state
    const [errors, setErrors] = useState({});
    const [success, setSuccess] = useState(null);
    // ---------------------------------------------------------------------------
    // Handlers
    // ---------------------------------------------------------------------------
    function clearError(key) {
        setErrors((prev) => {
            if (!prev[key])
                return prev;
            const next = { ...prev };
            delete next[key];
            return next;
        });
    }
    function handleOrderSelect(e) {
        const id = parseInt(e.target.value, 10);
        const order = deliveredOrders?.find((o) => o.id === id) ?? null;
        setSelectedOrder(order);
        clearError('order');
    }
    function handleFileChange(e) {
        const files = Array.from(e.target.files ?? []);
        if (!files.length)
            return;
        const remaining = 5 - photoFiles.length;
        if (remaining <= 0) {
            toast.error('Maximum 5 photos allowed');
            return;
        }
        const toAdd = files.slice(0, remaining);
        setPhotoFiles((prev) => [...prev, ...toAdd]);
        setPhotoPreviews((prev) => [...prev, ...toAdd.map((f) => URL.createObjectURL(f))]);
        clearError('photos');
        // Reset input so the same file can be re-selected after removal
        if (fileInputRef.current)
            fileInputRef.current.value = '';
    }
    function removePhoto(index) {
        URL.revokeObjectURL(photoPreviews[index]);
        setPhotoFiles((prev) => prev.filter((_, i) => i !== index));
        setPhotoPreviews((prev) => prev.filter((_, i) => i !== index));
    }
    // ---------------------------------------------------------------------------
    // Validation
    // ---------------------------------------------------------------------------
    function validate() {
        const next = {};
        if (!selectedOrder)
            next.order = 'Please select an order';
        if (!issueType)
            next.issueType = 'Please select the issue type';
        if (description.trim().length < 10)
            next.description = 'Please describe the damage in more detail (min 10 characters)';
        if (photoFiles.length === 0)
            next.photos = 'At least one proof-of-damage photo is required';
        setErrors(next);
        return Object.keys(next).length === 0;
    }
    // ---------------------------------------------------------------------------
    // Submit
    // ---------------------------------------------------------------------------
    async function handleSubmit(e) {
        e.preventDefault();
        if (!validate()) {
            toast.error('Please fix the errors before submitting');
            return;
        }
        const fd = new FormData();
        fd.append('order_id', String(selectedOrder.id));
        fd.append('issue_type', issueType);
        fd.append('description', description.trim());
        photoFiles.forEach((file) => fd.append('photos', file));
        try {
            const claim = await submitMutation.mutateAsync(fd);
            setSuccess({
                ticketId: claim.ticket_id,
                orderId: selectedOrder.id,
                itemsSummary: orderItemsSummary(selectedOrder),
            });
            toast.success('Replacement claim submitted successfully!');
        }
        catch (err) {
            const msg = err?.response?.data?.detail ??
                'Something went wrong. Please try again.';
            toast.error(msg);
        }
    }
    // ---------------------------------------------------------------------------
    // Success screen
    // ---------------------------------------------------------------------------
    if (success) {
        return (_jsxs("div", { className: "max-w-xl mx-auto px-4 py-16 sm:py-24 flex flex-col items-center text-center animate-fade-in", children: [_jsx("div", { className: "w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 mb-6 shadow-inner", children: _jsx(CheckCircle2, { size: 44 }) }), _jsx("h2", { className: "text-2xl sm:text-3xl font-extrabold text-gray-900 leading-tight", children: "Claim Submitted Successfully" }), _jsx("p", { className: "text-gray-500 mt-3 text-sm sm:text-base max-w-md", children: "We have received your damage replacement request. Our team will review the photos and initiate a replacement or refund within 24\u201348 hours." }), _jsxs("div", { className: "mt-8 bg-gray-50 border border-gray-100 rounded-2xl p-5 w-full max-w-sm text-left", children: [_jsxs("div", { className: "flex justify-between text-sm py-1.5 border-b border-gray-200/50", children: [_jsx("span", { className: "text-gray-400", children: "Ticket Reference" }), _jsx("span", { className: "font-bold text-gray-800", children: success.ticketId })] }), _jsxs("div", { className: "flex justify-between text-sm py-1.5 border-b border-gray-200/50", children: [_jsx("span", { className: "text-gray-400", children: "Order ID" }), _jsxs("span", { className: "font-medium text-gray-700", children: ["#", success.orderId] })] }), _jsxs("div", { className: "flex justify-between text-sm py-1.5", children: [_jsx("span", { className: "text-gray-400 shrink-0 mr-3", children: "Items" }), _jsx("span", { className: "font-medium text-gray-700 text-right truncate max-w-[200px]", children: success.itemsSummary })] })] }), _jsxs("div", { className: "mt-10 flex flex-col sm:flex-row gap-3 w-full max-w-xs sm:max-w-md justify-center", children: [_jsx(Link, { to: "/damage-claims", className: "flex-1 py-3 px-6 bg-primary hover:bg-primary/95 text-white font-bold rounded-xl shadow-md hover:shadow-lg transition active:scale-[0.98] text-sm text-center", children: "Track My Claim" }), _jsx(Link, { to: "/products", className: "flex-1 py-3 px-6 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 font-bold rounded-xl shadow-sm transition active:scale-[0.98] text-sm text-center", children: "Continue Shopping" })] })] }));
    }
    // ---------------------------------------------------------------------------
    // Form
    // ---------------------------------------------------------------------------
    const isSubmitting = submitMutation.isPending;
    return (_jsxs("div", { className: "max-w-3xl mx-auto px-4 py-8 sm:py-12", children: [_jsxs(Link, { to: "/", className: "inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-gray-500 hover:text-primary transition mb-6", children: [_jsx(ArrowLeft, { size: 16 }), " Back to Home"] }), _jsxs("div", { className: "bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden", children: [_jsxs("div", { className: "bg-gradient-to-br from-[#1B4332] to-[#2D6A4F] text-white p-6 sm:p-10 relative", children: [_jsx("div", { className: "absolute right-6 top-1/2 -translate-y-1/2 opacity-[0.08] pointer-events-none select-none hidden sm:block", children: _jsx(ShieldCheck, { size: 160 }) }), _jsx("h1", { className: "text-2xl sm:text-3xl font-black tracking-tight leading-none", children: "Damage Replacement Form" }), _jsx("p", { className: "text-emerald-100/90 text-sm mt-3 leading-relaxed max-w-xl", children: "Did your plant arrive withered or did a ceramic pot break in transit? Select your order, upload photos, and our plant doctors will ship a replacement immediately." })] }), _jsxs("form", { onSubmit: handleSubmit, className: "p-6 sm:p-10 space-y-6 sm:space-y-8", children: [_jsxs("div", { children: [_jsx("label", { htmlFor: "order", className: "block text-xs sm:text-sm font-bold text-gray-700 mb-1.5", children: "Select Order *" }), ordersLoading ? (_jsxs("div", { className: "flex items-center gap-2 text-sm text-gray-400 py-3", children: [_jsx(Loader2, { size: 16, className: "animate-spin" }), " Loading your orders\u2026"] })) : !deliveredOrders?.length ? (_jsxs("div", { className: "text-sm text-gray-500 py-3 px-4 bg-gray-50 rounded-xl border border-gray-200", children: ["No eligible delivered orders found. Damage claims can only be submitted for delivered orders.", ' ', _jsx("button", { type: "button", onClick: () => navigate('/orders'), className: "text-primary font-semibold hover:underline", children: "View my orders" })] })) : (_jsxs("div", { className: "relative", children: [_jsxs("select", { id: "order", value: selectedOrder?.id ?? '', onChange: handleOrderSelect, className: `w-full px-4 py-3 text-sm border rounded-xl focus:outline-none focus:ring-1 appearance-none pr-10 ${errors.order
                                                    ? 'border-red-400 focus:ring-red-400'
                                                    : 'border-gray-200 focus:ring-primary-light'}`, children: [_jsx("option", { value: "", children: "Select a delivered order" }), deliveredOrders.map((order) => (_jsx("option", { value: order.id, children: orderSummaryLabel(order) }, order.id)))] }), _jsx(ChevronDown, { size: 16, className: "absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" })] })), errors.order && (_jsxs("p", { className: "text-xs text-red-500 mt-1 flex items-center gap-1", children: [_jsx(AlertCircle, { size: 12 }), " ", errors.order] }))] }), selectedOrder && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "bg-gray-50 border border-gray-100 rounded-xl p-4 text-sm space-y-1.5", children: [_jsx("p", { className: "text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-2", children: "Order Summary" }), selectedOrder.items.map((item) => (_jsxs("div", { className: "flex justify-between text-gray-700", children: [_jsxs("span", { className: "font-medium", children: [item.product_name ?? `Product #${item.product_id}`, item.selected_options && (_jsxs("span", { className: "font-normal text-gray-400 ml-1.5", children: ["(", Object.values(item.selected_options).join(', '), ")"] }))] }), _jsxs("span", { className: "text-gray-500 shrink-0 ml-3", children: ["\u00D7", item.quantity] })] }, item.id))), _jsxs("div", { className: "pt-1.5 border-t border-gray-200 flex justify-between text-gray-500", children: [_jsx("span", { children: "Total" }), _jsxs("span", { className: "font-semibold text-gray-800", children: ["\u20B9", selectedOrder.total_amount] })] })] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "issueType", className: "block text-xs sm:text-sm font-bold text-gray-700 mb-1.5", children: "What went wrong? *" }), _jsxs("div", { className: "relative", children: [_jsxs("select", { id: "issueType", value: issueType, onChange: (e) => {
                                                            setIssueType(e.target.value);
                                                            clearError('issueType');
                                                        }, className: `w-full px-4 py-3 text-sm border rounded-xl focus:outline-none focus:ring-1 appearance-none pr-10 ${errors.issueType
                                                            ? 'border-red-400 focus:ring-red-400'
                                                            : 'border-gray-200 focus:ring-primary-light'}`, children: [_jsx("option", { value: "", children: "Select the issue" }), ISSUE_TYPES.map((t) => (_jsx("option", { value: t.value, children: t.label }, t.value)))] }), _jsx(ChevronDown, { size: 16, className: "absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" })] }), errors.issueType && (_jsxs("p", { className: "text-xs text-red-500 mt-1 flex items-center gap-1", children: [_jsx(AlertCircle, { size: 12 }), " ", errors.issueType] }))] }), _jsxs("div", { children: [_jsx("label", { htmlFor: "description", className: "block text-xs sm:text-sm font-bold text-gray-700 mb-1.5", children: "Detailed Description *" }), _jsx("textarea", { id: "description", rows: 4, value: description, onChange: (e) => {
                                                    setDescription(e.target.value);
                                                    clearError('description');
                                                }, className: `w-full px-4 py-3 text-sm border rounded-xl focus:outline-none focus:ring-1 ${errors.description
                                                    ? 'border-red-400 focus:ring-red-400'
                                                    : 'border-gray-200 focus:ring-primary-light'}`, placeholder: "Please describe what parts are broken or explain the condition of the plant upon arrival." }), errors.description && (_jsxs("p", { className: "text-xs text-red-500 mt-1 flex items-center gap-1", children: [_jsx(AlertCircle, { size: 12 }), " ", errors.description] }))] }), _jsxs("div", { children: [_jsxs("span", { className: "block text-xs sm:text-sm font-bold text-gray-700 mb-1.5", children: ["Photo Proof of Damage * ", _jsx("span", { className: "font-normal text-gray-400", children: "(up to 5 photos)" })] }), photoPreviews.length > 0 && (_jsx("div", { className: "flex flex-wrap gap-3 mb-3", children: photoPreviews.map((src, i) => (_jsxs("div", { className: "relative group", children: [_jsx("img", { src: src, alt: `Damage photo ${i + 1}`, className: "h-24 w-24 object-cover rounded-xl border border-gray-200" }), _jsx("button", { type: "button", onClick: () => removePhoto(i), "aria-label": "Remove photo", className: "absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow", children: _jsx(X, { size: 11 }) })] }, i))) })), photoFiles.length < 5 && (_jsxs("div", { className: `relative flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-2xl transition cursor-pointer ${errors.photos
                                                    ? 'border-red-400 bg-red-50/10'
                                                    : 'border-gray-200 hover:bg-gray-50'}`, onClick: () => fileInputRef.current?.click(), onKeyDown: (e) => e.key === 'Enter' && fileInputRef.current?.click(), role: "button", tabIndex: 0, "aria-label": "Upload damage photos", children: [_jsx("input", { ref: fileInputRef, type: "file", accept: "image/jpeg,image/jpg,image/png,image/webp", multiple: true, onChange: handleFileChange, className: "hidden" }), _jsxs("div", { className: "flex flex-col items-center text-center gap-2", children: [_jsx("div", { className: "w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-primary mb-1", children: _jsx(Upload, { size: 20 }) }), _jsx("p", { className: "text-sm font-bold text-gray-700", children: photoPreviews.length > 0 ? 'Add more photos' : 'Upload Damage Photos' }), _jsxs("p", { className: "text-[11px] text-gray-400 max-w-xs", children: ["PNG, JPG, JPEG or WebP \u00B7 Max 5 MB each \u00B7 Up to ", 5 - photoFiles.length, " more"] })] })] })), errors.photos && (_jsxs("p", { className: "text-xs text-red-500 mt-1.5 flex items-center gap-1", children: [_jsx(AlertCircle, { size: 12 }), " ", errors.photos] }))] }), _jsxs("div", { className: "p-4 bg-emerald-50/60 border border-emerald-100 rounded-2xl flex gap-3 text-emerald-800", children: [_jsx(ShieldCheck, { size: 20, className: "shrink-0 mt-0.5" }), _jsxs("div", { className: "text-xs leading-normal", children: [_jsx("span", { className: "font-bold", children: "Plantoga thrive guarantee active." }), " All transit damages are 100% covered. We do not ask you to ship the damaged plants back!"] })] }), _jsx("button", { type: "submit", disabled: isSubmitting, className: "w-full py-3.5 bg-primary hover:bg-primary/95 text-white font-bold rounded-2xl transition active:scale-[0.98] shadow-md hover:shadow-lg disabled:opacity-50 text-sm sm:text-base flex items-center justify-center gap-2", children: isSubmitting ? (_jsxs(_Fragment, { children: [_jsx(Loader2, { size: 18, className: "animate-spin" }), _jsx("span", { children: "Submitting request\u2026" })] })) : (_jsx("span", { children: "Submit Replacement Request" })) })] })), !selectedOrder && !ordersLoading && !!deliveredOrders?.length && (_jsx("p", { className: "text-sm text-gray-400 text-center pb-2", children: "Select an order above to continue filling out the form." }))] })] })] }));
}
