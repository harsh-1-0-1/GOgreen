import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ShieldCheck, Image as ImageIcon, AlertCircle } from 'lucide-react';
import { useMyDamageClaims } from '@/hooks/useDamageClaims';
import type { DamageClaim } from '@/types';

const STATUS_LABELS: Record<string, string> = {
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

function statusHint(status: string): string {
  const hints: Record<string, string> = {
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

function ClaimCard({ claim }: { claim: DamageClaim }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-3 hover:bg-gray-50/60 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-gray-900">{claim.ticket_id}</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_COLORS[claim.status] || 'bg-gray-100'}`}>
              {STATUS_LABELS[claim.status] ?? claim.status}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Order #{claim.order_id} · {issueLabel(claim.issue_type)} ·{' '}
            {new Date(claim.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        <ChevronDown size={18} className={`text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="px-4 sm:px-5 pb-5 border-t border-gray-100 pt-4 space-y-4 animate-fade-in">
          <p className="text-sm text-gray-700 leading-relaxed">{claim.description}</p>

          <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-3 text-xs text-emerald-800 flex gap-2">
            <ShieldCheck size={16} className="shrink-0 mt-0.5" />
            <span>{statusHint(claim.status)}</span>
          </div>

          {claim.photo_urls.length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1">
                <ImageIcon size={13} /> Submitted Photos ({claim.photo_urls.length})
              </p>
              <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                {claim.photo_urls.map((src, i) => (
                  <a
                    key={i}
                    href={src}
                    target="_blank"
                    rel="noreferrer"
                    className="block aspect-square rounded-lg overflow-hidden border border-gray-200 bg-gray-50 hover:opacity-85 transition"
                  >
                    <img src={src} alt={`Damage photo ${i + 1}`} className="w-full h-full object-cover" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {claim.admin_notes && (
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs text-gray-700">
              <p className="font-bold text-gray-400 uppercase tracking-wide mb-1">Staff Notes</p>
              <p className="leading-relaxed whitespace-pre-wrap">{claim.admin_notes}</p>
            </div>
          )}

          <p className="text-[11px] text-gray-400">
            Last updated: {new Date(claim.updated_at).toLocaleString()}
          </p>
        </div>
      )}
    </div>
  );
}

export default function MyDamageClaimsPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useMyDamageClaims(page);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
      <Link to="/" className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-gray-500 hover:text-primary transition mb-6">
        <ArrowLeft size={16} /> Back to Home
      </Link>

      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-gray-900">My Damage Claims</h1>
        <p className="text-sm text-gray-500 mt-2">
          Track the status of your replacement / refund requests.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <div className="h-24 bg-gray-100 rounded-2xl animate-pulse" />
          <div className="h-24 bg-gray-100 rounded-2xl animate-pulse" />
        </div>
      ) : data?.items?.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center space-y-3 shadow-sm">
          <div className="w-14 h-14 mx-auto rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
            <ShieldCheck size={26} />
          </div>
          <h3 className="font-bold text-gray-900">No damage claims yet</h3>
          <p className="text-sm text-gray-500 max-w-sm mx-auto">
            If any plant or pot arrives damaged, submit a claim with photos within 48 hours and we&apos;ll make it right.
          </p>
          <Link
            to="/damage-replacement"
            className="inline-flex items-center gap-2 mt-2 px-5 py-2.5 bg-primary hover:bg-primary/95 text-white font-bold rounded-xl shadow-md transition text-sm"
          >
            <ShieldCheck size={16} /> File a Damage Claim
          </Link>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {data?.items?.map((claim) => <ClaimCard key={claim.id} claim={claim} />)}
          </div>

          {data && data.pages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-6">
              <button
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="px-3 py-1.5 border bg-white rounded-lg text-xs font-semibold disabled:opacity-30"
              >
                Prev
              </button>
              <span className="text-xs text-gray-500 font-medium">Page {page} of {data.pages}</span>
              <button
                disabled={page >= data.pages}
                onClick={() => setPage(page + 1)}
                className="px-3 py-1.5 border bg-white rounded-lg text-xs font-semibold disabled:opacity-30"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      <p className="flex items-center gap-1.5 text-[11px] text-gray-400 mt-8 justify-center">
        <AlertCircle size={12} /> Expect a response within 24–48 hours of submitting your claim.
      </p>
    </div>
  );
}
