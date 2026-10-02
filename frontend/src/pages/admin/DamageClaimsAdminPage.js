import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { X, Image as ImageIcon, User, ShoppingBag, MessageSquare, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAdminDamageClaims, useAdminDamageClaim, useUpdateDamageClaimStatus, } from '@/hooks/useDamageClaims';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
const STATUSES = [
    '',
    'submitted',
    'under_review',
    'approved',
    'rejected',
    'replacement_shipped',
    'refund_issued',
    'closed',
];
const STATUS_LABELS = {
    '': 'All Claims',
    submitted: 'Submitted',
    under_review: 'Under Review',
    approved: 'Approved',
    rejected: 'Rejected',
    replacement_shipped: 'Replacement Shipped',
    refund_issued: 'Refund Issued',
    closed: 'Closed',
};
const STATUS_COLORS = {
    submitted: 'bg-amber-100 text-amber-800 border-amber-200',
    under_review: 'bg-sky-100 text-sky-800 border-sky-200',
    approved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    rejected: 'bg-red-100 text-red-800 border-red-200',
    replacement_shipped: 'bg-purple-100 text-purple-800 border-purple-200',
    refund_issued: 'bg-blue-100 text-blue-800 border-blue-200',
    closed: 'bg-gray-100 text-gray-700 border-gray-200',
};
const ISSUE_LABELS = {
    broken_pot: 'Broken Pot / Planter',
    damaged_plant: 'Broken Stems / Leaves (Transit)',
    withered_plant: 'Withered / Dead Plant',
    wrong_item: 'Incorrect Product Delivered',
    missing_item: 'Missing Items',
};
function issueLabel(issueType) {
    return ISSUE_LABELS[issueType] ?? issueType.replace(/_/g, ' ');
}
function ClaimDrawer({ claim, onClose }) {
    const { data: full, isLoading } = useAdminDamageClaim(claim.id);
    const mutation = useUpdateDamageClaimStatus();
    const [newStatus, setNewStatus] = useState(claim.status);
    const [adminNotes, setAdminNotes] = useState(claim.admin_notes ?? '');
    useBodyScrollLock(true);
    const c = full ?? claim;
    const customerName = c.user?.full_name || c.order?.address?.full_name || `Customer #${c.user_id}`;
    const customerPhone = c.order?.address?.phone || c.user?.phone || 'Not provided';
    const customerEmail = c.user?.email || c.order?.user?.email || 'Not provided';
    async function handleUpdate() {
        try {
            await mutation.mutateAsync({
                id: c.id,
                status: newStatus,
                admin_notes: adminNotes.trim() || undefined,
            });
            toast.success('Claim updated successfully!');
            onClose();
        }
        catch {
            toast.error('Failed to update claim. Please try again.');
        }
    }
    return (_jsxs(_Fragment, { children: [_jsx("div", { className: "fixed inset-0 bg-black/55 z-50 transition-opacity", onClick: onClose }), _jsxs("div", { className: "fixed inset-0 sm:inset-auto sm:top-0 sm:right-0 sm:h-full sm:w-full sm:max-w-lg bg-[#FAFAF8] z-50 sm:shadow-2xl flex flex-col overflow-hidden", children: [_jsxs("div", { className: "flex items-center justify-between p-4 sm:p-5 border-b bg-white shrink-0", children: [_jsxs("div", { children: [_jsx("h3", { className: "font-bold text-lg text-gray-900", children: "Damage Claim Review" }), _jsxs("p", { className: "text-xs text-gray-500 mt-0.5", children: ["Reference ID: ", c.ticket_id] })] }), _jsx("button", { onClick: onClose, className: "p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors", children: _jsx(X, { size: 20 }) })] }), isLoading ? (_jsx("div", { className: "flex-1 flex items-center justify-center text-gray-400 text-sm py-20", children: "Loading claim details..." })) : (_jsxs("div", { className: "flex-1 overflow-y-auto p-4 sm:p-5 space-y-5", children: [_jsxs("div", { className: "grid grid-cols-2 gap-3 text-sm", children: [_jsxs("div", { className: "bg-white p-3 rounded-xl border border-gray-100", children: [_jsx("span", { className: "text-gray-400 block text-[10px] font-bold uppercase", children: "Current Status" }), _jsx("span", { className: `inline-block mt-1 text-xs font-semibold px-2 py-0.5 rounded-full capitalize border ${STATUS_COLORS[c.status] || 'bg-gray-100'}`, children: STATUS_LABELS[c.status] })] }), _jsxs("div", { className: "bg-white p-3 rounded-xl border border-gray-100", children: [_jsx("span", { className: "text-gray-400 block text-[10px] font-bold uppercase", children: "Order ID" }), _jsxs("p", { className: "font-bold text-base text-primary mt-0.5", children: ["#", c.order_id] })] }), _jsxs("div", { className: "bg-white p-3 rounded-xl border border-gray-100", children: [_jsx("span", { className: "text-gray-400 block text-[10px] font-bold uppercase", children: "Issue Type" }), _jsx("p", { className: "font-medium text-gray-700 mt-0.5", children: issueLabel(c.issue_type) })] }), _jsxs("div", { className: "bg-white p-3 rounded-xl border border-gray-100", children: [_jsx("span", { className: "text-gray-400 block text-[10px] font-bold uppercase", children: "Submitted On" }), _jsx("p", { className: "font-medium text-gray-700 mt-0.5", children: new Date(c.created_at).toLocaleString() })] })] }), _jsxs("div", { className: "bg-white p-4 rounded-xl border border-gray-200 space-y-3", children: [_jsxs("div", { className: "flex items-center gap-2 text-xs font-bold text-gray-400 uppercase pb-2 border-b", children: [_jsx(User, { size: 14 }), _jsx("span", { children: "Customer Information" })] }), _jsxs("div", { className: "text-xs space-y-1 text-gray-700", children: [_jsx("p", { className: "font-bold text-sm text-gray-900", children: customerName }), _jsxs("p", { className: "text-gray-500", children: ["Phone: ", customerPhone] }), _jsxs("p", { className: "text-gray-500", children: ["Email: ", customerEmail] })] })] }), _jsxs("div", { className: "bg-white p-4 rounded-xl border border-gray-200", children: [_jsxs("div", { className: "flex items-center gap-2 text-xs font-bold text-gray-400 uppercase pb-2 border-b mb-2", children: [_jsx(MessageSquare, { size: 14 }), _jsx("span", { children: "Customer Description" })] }), _jsx("p", { className: "text-sm text-gray-700 leading-relaxed whitespace-pre-wrap", children: c.description })] }), _jsxs("div", { className: "bg-white p-4 rounded-xl border border-gray-200", children: [_jsxs("div", { className: "flex items-center gap-2 text-xs font-bold text-gray-400 uppercase pb-2 border-b mb-2", children: [_jsx(ImageIcon, { size: 14 }), _jsxs("span", { children: ["Proof Photos (", c.photo_urls.length, ")"] })] }), c.photo_urls.length === 0 ? (_jsx("p", { className: "text-xs text-gray-400 py-2", children: "No photos uploaded." })) : (_jsx("div", { className: "grid grid-cols-3 gap-2", children: c.photo_urls.map((src, i) => (_jsx("a", { href: src, target: "_blank", rel: "noreferrer", className: "block aspect-square rounded-lg overflow-hidden border border-gray-200 bg-gray-50 hover:opacity-85 transition", children: _jsx("img", { src: src, alt: `Claim photo ${i + 1}`, className: "w-full h-full object-cover" }) }, i))) }))] }), c.order && (_jsxs("div", { className: "bg-white p-4 rounded-xl border border-gray-200", children: [_jsxs("div", { className: "flex items-center gap-2 text-xs font-bold text-gray-400 uppercase pb-2 border-b mb-2", children: [_jsx(ShoppingBag, { size: 14 }), _jsxs("span", { children: ["Order #", c.order.id, " Items (", c.order.items.length, ")"] })] }), _jsx("div", { className: "divide-y", children: c.order.items.map((item) => (_jsxs("div", { className: "py-2.5 flex justify-between items-center text-xs gap-3", children: [_jsxs("div", { children: [_jsx("span", { className: "font-semibold text-gray-800", children: item.product_name || `Product #${item.product_id}` }), _jsx("p", { className: "text-[10px] text-gray-400", children: item.selected_options
                                                                ? Object.values(item.selected_options).join(', ')
                                                                : '' })] }), _jsxs("span", { className: "font-bold text-gray-900 shrink-0", children: ["\u20B9", item.unit_price, " \u00D7 ", item.quantity] })] }, item.id))) })] })), c.admin_notes && (_jsxs("div", { className: "bg-white p-4 rounded-xl border border-gray-200", children: [_jsxs("div", { className: "flex items-center gap-2 text-xs font-bold text-gray-400 uppercase pb-2 border-b mb-2", children: [_jsx(ShieldAlert, { size: 14 }), _jsx("span", { children: "Admin Notes (Existing)" })] }), _jsx("p", { className: "text-sm text-gray-700 leading-relaxed whitespace-pre-wrap", children: c.admin_notes })] })), _jsxs("div", { className: "bg-white p-4 rounded-xl border border-gray-200 space-y-3", children: [_jsxs("div", { className: "flex items-center gap-2 text-xs font-bold text-gray-400 uppercase pb-2 border-b", children: [_jsx(ShieldAlert, { size: 14 }), _jsx("span", { children: "Update Claim Status" })] }), _jsxs("div", { className: "space-y-1", children: [_jsx("label", { className: "text-xs font-semibold text-gray-700", children: "Choose Status" }), _jsx("select", { value: newStatus, onChange: (e) => setNewStatus(e.target.value), className: "w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary", children: STATUSES.filter(Boolean).map((s) => (_jsx("option", { value: s, children: STATUS_LABELS[s] }, s))) })] }), _jsxs("div", { className: "space-y-1", children: [_jsx("label", { className: "text-xs font-semibold text-gray-700", children: "Admin Notes (visible to customer)" }), _jsx("textarea", { value: adminNotes, onChange: (e) => setAdminNotes(e.target.value), rows: 3, placeholder: "Add a note for the customer, e.g. reason for decision or next steps\u2026", className: "w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary resize-none" })] }), _jsx("button", { onClick: handleUpdate, disabled: mutation.isPending || (newStatus === c.status && adminNotes.trim() === (c.admin_notes ?? '')), className: "w-full py-2.5 bg-primary text-white rounded-xl text-xs font-semibold hover:bg-primary/95 disabled:opacity-60 transition", children: mutation.isPending ? 'Saving changes...' : 'Apply Status Change' })] })] }))] })] }));
}
export default function DamageClaimsAdminPage() {
    const [statusFilter, setStatusFilter] = useState('');
    const [page, setPage] = useState(1);
    const [selectedClaim, setSelectedClaim] = useState(null);
    const { data, isLoading } = useAdminDamageClaims(statusFilter || undefined, page);
    return (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-xl sm:text-2xl font-bold text-gray-900", children: "Damage Claims Desk" }), _jsx("p", { className: "text-xs text-gray-500 mt-0.5", children: "Review transit-damage reports, inspect proof photos, and resolve replacement/refund requests." })] }), _jsx("div", { className: "flex gap-2 overflow-x-auto scrollbar-hide pb-1", children: STATUSES.map((s) => (_jsx("button", { onClick: () => { setStatusFilter(s); setPage(1); }, className: `px-4 py-2 text-xs font-semibold rounded-full border whitespace-nowrap transition ${statusFilter === s
                        ? 'bg-primary text-white border-primary'
                        : 'bg-white hover:border-gray-300 text-gray-600'}`, children: STATUS_LABELS[s] }, s))) }), _jsx("div", { className: "hidden sm:block bg-white rounded-xl border overflow-x-auto shadow-sm", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-left text-gray-500 border-b bg-gray-50", children: [_jsx("th", { className: "px-5 py-3.5 font-semibold text-xs", children: "Ticket" }), _jsx("th", { className: "px-5 py-3.5 font-semibold text-xs", children: "Customer" }), _jsx("th", { className: "px-5 py-3.5 font-semibold text-xs", children: "Order" }), _jsx("th", { className: "px-5 py-3.5 font-semibold text-xs", children: "Issue Type" }), _jsx("th", { className: "px-5 py-3.5 font-semibold text-xs", children: "Photos" }), _jsx("th", { className: "px-5 py-3.5 font-semibold text-xs", children: "Status" }), _jsx("th", { className: "px-5 py-3.5 font-semibold text-xs", children: "Submitted On" })] }) }), _jsx("tbody", { children: isLoading ? (_jsx("tr", { children: _jsx("td", { colSpan: 7, className: "px-5 py-12 text-center text-gray-400", children: "Loading damage claims..." }) })) : data?.items?.length === 0 ? (_jsx("tr", { children: _jsx("td", { colSpan: 7, className: "px-5 py-12 text-center text-gray-400", children: "No damage claims found under this filter." }) })) : (data?.items?.map((c) => (_jsxs("tr", { className: "border-b last:border-0 hover:bg-gray-50 cursor-pointer transition-colors", onClick: () => setSelectedClaim(c), children: [_jsx("td", { className: "px-5 py-3.5 font-semibold text-gray-900", children: c.ticket_id }), _jsxs("td", { className: "px-5 py-3.5", children: [_jsx("span", { className: "font-semibold text-gray-800", children: c.user?.full_name || c.order?.address?.full_name || `Customer #${c.user_id}` }), c.user?.email && _jsx("p", { className: "text-[10px] text-gray-400 mt-0.5", children: c.user.email })] }), _jsxs("td", { className: "px-5 py-3.5 text-gray-700", children: ["#", c.order_id] }), _jsx("td", { className: "px-5 py-3.5 text-gray-700", children: issueLabel(c.issue_type) }), _jsx("td", { className: "px-5 py-3.5 text-gray-500", children: c.photo_urls.length }), _jsx("td", { className: "px-5 py-3.5", children: _jsx("span", { className: `text-[10px] font-bold px-2.5 py-1 rounded-full border capitalize ${STATUS_COLORS[c.status] || 'bg-gray-100'}`, children: STATUS_LABELS[c.status] }) }), _jsx("td", { className: "px-5 py-3.5 text-gray-400 text-xs", children: new Date(c.created_at).toLocaleDateString() })] }, c.id)))) })] }) }), _jsx("div", { className: "sm:hidden space-y-2", children: isLoading ? (_jsx("p", { className: "text-center text-gray-400 py-8 text-sm", children: "Loading damage claims..." })) : data?.items?.length === 0 ? (_jsx("p", { className: "text-center text-gray-400 py-8 text-sm", children: "No damage claims found." })) : (data?.items?.map((c) => (_jsxs("button", { onClick: () => setSelectedClaim(c), className: "w-full bg-white rounded-xl border p-3 text-left active:scale-[0.99] transition-transform shadow-sm", children: [_jsxs("div", { className: "flex items-start justify-between mb-1.5", children: [_jsxs("div", { children: [_jsx("span", { className: "text-sm font-semibold text-gray-900", children: c.ticket_id }), _jsx("p", { className: "text-xs text-gray-700 font-medium mt-0.5", children: c.user?.full_name || c.order?.address?.full_name || `Customer #${c.user_id}` })] }), _jsx("span", { className: `text-[9px] font-bold px-2 py-0.5 rounded border capitalize ${STATUS_COLORS[c.status] || 'bg-gray-100'}`, children: STATUS_LABELS[c.status] })] }), _jsxs("div", { className: "flex items-end justify-between mt-2 pt-2 border-t border-gray-100", children: [_jsxs("p", { className: "text-[10px] text-gray-400", children: ["Order #", c.order_id, " \u00B7 ", c.photo_urls.length, " photo(s)"] }), _jsx("p", { className: "text-[10px] font-semibold text-primary", children: issueLabel(c.issue_type) })] })] }, c.id)))) }), data && data.pages > 1 && (_jsxs("div", { className: "flex items-center justify-center gap-2 pt-2", children: [_jsx("button", { disabled: page <= 1, onClick: () => setPage(page - 1), className: "px-3 py-1.5 border bg-white rounded-lg text-xs font-semibold disabled:opacity-30", children: "Prev" }), _jsxs("span", { className: "text-xs text-gray-500 font-medium", children: ["Page ", page, " of ", data.pages] }), _jsx("button", { disabled: page >= data.pages, onClick: () => setPage(page + 1), className: "px-3 py-1.5 border bg-white rounded-lg text-xs font-semibold disabled:opacity-30", children: "Next" })] })), selectedClaim && _jsx(ClaimDrawer, { claim: selectedClaim, onClose: () => setSelectedClaim(null) })] }));
}
