import { useState } from 'react';
import { X, Image as ImageIcon, User, ShoppingBag, MessageSquare, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  useAdminDamageClaims,
  useAdminDamageClaim,
  useUpdateDamageClaimStatus,
} from '@/hooks/useDamageClaims';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import type { DamageClaim } from '@/types';

const STATUSES: ('' | DamageClaim['status'])[] = [
  '',
  'submitted',
  'under_review',
  'approved',
  'rejected',
  'replacement_shipped',
  'refund_issued',
  'closed',
];

const STATUS_LABELS: Record<string, string> = {
  '': 'All Claims',
  submitted: 'Submitted',
  under_review: 'Under Review',
  approved: 'Approved',
  rejected: 'Rejected',
  replacement_shipped: 'Replacement Shipped',
  refund_issued: 'Refund Issued',
  closed: 'Closed',
};

const STATUS_COLORS: Record<string, string> = {
  submitted: 'bg-amber-100 text-amber-800 border-amber-200',
  under_review: 'bg-sky-100 text-sky-800 border-sky-200',
  approved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  rejected: 'bg-red-100 text-red-800 border-red-200',
  replacement_shipped: 'bg-purple-100 text-purple-800 border-purple-200',
  refund_issued: 'bg-blue-100 text-blue-800 border-blue-200',
  closed: 'bg-gray-100 text-gray-700 border-gray-200',
};

const ISSUE_LABELS: Record<string, string> = {
  broken_pot: 'Broken Pot / Planter',
  damaged_plant: 'Broken Stems / Leaves (Transit)',
  withered_plant: 'Withered / Dead Plant',
  wrong_item: 'Incorrect Product Delivered',
  missing_item: 'Missing Items',
};

function issueLabel(issueType: string): string {
  return ISSUE_LABELS[issueType] ?? issueType.replace(/_/g, ' ');
}

