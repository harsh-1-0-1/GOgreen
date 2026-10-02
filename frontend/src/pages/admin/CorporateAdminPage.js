import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { Phone, Mail, Building, FileText, X, Info, User, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCorporateInquiries, useDeleteCorporateInquiry, useUpdateCorporateInquiryStatus, } from '@/hooks/useCorporateInquiries';
const STATUS_LABELS = {
    new: '📥 New Inquiry',
    review: '🔍 Under Review',
    quoted: '📄 Quotation Sent',
    approved: '✅ Approved & Booked',
    cancelled: '❌ Cancelled',
};
const STATUSES = [
    '',
    'new',
    'review',
    'quoted',
    'approved',
    'cancelled',
];
const STATUS_COLORS = {
    new: 'bg-blue-50 text-blue-800 border-blue-200',
    review: 'bg-amber-50 text-amber-800 border-amber-200',
    quoted: 'bg-purple-50 text-purple-800 border-purple-200',
    approved: 'bg-green-50 text-green-800 border-green-200',
    cancelled: 'bg-red-50 text-red-800 border-red-200',
};
function QtyCell({ qty }) {
    if (qty === null || qty === undefined) {
        return _jsx("span", { className: "text-gray-400 font-medium", children: "Not specified" });
    }
    return _jsxs("span", { className: "text-gray-950 font-bold", children: [qty, " units"] });
}
function DuplicateBadge() {
    return (_jsx("span", { className: "text-[10px] font-bold px-2 py-0.5 rounded-full border border-purple-200 text-purple-700", children: "Repeat submitter" }));
}
export default function CorporateAdminPage() {
    const [statusFilter, setStatusFilter] = useState('');
    const [page, setPage] = useState(1);
    const [selectedInquiry, setSelectedInquiry] = useState(null);
    const { data, isLoading } = useCorporateInquiries(statusFilter || undefined, page);
    const updateMutation = useUpdateCorporateInquiryStatus();
    const deleteMutation = useDeleteCorporateInquiry();
    const handleStatusChange = (id, newStatus) => {
        updateMutation.mutate({ id, status: newStatus }, {
            onSuccess: (updated) => {
                toast.success(`Inquiry ${updated.ticket_id} updated to ${newStatus.toUpperCase()}`);
                if (selectedInquiry?.id === id) {
                    setSelectedInquiry((prev) => (prev ? { ...prev, status: updated.status } : prev));
                }
            },
            onError: (err) => {
                const status = err?.response?.status;
                const message = status === 400
                    ? 'That status change is not allowed at this stage.'
                    : 'Could not update the inquiry status. Please try again.';
                toast.error(message);
            },
        });
    };
    const handleDelete = (inquiry) => {
        if (!window.confirm(`Delete inquiry ${inquiry.ticket_id} (${inquiry.full_name})? This cannot be undone.`)) {
            return;
        }
        deleteMutation.mutate(inquiry.id, {
            onSuccess: () => {
                toast.success(`${inquiry.ticket_id} deleted`);
                if (selectedInquiry?.id === inquiry.id)
                    setSelectedInquiry(null);
            },
            onError: () => {
                toast.error('Could not delete the inquiry. Please try again.');
            },
        });
    };
    const inquiries = data?.items ?? [];
    return (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-xl sm:text-2xl font-bold text-gray-900", children: "Corporate & Bulk Inquiries" }), _jsx("p", { className: "text-xs text-gray-500 mt-0.5", children: "Manage large order requests from corporate clients for employee onboarding, festivals, and desk plants." })] }), _jsxs("div", { className: "bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex gap-3 shadow-sm", children: [_jsx("div", { className: "bg-primary/10 w-9 h-9 rounded-lg flex items-center justify-center text-primary shrink-0", children: _jsx(Info, { size: 18 }) }), _jsxs("div", { className: "text-xs text-gray-600 leading-normal", children: [_jsx("p", { className: "font-bold text-primary", children: "How do clients submit these?" }), _jsx("p", { className: "mt-0.5", children: "Customers fill out the corporate gifting form on `/corporate-gifting`. Submissions appear here instantly and are also emailed/WhatsApped to you. A \"Repeat submitter\" badge just means they've inquired multiple times \u2014 review context before acting." })] })] }), _jsx("div", { className: "flex gap-2 overflow-x-auto scrollbar-hide pb-1", children: STATUSES.map((s) => (_jsx("button", { onClick: () => { setStatusFilter(s); setPage(1); }, className: `px-4 py-2 text-xs font-semibold rounded-full border whitespace-nowrap transition ${statusFilter === s
                        ? 'bg-primary text-white border-primary'
                        : 'bg-white hover:border-gray-300 text-gray-600'}`, children: s === '' ? 'All' : STATUS_LABELS[s] }, s))) }), isLoading ? (_jsx("div", { className: "bg-white rounded-xl border shadow-sm p-8 text-center text-sm text-gray-500", children: "Loading inquiries\u2026" })) : inquiries.length === 0 ? (_jsx("div", { className: "bg-white rounded-xl border shadow-sm p-8 text-center text-sm text-gray-500", children: "No inquiries found." })) : (_jsx("div", { className: "hidden sm:block bg-white rounded-xl border shadow-sm overflow-hidden", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "text-left text-gray-500 border-b bg-gray-50", children: [_jsx("th", { className: "px-5 py-3.5 font-semibold text-xs", children: "Ticket" }), _jsx("th", { className: "px-5 py-3.5 font-semibold text-xs", children: "Customer Name" }), _jsx("th", { className: "px-5 py-3.5 font-semibold text-xs", children: "Company Name" }), _jsx("th", { className: "px-5 py-3.5 font-semibold text-xs", children: "Qty Requested" }), _jsx("th", { className: "px-5 py-3.5 font-semibold text-xs", children: "Current Stage" }), _jsx("th", { className: "px-5 py-3.5 font-semibold text-xs", children: "Submitted On" })] }) }), _jsx("tbody", { children: inquiries.map((inq) => (_jsxs("tr", { onClick: () => setSelectedInquiry(inq), className: "border-b last:border-0 hover:bg-gray-50/50 cursor-pointer transition-colors", children: [_jsx("td", { className: "px-5 py-4 text-gray-400 font-semibold", children: inq.ticket_id }), _jsxs("td", { className: "px-5 py-4 font-semibold text-gray-900", children: [inq.full_name, inq.is_duplicate && _jsx("span", { className: "ml-2 inline-flex", children: _jsx(DuplicateBadge, {}) })] }), _jsx("td", { className: "px-5 py-4 text-gray-700 font-medium", children: inq.company_name }), _jsx("td", { className: "px-5 py-4", children: _jsx(QtyCell, { qty: inq.qty_requested }) }), _jsx("td", { className: "px-5 py-4", children: _jsx("span", { className: `text-[10px] font-bold px-2.5 py-1 rounded-full border capitalize ${STATUS_COLORS[inq.status]}`, children: STATUS_LABELS[inq.status] }) }), _jsx("td", { className: "px-5 py-4 text-gray-400 text-xs", children: new Date(inq.created_at).toLocaleDateString() })] }, inq.id))) })] }) })), !isLoading && inquiries.length > 0 && (_jsx("div", { className: "sm:hidden space-y-3", children: inquiries.map((inq) => (_jsxs("div", { onClick: () => setSelectedInquiry(inq), className: "bg-white rounded-xl border shadow-sm p-4 cursor-pointer", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "text-xs font-bold text-gray-400", children: inq.ticket_id }), _jsx("span", { className: `text-[10px] font-bold px-2.5 py-1 rounded-full border capitalize ${STATUS_COLORS[inq.status]}`, children: STATUS_LABELS[inq.status] })] }), _jsx("p", { className: "mt-2 font-bold text-gray-900", children: inq.full_name }), _jsx("p", { className: "text-xs text-gray-600", children: inq.company_name }), _jsxs("div", { className: "mt-2 pt-2 border-t flex justify-between text-xs text-gray-500", children: [_jsx("span", { children: _jsx(QtyCell, { qty: inq.qty_requested }) }), _jsx("span", { children: new Date(inq.created_at).toLocaleDateString() })] }), inq.is_duplicate && (_jsx("div", { className: "mt-2", children: _jsx(DuplicateBadge, {}) }))] }, inq.id))) })), data && data.pages > 1 && (_jsxs("div", { className: "flex items-center justify-center gap-2 pt-1", children: [_jsx("button", { onClick: () => setPage((p) => Math.max(1, p - 1)), disabled: page <= 1, className: "px-3 py-1.5 text-xs font-semibold border rounded-lg bg-white disabled:opacity-40", children: "Prev" }), _jsxs("span", { className: "text-xs text-gray-500", children: ["Page ", page, " of ", data.pages] }), _jsx("button", { onClick: () => setPage((p) => Math.min(data.pages, p + 1)), disabled: page >= data.pages, className: "px-3 py-1.5 text-xs font-semibold border rounded-lg bg-white disabled:opacity-40", children: "Next" })] })), selectedInquiry && (_jsxs(_Fragment, { children: [_jsx("div", { className: "fixed inset-0 bg-black/55 z-50 transition-opacity", onClick: () => setSelectedInquiry(null) }), _jsxs("div", { className: "fixed inset-0 sm:inset-auto sm:top-0 sm:right-0 sm:h-full sm:w-full sm:max-w-md bg-[#FAFAF8] z-50 sm:shadow-2xl flex flex-col overflow-hidden", children: [_jsxs("div", { className: "flex items-center justify-between p-4 sm:p-5 border-b bg-white shrink-0", children: [_jsxs("div", { children: [_jsx("h3", { className: "font-bold text-lg text-gray-900", children: "Inquiry Details" }), _jsx("p", { className: "text-xs text-gray-500 mt-0.5", children: selectedInquiry.ticket_id })] }), _jsx("button", { onClick: () => setSelectedInquiry(null), className: "p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors", children: _jsx(X, { size: 20 }) })] }), _jsxs("div", { className: "flex-1 overflow-y-auto p-4 sm:p-5 space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: `text-[10px] font-bold px-2.5 py-1 rounded-full border capitalize ${STATUS_COLORS[selectedInquiry.status]}`, children: STATUS_LABELS[selectedInquiry.status] }), selectedInquiry.is_duplicate && _jsx(DuplicateBadge, {})] }), _jsxs("div", { className: "bg-white p-4 rounded-xl border border-gray-200 space-y-2", children: [_jsx("span", { className: "text-[10px] font-bold text-gray-400 uppercase block mb-1", children: "Company Contact" }), _jsxs("p", { className: "text-base font-bold text-gray-900 flex items-center gap-1.5", children: [_jsx(Building, { size: 16, className: "text-gray-400" }), " ", selectedInquiry.company_name] }), _jsxs("p", { className: "text-sm font-semibold text-gray-700 flex items-center gap-1.5", children: [_jsx(User, { size: 15, className: "text-gray-400" }), " ", selectedInquiry.full_name] }), _jsxs("div", { className: "grid grid-cols-2 gap-2 pt-2 border-t text-xs text-gray-600", children: [_jsxs("a", { href: `tel:${selectedInquiry.phone}`, className: "flex items-center gap-1 hover:text-primary", children: [_jsx(Phone, { size: 13 }), " ", selectedInquiry.phone] }), _jsxs("a", { href: `mailto:${selectedInquiry.email}`, className: "flex items-center gap-1 hover:text-primary truncate", children: [_jsx(Mail, { size: 13 }), " ", selectedInquiry.email] })] })] }), _jsxs("div", { className: "bg-white p-4 rounded-xl border border-gray-200 space-y-2", children: [_jsx("span", { className: "text-[10px] font-bold text-gray-400 uppercase block", children: "Requirements" }), _jsxs("p", { className: "text-xs text-gray-800 font-bold", children: ["Volume Requested: ", _jsx(QtyCell, { qty: selectedInquiry.qty_requested })] }), selectedInquiry.customization_notes ? (_jsxs("div", { className: "bg-gray-50 p-3 rounded-lg border text-xs text-gray-600 leading-normal flex gap-1.5", children: [_jsx(FileText, { size: 16, className: "shrink-0 text-gray-400 mt-0.5" }), _jsxs("p", { className: "italic", children: ["\"", selectedInquiry.customization_notes, "\""] })] })) : (_jsx("p", { className: "text-xs text-gray-400 italic", children: "No customisation notes." }))] }), _jsxs("div", { className: "bg-white p-4 rounded-xl border border-gray-200 space-y-3", children: [_jsx("span", { className: "text-[10px] font-bold text-gray-400 uppercase block", children: "Change Deal Stage" }), _jsx("div", { className: "grid grid-cols-1 gap-2", children: Object.entries(STATUS_LABELS).map(([key, label]) => (_jsxs("button", { onClick: () => handleStatusChange(selectedInquiry.id, key), disabled: updateMutation.isPending || selectedInquiry.status === key, className: `w-full py-2 px-3 border rounded-xl text-xs font-semibold text-left transition flex items-center justify-between disabled:opacity-60 ${selectedInquiry.status === key
                                                        ? 'bg-primary text-white border-primary shadow-sm'
                                                        : 'bg-white hover:bg-gray-50 text-gray-700'}`, children: [_jsx("span", { children: label }), selectedInquiry.status === key && _jsx("span", { children: "\u2713" })] }, key))) })] }), _jsxs("button", { onClick: () => handleDelete(selectedInquiry), disabled: deleteMutation.isPending, className: "w-full py-2 px-3 border border-red-200 text-red-600 rounded-xl text-xs font-semibold bg-white hover:bg-red-50 transition flex items-center justify-center gap-1.5 disabled:opacity-60", children: [_jsx(Trash2, { size: 14 }), deleteMutation.isPending ? 'Deleting…' : 'Delete Inquiry'] })] })] })] }))] }));
}
