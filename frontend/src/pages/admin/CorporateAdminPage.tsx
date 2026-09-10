import { useState } from 'react';
import { Phone, Mail, Building, FileText, X, Info, User, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  useCorporateInquiries,
  useDeleteCorporateInquiry,
  useUpdateCorporateInquiryStatus,
} from '@/hooks/useCorporateInquiries';
import type { CorporateInquiry, CorporateInquiryStatus } from '@/types';

const STATUS_LABELS: Record<string, string> = {
  new: '📥 New Inquiry',
  review: '🔍 Under Review',
  quoted: '📄 Quotation Sent',
  approved: '✅ Approved & Booked',
  cancelled: '❌ Cancelled',
};

const STATUSES: ('' | CorporateInquiryStatus)[] = [
  '',
  'new',
  'review',
  'quoted',
  'approved',
  'cancelled',
];

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-50 text-blue-800 border-blue-200',
  review: 'bg-amber-50 text-amber-800 border-amber-200',
  quoted: 'bg-purple-50 text-purple-800 border-purple-200',
  approved: 'bg-green-50 text-green-800 border-green-200',
  cancelled: 'bg-red-50 text-red-800 border-red-200',
};

function QtyCell({ qty }: { qty: number | null }) {
  if (qty === null || qty === undefined) {
    return <span className="text-gray-400 font-medium">Not specified</span>;
  }
  return <span className="text-gray-950 font-bold">{qty} units</span>;
}

function DuplicateBadge() {
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-purple-200 text-purple-700">
      Repeat submitter
    </span>
  );
}

