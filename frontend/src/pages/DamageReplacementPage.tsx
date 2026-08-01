import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowLeft, CheckCircle2, ChevronDown, Loader2, ShieldCheck, Upload, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useDeliveredOrders, useSubmitDamageClaim } from '@/hooks/useDamageClaims';
import type { Order } from '@/types';

const ISSUE_TYPES = [
  { value: 'broken_pot', label: 'Broken Pot / Planter' },
  { value: 'damaged_plant', label: 'Broken Stems / Leaves (Transit)' },
  { value: 'withered_plant', label: 'Withered / Dead Plant' },
  { value: 'wrong_item', label: 'Incorrect Product Delivered' },
  { value: 'missing_item', label: 'Missing Items' },
];

function orderSummaryLabel(order: Order): string {
  const names = order.items
    .map((i) => i.product_name ?? `Product #${i.product_id}`)
    .slice(0, 2)
    .join(', ');
  const extra = order.items.length > 2 ? ` +${order.items.length - 2} more` : '';
  return `#${order.id} — ${names}${extra}`;
}

function orderItemsSummary(order: Order): string {
  return order.items
    .map((i) => {
      const name = i.product_name ?? `Product #${i.product_id}`;
      return i.selected_options
        ? `${name} (${Object.values(i.selected_options).join(', ')})`
        : name;
    })
    .join(', ');
}

interface SuccessState {
  ticketId: string;
  orderId: number;
  itemsSummary: string;
}

