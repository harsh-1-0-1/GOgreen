import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ShieldCheck, Image as ImageIcon, AlertCircle } from 'lucide-react';
import { useMyDamageClaims } from '@/hooks/useDamageClaims';
const STATUS_LABELS = {
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
function statusHint(status) {
    const hints = {
        submitted: 'Our team will begin reviewing your claim shortly.',
        under_review: 'We are reviewing the photos and details you submitted.',
        approved: 'Great news — your claim has been approved. Your replacement or refund is being arranged.',
        rejected: 'Unfortunately, your claim could not be approved. Check the notes for details.',
        replacement_shipped: 'Your replacement has been shipped. You will receive tracking details shortly.',
        refund_issued: 'Your refund has been processed. It may take 5–7 business days to reflect.',
        closed: 'This claim has been closed. Thank you for your patience.',
    };
    return hints[status] ?? 'Check the notes below for the latest update.';
}
function ClaimCard({ claim }) {
    const [open, setOpen] = useState(false);
    return (_jsxs("div", { className: "bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden", children: [_jsxs("button", { type: "button", onClick: () => setOpen((v) => !v), className: "w-full p-4 sm:p-5 text-left flex items-center justify-between gap-3 hover:bg-gray-50/60 transition-colors", children: [_jsxs("div", { className: "flex-1 min-w-0", children: [_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx("span", { className: "font-bold text-gray-900", children: claim.ticket_id }), _jsx("span", { className: `text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_COLORS[claim.status] || 'bg-gray-100'}`, children: STATUS_LABELS[claim.status] ?? claim.status })] }), _jsxs("p", { className: "text-xs text-gray-500 mt-1", children: ["Order #", claim.order_id, " \u00B7 ", issueLabel(claim.issue_type), " \u00B7", ' ', new Date(claim.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })] })] }), _jsx(ChevronDown, { size: 18, className: `text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}` })] }), open && (_jsxs("div", { className: "px-4 sm:px-5 pb-5 border-t border-gray-100 pt-4 space-y-4 animate-fade-in", children: [_jsx("p", { className: "text-sm text-gray-700 leading-relaxed", children: claim.description }), _jsxs("div", { className: "bg-emerald-50/60 border border-emerald-100 rounded-xl p-3 text-xs text-emerald-800 flex gap-2", children: [_jsx(ShieldCheck, { size: 16, className: "shrink-0 mt-0.5" }), _jsx("span", { children: statusHint(claim.status) })] }), claim.photo_urls.length > 0 && (_jsxs("div", { children: [_jsxs("p", { className: "text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1", children: [_jsx(ImageIcon, { size: 13 }), " Submitted Photos (", claim.photo_urls.length, ")"] }), _jsx("div", { className: "grid grid-cols-4 sm:grid-cols-6 gap-2", children: claim.photo_urls.map((src, i) => (_jsx("a", { href: src, target: "_blank", rel: "noreferrer", className: "block aspect-square rounded-lg overflow-hidden border border-gray-200 bg-gray-50 hover:opacity-85 transition", children: _jsx("img", { src: src, alt: `Damage photo ${i + 1}`, className: "w-full h-full object-cover" }) }, i))) })] })), claim.admin_notes && (_jsxs("div", { className: "bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs text-gray-700", children: [_jsx("p", { className: "font-bold text-gray-400 uppercase tracking-wide mb-1", children: "Staff Notes" }), _jsx("p", { className: "leading-relaxed whitespace-pre-wrap", children: claim.admin_notes })] })), _jsxs("p", { className: "text-[11px] text-gray-400", children: ["Last updated: ", new Date(claim.updated_at).toLocaleString()] })] }))] }));
}
export default function MyDamageClaimsPage() {
    const [page, setPage] = useState(1);
    const { data, isLoading } = useMyDamageClaims(page);
    return (_jsxs("div", { className: "max-w-3xl mx-auto px-4 py-8 sm:py-12", children: [_jsxs(Link, { to: "/", className: "inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-gray-500 hover:text-primary transition mb-6", children: [_jsx(ArrowLeft, { size: 16 }), " Back to Home"] }), _jsxs("div", { className: "mb-6", children: [_jsx("h1", { className: "text-2xl sm:text-3xl font-black tracking-tight text-gray-900", children: "My Damage Claims" }), _jsx("p", { className: "text-sm text-gray-500 mt-2", children: "Track the status of your replacement / refund requests." })] }), isLoading ? (_jsxs("div", { className: "space-y-3", children: [_jsx("div", { className: "h-24 bg-gray-100 rounded-2xl animate-pulse" }), _jsx("div", { className: "h-24 bg-gray-100 rounded-2xl animate-pulse" })] })) : data?.items?.length === 0 ? (_jsxs("div", { className: "bg-white rounded-2xl border border-gray-100 p-10 text-center space-y-3 shadow-sm", children: [_jsx("div", { className: "w-14 h-14 mx-auto rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600", children: _jsx(ShieldCheck, { size: 26 }) }), _jsx("h3", { className: "font-bold text-gray-900", children: "No damage claims yet" }), _jsx("p", { className: "text-sm text-gray-500 max-w-sm mx-auto", children: "If any plant or pot arrives damaged, submit a claim with photos within 48 hours and we'll make it right." }), _jsxs(Link, { to: "/damage-replacement", className: "inline-flex items-center gap-2 mt-2 px-5 py-2.5 bg-primary hover:bg-primary/95 text-white font-bold rounded-xl shadow-md transition text-sm", children: [_jsx(ShieldCheck, { size: 16 }), " File a Damage Claim"] })] })) : (_jsxs(_Fragment, { children: [_jsx("div", { className: "space-y-3", children: data?.items?.map((claim) => _jsx(ClaimCard, { claim: claim }, claim.id)) }), data && data.pages > 1 && (_jsxs("div", { className: "flex items-center justify-center gap-2 pt-6", children: [_jsx("button", { disabled: page <= 1, onClick: () => setPage(page - 1), className: "px-3 py-1.5 border bg-white rounded-lg text-xs font-semibold disabled:opacity-30", children: "Prev" }), _jsxs("span", { className: "text-xs text-gray-500 font-medium", children: ["Page ", page, " of ", data.pages] }), _jsx("button", { disabled: page >= data.pages, onClick: () => setPage(page + 1), className: "px-3 py-1.5 border bg-white rounded-lg text-xs font-semibold disabled:opacity-30", children: "Next" })] }))] })), _jsxs("p", { className: "flex items-center gap-1.5 text-[11px] text-gray-400 mt-8 justify-center", children: [_jsx(AlertCircle, { size: 12 }), " Expect a response within 24\u201348 hours of submitting your claim."] })] }));
}