function ClaimDrawer({ claim, onClose }: { claim: DamageClaim; onClose: () => void }) {
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
    } catch {
      toast.error('Failed to update claim. Please try again.');
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/55 z-50 transition-opacity" onClick={onClose} />
      <div className="fixed inset-0 sm:inset-auto sm:top-0 sm:right-0 sm:h-full sm:w-full sm:max-w-lg bg-[#FAFAF8] z-50 sm:shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b bg-white shrink-0">
          <div>
            <h3 className="font-bold text-lg text-gray-900">Damage Claim Review</h3>
            <p className="text-xs text-gray-500 mt-0.5">Reference ID: {c.ticket_id}</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors">
            <X size={20} />
          </button>
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm py-20">Loading claim details...</div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">

            {/* Claim overview */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="bg-white p-3 rounded-xl border border-gray-100">
                <span className="text-gray-400 block text-[10px] font-bold uppercase">Current Status</span>
                <span className={`inline-block mt-1 text-xs font-semibold px-2 py-0.5 rounded-full capitalize border ${STATUS_COLORS[c.status] || 'bg-gray-100'}`}>
                  {STATUS_LABELS[c.status]}
                </span>
              </div>
              <div className="bg-white p-3 rounded-xl border border-gray-100">
                <span className="text-gray-400 block text-[10px] font-bold uppercase">Order ID</span>
                <p className="font-bold text-base text-primary mt-0.5">#{c.order_id}</p>
              </div>
              <div className="bg-white p-3 rounded-xl border border-gray-100">
                <span className="text-gray-400 block text-[10px] font-bold uppercase">Issue Type</span>
                <p className="font-medium text-gray-700 mt-0.5">{issueLabel(c.issue_type)}</p>
              </div>
              <div className="bg-white p-3 rounded-xl border border-gray-100">
                <span className="text-gray-400 block text-[10px] font-bold uppercase">Submitted On</span>
                <p className="font-medium text-gray-700 mt-0.5">{new Date(c.created_at).toLocaleString()}</p>
              </div>
            </div>

            {/* Customer info */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase pb-2 border-b">
                <User size={14} />
                <span>Customer Information</span>
              </div>
              <div className="text-xs space-y-1 text-gray-700">
                <p className="font-bold text-sm text-gray-900">{customerName}</p>
                <p className="text-gray-500">Phone: {customerPhone}</p>
                <p className="text-gray-500">Email: {customerEmail}</p>
              </div>
            </div>

            {/* Description */}
            <div className="bg-white p-4 rounded-xl border border-gray-200">
              <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase pb-2 border-b mb-2">
                <MessageSquare size={14} />
                <span>Customer Description</span>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{c.description}</p>
            </div>

            {/* Photos */}
            <div className="bg-white p-4 rounded-xl border border-gray-200">
              <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase pb-2 border-b mb-2">
                <ImageIcon size={14} />
                <span>Proof Photos ({c.photo_urls.length})</span>
              </div>
              {c.photo_urls.length === 0 ? (
                <p className="text-xs text-gray-400 py-2">No photos uploaded.</p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {c.photo_urls.map((src, i) => (
                    <a
                      key={i}
                      href={src}
                      target="_blank"
                      rel="noreferrer"
                      className="block aspect-square rounded-lg overflow-hidden border border-gray-200 bg-gray-50 hover:opacity-85 transition"
                    >
                      <img src={src} alt={`Claim photo ${i + 1}`} className="w-full h-full object-cover" />
                    </a>
                  ))}
                </div>
              )}
            </div>

            {/* Order items */}
            {c.order && (
              <div className="bg-white p-4 rounded-xl border border-gray-200">
                <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase pb-2 border-b mb-2">
                  <ShoppingBag size={14} />
                  <span>Order #{c.order.id} Items ({c.order.items.length})</span>
                </div>
                <div className="divide-y">
                  {c.order.items.map((item) => (
                    <div key={item.id} className="py-2.5 flex justify-between items-center text-xs gap-3">
                      <div>
                        <span className="font-semibold text-gray-800">{item.product_name || `Product #${item.product_id}`}</span>
                        <p className="text-[10px] text-gray-400">
                          {item.selected_options
                            ? Object.values(item.selected_options).join(', ')
                            : ''}
                        </p>
                      </div>
                      <span className="font-bold text-gray-900 shrink-0">₹{item.unit_price} × {item.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Admin notes (existing) */}
            {c.admin_notes && (
              <div className="bg-white p-4 rounded-xl border border-gray-200">
                <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase pb-2 border-b mb-2">
                  <ShieldAlert size={14} />
                  <span>Admin Notes (Existing)</span>
                </div>
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{c.admin_notes}</p>
              </div>
            )}

            {/* Update box */}
            <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase pb-2 border-b">
                <ShieldAlert size={14} />
                <span>Update Claim Status</span>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700">Choose Status</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as DamageClaim['status'])}
                  className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {STATUSES.filter(Boolean).map((s) => (
                    <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-700">Admin Notes (visible to customer)</label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  rows={3}
                  placeholder="Add a note for the customer, e.g. reason for decision or next steps…"
                  className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                />
              </div>

              <button
                onClick={handleUpdate}
                disabled={mutation.isPending || (newStatus === c.status && adminNotes.trim() === (c.admin_notes ?? ''))}
                className="w-full py-2.5 bg-primary text-white rounded-xl text-xs font-semibold hover:bg-primary/95 disabled:opacity-60 transition"
              >
                {mutation.isPending ? 'Saving changes...' : 'Apply Status Change'}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default function DamageClaimsAdminPage() {
  const [statusFilter, setStatusFilter] = useState<'' | DamageClaim['status']>('');
  const [page, setPage] = useState(1);
  const [selectedClaim, setSelectedClaim] = useState<DamageClaim | null>(null);
  const { data, isLoading } = useAdminDamageClaims(statusFilter || undefined, page);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Damage Claims Desk</h1>
        <p className="text-xs text-gray-500 mt-0.5">Review transit-damage reports, inspect proof photos, and resolve replacement/refund requests.</p>
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
            {STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block bg-white rounded-xl border overflow-x-auto shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b bg-gray-50">
              <th className="px-5 py-3.5 font-semibold text-xs">Ticket</th>
              <th className="px-5 py-3.5 font-semibold text-xs">Customer</th>
              <th className="px-5 py-3.5 font-semibold text-xs">Order</th>
              <th className="px-5 py-3.5 font-semibold text-xs">Issue Type</th>
              <th className="px-5 py-3.5 font-semibold text-xs">Photos</th>
              <th className="px-5 py-3.5 font-semibold text-xs">Status</th>
              <th className="px-5 py-3.5 font-semibold text-xs">Submitted On</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="px-5 py-12 text-center text-gray-400">Loading damage claims...</td></tr>
            ) : data?.items?.length === 0 ? (
              <tr><td colSpan={7} className="px-5 py-12 text-center text-gray-400">No damage claims found under this filter.</td></tr>
            ) : (
              data?.items?.map((c) => (
                <tr
                  key={c.id}
                  className="border-b last:border-0 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => setSelectedClaim(c)}
                >
                  <td className="px-5 py-3.5 font-semibold text-gray-900">{c.ticket_id}</td>
                  <td className="px-5 py-3.5">
                    <span className="font-semibold text-gray-800">{c.user?.full_name || c.order?.address?.full_name || `Customer #${c.user_id}`}</span>
                    {c.user?.email && <p className="text-[10px] text-gray-400 mt-0.5">{c.user.email}</p>}
                  </td>
                  <td className="px-5 py-3.5 text-gray-700">#{c.order_id}</td>
                  <td className="px-5 py-3.5 text-gray-700">{issueLabel(c.issue_type)}</td>
                  <td className="px-5 py-3.5 text-gray-500">{c.photo_urls.length}</td>
                  <td className="px-5 py-3.5">
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border capitalize ${STATUS_COLORS[c.status] || 'bg-gray-100'}`}>
                      {STATUS_LABELS[c.status]}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-gray-400 text-xs">{new Date(c.created_at).toLocaleDateString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-2">
        {isLoading ? (
          <p className="text-center text-gray-400 py-8 text-sm">Loading damage claims...</p>
        ) : data?.items?.length === 0 ? (
          <p className="text-center text-gray-400 py-8 text-sm">No damage claims found.</p>
        ) : (
          data?.items?.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedClaim(c)}
              className="w-full bg-white rounded-xl border p-3 text-left active:scale-[0.99] transition-transform shadow-sm"
            >
              <div className="flex items-start justify-between mb-1.5">
                <div>
                  <span className="text-sm font-semibold text-gray-900">{c.ticket_id}</span>
                  <p className="text-xs text-gray-700 font-medium mt-0.5">{c.user?.full_name || c.order?.address?.full_name || `Customer #${c.user_id}`}</p>
                </div>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded border capitalize ${STATUS_COLORS[c.status] || 'bg-gray-100'}`}>
                  {STATUS_LABELS[c.status]}
                </span>
              </div>
              <div className="flex items-end justify-between mt-2 pt-2 border-t border-gray-100">
                <p className="text-[10px] text-gray-400">Order #{c.order_id} · {c.photo_urls.length} photo(s)</p>
                <p className="text-[10px] font-semibold text-primary">{issueLabel(c.issue_type)}</p>
              </div>
            </button>
          ))
        )}
      </div>

      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1.5 border bg-white rounded-lg text-xs font-semibold disabled:opacity-30">Prev</button>
          <span className="text-xs text-gray-500 font-medium">Page {page} of {data.pages}</span>
          <button disabled={page >= data.pages} onClick={() => setPage(page + 1)} className="px-3 py-1.5 border bg-white rounded-lg text-xs font-semibold disabled:opacity-30">Next</button>
        </div>
      )}

      {selectedClaim && <ClaimDrawer claim={selectedClaim} onClose={() => setSelectedClaim(null)} />}
    </div>
  );
}