export default function CorporateAdminPage() {
  const [statusFilter, setStatusFilter] = useState<'' | CorporateInquiryStatus>('');
  const [page, setPage] = useState(1);
  const [selectedInquiry, setSelectedInquiry] = useState<CorporateInquiry | null>(null);

  const { data, isLoading } = useCorporateInquiries(statusFilter || undefined, page);
  const updateMutation = useUpdateCorporateInquiryStatus();
  const deleteMutation = useDeleteCorporateInquiry();

  const handleStatusChange = (id: number, newStatus: CorporateInquiryStatus) => {
    updateMutation.mutate(
      { id, status: newStatus },
      {
        onSuccess: (updated) => {
          toast.success(`Inquiry ${updated.ticket_id} updated to ${newStatus.toUpperCase()}`);
          if (selectedInquiry?.id === id) {
            setSelectedInquiry((prev) => (prev ? { ...prev, status: updated.status } : prev));
          }
        },
        onError: (err: unknown) => {
          const status = (err as { response?: { status?: number } })?.response?.status;
          const message =
            status === 400
              ? 'That status change is not allowed at this stage.'
              : 'Could not update the inquiry status. Please try again.';
          toast.error(message);
        },
      },
    );
  };

  const handleDelete = (inquiry: CorporateInquiry) => {
    if (!window.confirm(`Delete inquiry ${inquiry.ticket_id} (${inquiry.full_name})? This cannot be undone.`)) {
      return;
    }
    deleteMutation.mutate(inquiry.id, {
      onSuccess: () => {
        toast.success(`${inquiry.ticket_id} deleted`);
        if (selectedInquiry?.id === inquiry.id) setSelectedInquiry(null);
      },
      onError: () => {
        toast.error('Could not delete the inquiry. Please try again.');
      },
    });
  };

  const inquiries = data?.items ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Corporate & Bulk Inquiries</h1>
        <p className="text-xs text-gray-500 mt-0.5">Manage large order requests from corporate clients for employee onboarding, festivals, and desk plants.</p>
      </div>

      {/* Info strip */}
      <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 flex gap-3 shadow-sm">
        <div className="bg-primary/10 w-9 h-9 rounded-lg flex items-center justify-center text-primary shrink-0">
          <Info size={18} />
        </div>
        <div className="text-xs text-gray-600 leading-normal">
          <p className="font-bold text-primary">How do clients submit these?</p>
          <p className="mt-0.5">Customers fill out the corporate gifting form on `/corporate-gifting`. Submissions appear here instantly and are also emailed/WhatsApped to you. A "Repeat submitter" badge just means they've inquired multiple times — review context before acting.</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`px-4 py-2 text-xs font-semibold rounded-full border whitespace-nowrap transition ${
              statusFilter === s
                ? 'bg-primary text-white border-primary'
                : 'bg-white hover:border-gray-300 text-gray-600'
            }`}
          >
            {s === '' ? 'All' : STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {/* Loading / Empty states */}
      {isLoading ? (
        <div className="bg-white rounded-xl border shadow-sm p-8 text-center text-sm text-gray-500">
          Loading inquiries…
        </div>
      ) : inquiries.length === 0 ? (
        <div className="bg-white rounded-xl border shadow-sm p-8 text-center text-sm text-gray-500">
          No inquiries found.
        </div>
      ) : (
        <div className="hidden sm:block bg-white rounded-xl border shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b bg-gray-50">
                <th className="px-5 py-3.5 font-semibold text-xs">Ticket</th>
                <th className="px-5 py-3.5 font-semibold text-xs">Customer Name</th>
                <th className="px-5 py-3.5 font-semibold text-xs">Company Name</th>
                <th className="px-5 py-3.5 font-semibold text-xs">Qty Requested</th>
                <th className="px-5 py-3.5 font-semibold text-xs">Current Stage</th>
                <th className="px-5 py-3.5 font-semibold text-xs">Submitted On</th>
              </tr>
            </thead>
            <tbody>
              {inquiries.map((inq) => (
                <tr
                  key={inq.id}
                  onClick={() => setSelectedInquiry(inq)}
                  className="border-b last:border-0 hover:bg-gray-50/50 cursor-pointer transition-colors"
                >
                  <td className="px-5 py-4 text-gray-400 font-semibold">{inq.ticket_id}</td>
                  <td className="px-5 py-4 font-semibold text-gray-900">
                    {inq.full_name}
                    {inq.is_duplicate && <span className="ml-2 inline-flex"><DuplicateBadge /></span>}
                  </td>
                  <td className="px-5 py-4 text-gray-700 font-medium">{inq.company_name}</td>
                  <td className="px-5 py-4"><QtyCell qty={inq.qty_requested} /></td>
                  <td className="px-5 py-4">
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border capitalize ${STATUS_COLORS[inq.status]}`}>
                      {STATUS_LABELS[inq.status]}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-gray-400 text-xs">{new Date(inq.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Mobile cards */}
      {!isLoading && inquiries.length > 0 && (
        <div className="sm:hidden space-y-3">
          {inquiries.map((inq) => (
            <div
              key={inq.id}
              onClick={() => setSelectedInquiry(inq)}
              className="bg-white rounded-xl border shadow-sm p-4 cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-400">{inq.ticket_id}</span>
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border capitalize ${STATUS_COLORS[inq.status]}`}>
                  {STATUS_LABELS[inq.status]}
                </span>
              </div>
              <p className="mt-2 font-bold text-gray-900">{inq.full_name}</p>
              <p className="text-xs text-gray-600">{inq.company_name}</p>
              <div className="mt-2 pt-2 border-t flex justify-between text-xs text-gray-500">
                <span><QtyCell qty={inq.qty_requested} /></span>
                <span>{new Date(inq.created_at).toLocaleDateString()}</span>
              </div>
              {inq.is_duplicate && (
                <div className="mt-2"><DuplicateBadge /></div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-1">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-1.5 text-xs font-semibold border rounded-lg bg-white disabled:opacity-40"
          >
            Prev
          </button>
          <span className="text-xs text-gray-500">Page {page} of {data.pages}</span>
          <button
            onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
            disabled={page >= data.pages}
            className="px-3 py-1.5 text-xs font-semibold border rounded-lg bg-white disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}

      {/* Detail Drawer */}
      {selectedInquiry && (
        <>
          <div className="fixed inset-0 bg-black/55 z-50 transition-opacity" onClick={() => setSelectedInquiry(null)} />
          <div className="fixed inset-0 sm:inset-auto sm:top-0 sm:right-0 sm:h-full sm:w-full sm:max-w-md bg-[#FAFAF8] z-50 sm:shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-4 sm:p-5 border-b bg-white shrink-0">
              <div>
                <h3 className="font-bold text-lg text-gray-900">Inquiry Details</h3>
                <p className="text-xs text-gray-500 mt-0.5">{selectedInquiry.ticket_id}</p>
              </div>
              <button onClick={() => setSelectedInquiry(null)} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border capitalize ${STATUS_COLORS[selectedInquiry.status]}`}>
                  {STATUS_LABELS[selectedInquiry.status]}
                </span>
                {selectedInquiry.is_duplicate && <DuplicateBadge />}
              </div>

              {/* Contact Card */}
              <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase block mb-1">Company Contact</span>
                <p className="text-base font-bold text-gray-900 flex items-center gap-1.5"><Building size={16} className="text-gray-400" /> {selectedInquiry.company_name}</p>
                <p className="text-sm font-semibold text-gray-700 flex items-center gap-1.5"><User size={15} className="text-gray-400" /> {selectedInquiry.full_name}</p>
                <div className="grid grid-cols-2 gap-2 pt-2 border-t text-xs text-gray-600">
                  <a href={`tel:${selectedInquiry.phone}`} className="flex items-center gap-1 hover:text-primary"><Phone size={13} /> {selectedInquiry.phone}</a>
                  <a href={`mailto:${selectedInquiry.email}`} className="flex items-center gap-1 hover:text-primary truncate"><Mail size={13} /> {selectedInquiry.email}</a>
                </div>
              </div>

              {/* Requirement Card */}
              <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase block">Requirements</span>
                <p className="text-xs text-gray-800 font-bold">Volume Requested: <QtyCell qty={selectedInquiry.qty_requested} /></p>
                {selectedInquiry.customization_notes ? (
                  <div className="bg-gray-50 p-3 rounded-lg border text-xs text-gray-600 leading-normal flex gap-1.5">
                    <FileText size={16} className="shrink-0 text-gray-400 mt-0.5" />
                    <p className="italic">"{selectedInquiry.customization_notes}"</p>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 italic">No customisation notes.</p>
                )}
              </div>

              {/* Status Update Panel */}
              <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-3">
                <span className="text-[10px] font-bold text-gray-400 uppercase block">Change Deal Stage</span>
                <div className="grid grid-cols-1 gap-2">
                  {Object.entries(STATUS_LABELS).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => handleStatusChange(selectedInquiry.id, key as CorporateInquiryStatus)}
                      disabled={updateMutation.isPending || selectedInquiry.status === key}
                      className={`w-full py-2 px-3 border rounded-xl text-xs font-semibold text-left transition flex items-center justify-between disabled:opacity-60 ${
                        selectedInquiry.status === key
                          ? 'bg-primary text-white border-primary shadow-sm'
                          : 'bg-white hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <span>{label}</span>
                      {selectedInquiry.status === key && <span>✓</span>}
                    </button>
                  ))}
                </div>
              </div>

              {/* Delete */}
              <button
                onClick={() => handleDelete(selectedInquiry)}
                disabled={deleteMutation.isPending}
                className="w-full py-2 px-3 border border-red-200 text-red-600 rounded-xl text-xs font-semibold bg-white hover:bg-red-50 transition flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                <Trash2 size={14} />
                {deleteMutation.isPending ? 'Deleting…' : 'Delete Inquiry'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}