export default function DamageReplacementPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Server state
  const { data: deliveredOrders, isLoading: ordersLoading } = useDeliveredOrders();
  const submitMutation = useSubmitDamageClaim();

  // Form state
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [issueType, setIssueType] = useState('');
  const [description, setDescription] = useState('');
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);

  // UI state
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState<SuccessState | null>(null);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  function handleOrderSelect(e: React.ChangeEvent<HTMLSelectElement>) {
    const id = parseInt(e.target.value, 10);
    const order = deliveredOrders?.find((o) => o.id === id) ?? null;
    setSelectedOrder(order);
    clearError('order');
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

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
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function removePhoto(index: number) {
    URL.revokeObjectURL(photoPreviews[index]);
    setPhotoFiles((prev) => prev.filter((_, i) => i !== index));
    setPhotoPreviews((prev) => prev.filter((_, i) => i !== index));
  }

  function clearError(key: string) {
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!selectedOrder) next.order = 'Please select an order';
    if (!issueType) next.issueType = 'Please select the issue type';
    if (description.trim().length < 10) next.description = 'Please describe the damage in more detail (min 10 characters)';
    if (photoFiles.length === 0) next.photos = 'At least one proof-of-damage photo is required';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) {
      toast.error('Please fix the errors before submitting');
      return;
    }

    const fd = new FormData();
    fd.append('order_id', String(selectedOrder!.id));
    fd.append('issue_type', issueType);
    fd.append('description', description.trim());
    photoFiles.forEach((file) => fd.append('photos', file));

    try {
      const claim = await submitMutation.mutateAsync(fd);
      setSuccess({
        ticketId: claim.ticket_id,
        orderId: selectedOrder!.id,
        itemsSummary: orderItemsSummary(selectedOrder!),
      });
      toast.success('Replacement claim submitted successfully!');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        'Something went wrong. Please try again.';
      toast.error(msg);
    }
  }

  // ---------------------------------------------------------------------------
  // Success screen
  // ---------------------------------------------------------------------------

  if (success) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 sm:py-24 flex flex-col items-center text-center animate-fade-in">
        <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 mb-6 shadow-inner">
          <CheckCircle2 size={44} />
        </div>
        <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 leading-tight">
          Claim Submitted Successfully
        </h2>
        <p className="text-gray-500 mt-3 text-sm sm:text-base max-w-md">
          We have received your damage replacement request. Our team will review the photos and
          initiate a replacement or refund within 24–48 hours.
        </p>

        <div className="mt-8 bg-gray-50 border border-gray-100 rounded-2xl p-5 w-full max-w-sm text-left">
          <div className="flex justify-between text-sm py-1.5 border-b border-gray-200/50">
            <span className="text-gray-400">Ticket Reference</span>
            <span className="font-bold text-gray-800">{success.ticketId}</span>
          </div>
          <div className="flex justify-between text-sm py-1.5 border-b border-gray-200/50">
            <span className="text-gray-400">Order ID</span>
            <span className="font-medium text-gray-700">#{success.orderId}</span>
          </div>
          <div className="flex justify-between text-sm py-1.5">
            <span className="text-gray-400 shrink-0 mr-3">Items</span>
            <span className="font-medium text-gray-700 text-right truncate max-w-[200px]">
              {success.itemsSummary}
            </span>
          </div>
        </div>

        <div className="mt-10 flex flex-col sm:flex-row gap-3 w-full max-w-xs sm:max-w-md justify-center">
          <Link
            to="/damage-claims"
            className="flex-1 py-3 px-6 bg-primary hover:bg-primary/95 text-white font-bold rounded-xl shadow-md hover:shadow-lg transition active:scale-[0.98] text-sm text-center"
          >
            Track My Claim
          </Link>
          <Link
            to="/products"
            className="flex-1 py-3 px-6 bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 font-bold rounded-xl shadow-sm transition active:scale-[0.98] text-sm text-center"
          >
            Continue Shopping
          </Link>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Form
  // ---------------------------------------------------------------------------

  const isSubmitting = submitMutation.isPending;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
      {/* Back Button */}
      <Link
        to="/"
        className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-gray-500 hover:text-primary transition mb-6"
      >
        <ArrowLeft size={16} /> Back to Home
      </Link>

      <div className="bg-white rounded-3xl border border-gray-100 shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-br from-[#1B4332] to-[#2D6A4F] text-white p-6 sm:p-10 relative">
          <div className="absolute right-6 top-1/2 -translate-y-1/2 opacity-[0.08] pointer-events-none select-none hidden sm:block">
            <ShieldCheck size={160} />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight leading-none">
            Damage Replacement Form
          </h1>
          <p className="text-emerald-100/90 text-sm mt-3 leading-relaxed max-w-xl">
            Did your plant arrive withered or did a ceramic pot break in transit? Select your order,
            upload photos, and our plant doctors will ship a replacement immediately.
          </p>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 sm:p-10 space-y-6 sm:space-y-8">

          {/* Order picker */}
          <div>
            <label htmlFor="order" className="block text-xs sm:text-sm font-bold text-gray-700 mb-1.5">
              Select Order *
            </label>
            {ordersLoading ? (
              <div className="flex items-center gap-2 text-sm text-gray-400 py-3">
                <Loader2 size={16} className="animate-spin" /> Loading your orders…
              </div>
            ) : !deliveredOrders?.length ? (
              <div className="text-sm text-gray-500 py-3 px-4 bg-gray-50 rounded-xl border border-gray-200">
                No eligible delivered orders found. Damage claims can only be submitted for
                delivered orders.{' '}
                <button
                  type="button"
                  onClick={() => navigate('/orders')}
                  className="text-primary font-semibold hover:underline"
                >
                  View my orders
                </button>
              </div>
            ) : (
              <div className="relative">
                <select
                  id="order"
                  value={selectedOrder?.id ?? ''}
                  onChange={handleOrderSelect}
                  className={`w-full px-4 py-3 text-sm border rounded-xl focus:outline-none focus:ring-1 appearance-none pr-10 ${
                    errors.order
                      ? 'border-red-400 focus:ring-red-400'
                      : 'border-gray-200 focus:ring-primary-light'
                  }`}
                >
                  <option value="">Select a delivered order</option>
                  {deliveredOrders.map((order) => (
                    <option key={order.id} value={order.id}>
                      {orderSummaryLabel(order)}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={16}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                />
              </div>
            )}
            {errors.order && (
              <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                <AlertCircle size={12} /> {errors.order}
              </p>
            )}
          </div>

          {/* Issue Type + Description — shown once an order is selected */}
          {selectedOrder && (
            <>
              {/* Selected order summary */}
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-sm space-y-1.5">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-2">
                  Order Summary
                </p>
                {selectedOrder.items.map((item) => (
                  <div key={item.id} className="flex justify-between text-gray-700">
                    <span className="font-medium">
                      {item.product_name ?? `Product #${item.product_id}`}
                      {item.selected_options && (
                        <span className="font-normal text-gray-400 ml-1.5">
                          ({Object.values(item.selected_options).join(', ')})
                        </span>
                      )}
                    </span>
                    <span className="text-gray-500 shrink-0 ml-3">×{item.quantity}</span>
                  </div>
                ))}
                <div className="pt-1.5 border-t border-gray-200 flex justify-between text-gray-500">
                  <span>Total</span>
                  <span className="font-semibold text-gray-800">₹{selectedOrder.total_amount}</span>
                </div>
              </div>

              {/* Issue Type */}
              <div>
                <label
                  htmlFor="issueType"
                  className="block text-xs sm:text-sm font-bold text-gray-700 mb-1.5"
                >
                  What went wrong? *
                </label>
                <div className="relative">
                  <select
                    id="issueType"
                    value={issueType}
                    onChange={(e) => {
                      setIssueType(e.target.value);
                      clearError('issueType');
                    }}
                    className={`w-full px-4 py-3 text-sm border rounded-xl focus:outline-none focus:ring-1 appearance-none pr-10 ${
                      errors.issueType
                        ? 'border-red-400 focus:ring-red-400'
                        : 'border-gray-200 focus:ring-primary-light'
                    }`}
                  >
                    <option value="">Select the issue</option>
                    {ISSUE_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={16}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                  />
                </div>
                {errors.issueType && (
                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                    <AlertCircle size={12} /> {errors.issueType}
                  </p>
                )}
              </div>

              {/* Description */}
              <div>
                <label
                  htmlFor="description"
                  className="block text-xs sm:text-sm font-bold text-gray-700 mb-1.5"
                >
                  Detailed Description *
                </label>
                <textarea
                  id="description"
                  rows={4}
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    clearError('description');
                  }}
                  className={`w-full px-4 py-3 text-sm border rounded-xl focus:outline-none focus:ring-1 ${
                    errors.description
                      ? 'border-red-400 focus:ring-red-400'
                      : 'border-gray-200 focus:ring-primary-light'
                  }`}
                  placeholder="Please describe what parts are broken or explain the condition of the plant upon arrival."
                />
                {errors.description && (
                  <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                    <AlertCircle size={12} /> {errors.description}
                  </p>
                )}
              </div>

              {/* Photo upload */}
              <div>
                <span className="block text-xs sm:text-sm font-bold text-gray-700 mb-1.5">
                  Photo Proof of Damage * <span className="font-normal text-gray-400">(up to 5 photos)</span>
                </span>

                {/* Existing previews */}
                {photoPreviews.length > 0 && (
                  <div className="flex flex-wrap gap-3 mb-3">
                    {photoPreviews.map((src, i) => (
                      <div key={i} className="relative group">
                        <img
                          src={src}
                          alt={`Damage photo ${i + 1}`}
                          className="h-24 w-24 object-cover rounded-xl border border-gray-200"
                        />
                        <button
                          type="button"
                          onClick={() => removePhoto(i)}
                          aria-label="Remove photo"
                          className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow"
                        >
                          <X size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Upload zone — hide when at limit */}
                {photoFiles.length < 5 && (
                  <div
                    className={`relative flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-2xl transition cursor-pointer ${
                      errors.photos
                        ? 'border-red-400 bg-red-50/10'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                    onClick={() => fileInputRef.current?.click()}
                    onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
                    role="button"
                    tabIndex={0}
                    aria-label="Upload damage photos"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      multiple
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <div className="flex flex-col items-center text-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center text-primary mb-1">
                        <Upload size={20} />
                      </div>
                      <p className="text-sm font-bold text-gray-700">
                        {photoPreviews.length > 0 ? 'Add more photos' : 'Upload Damage Photos'}
                      </p>
                      <p className="text-[11px] text-gray-400 max-w-xs">
                        PNG, JPG, JPEG or WebP · Max 5 MB each · Up to {5 - photoFiles.length} more
                      </p>
                    </div>
                  </div>
                )}

                {errors.photos && (
                  <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1">
                    <AlertCircle size={12} /> {errors.photos}
                  </p>
                )}
              </div>

              {/* Guarantee notice */}
              <div className="p-4 bg-emerald-50/60 border border-emerald-100 rounded-2xl flex gap-3 text-emerald-800">
                <ShieldCheck size={20} className="shrink-0 mt-0.5" />
                <div className="text-xs leading-normal">
                  <span className="font-bold">Plantoga thrive guarantee active.</span> All transit
                  damages are 100% covered. We do not ask you to ship the damaged plants back!
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 bg-primary hover:bg-primary/95 text-white font-bold rounded-2xl transition active:scale-[0.98] shadow-md hover:shadow-lg disabled:opacity-50 text-sm sm:text-base flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    <span>Submitting request…</span>
                  </>
                ) : (
                  <span>Submit Replacement Request</span>
                )}
              </button>
            </>
          )}

          {/* Prompt to select an order if nothing is selected yet */}
          {!selectedOrder && !ordersLoading && !!deliveredOrders?.length && (
            <p className="text-sm text-gray-400 text-center pb-2">
              Select an order above to continue filling out the form.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
