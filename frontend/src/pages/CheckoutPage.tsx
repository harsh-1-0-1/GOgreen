import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, MapPin, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAddresses, useCreateAddress, useDeleteAddress } from '@/hooks/useAddresses';
import { useCartStore } from '@/store/cartStore';
import { useAuthStore } from '@/store/authStore';
import api from '@/lib/api';
import type { CheckoutResponse } from '@/types';
import Spinner from '@/components/ui/Spinner';

function optionSummary(item: ReturnType<typeof useCartStore.getState>['items'][number]) {
  if (!item.selected_options) return null;
  const color = item.product.variants?.colors?.find((c) => c.slug === item.selected_options?.color)?.name
    || item.selected_options.color;
  const pot = item.product.variants?.pot_types?.find((p) => p.slug === item.selected_options?.pot_type)?.name
    || item.selected_options.pot_type;
  return [color && `Color: ${color}`, pot && `Pot: ${pot}`].filter(Boolean).join(' · ');
}

function AddressForm({ onDone }: { onDone: () => void }) {
  const mutation = useCreateAddress();
  const [form, setForm] = useState({
    full_name: '', phone: '', line1: '', line2: '', city: '', state: '', pincode: '', is_default: false,
  });

  function set(field: string, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await mutation.mutateAsync(form);
      toast.success('Address added');
      onDone();
    } catch {
      toast.error('Failed to save address');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 bg-gray-50 rounded-xl p-3 sm:p-4">
      <h4 className="font-semibold text-sm mb-1">New Address</h4>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input required placeholder="Full Name" value={form.full_name} onChange={(e) => set('full_name', e.target.value)}
          className="px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-light" />
        <input required placeholder="Phone" value={form.phone} onChange={(e) => set('phone', e.target.value)}
          className="px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-light" />
        <input required placeholder="Address Line 1" value={form.line1} onChange={(e) => set('line1', e.target.value)}
          className="sm:col-span-2 px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-light" />
        <input placeholder="Address Line 2 (optional)" value={form.line2} onChange={(e) => set('line2', e.target.value)}
          className="sm:col-span-2 px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-light" />
        <input required placeholder="City" value={form.city} onChange={(e) => set('city', e.target.value)}
          className="px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-light" />
        <input required placeholder="State" value={form.state} onChange={(e) => set('state', e.target.value)}
          className="px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-light" />
        <input required placeholder="Pincode" value={form.pincode} onChange={(e) => set('pincode', e.target.value)}
          className="px-3 py-2.5 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-light" />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.is_default} onChange={(e) => set('is_default', e.target.checked)} className="accent-primary" />
        Set as default address
      </label>
      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={mutation.isPending} className="px-4 py-2.5 bg-primary text-white text-sm rounded-lg font-medium hover:bg-primary/90 disabled:opacity-60 touch-target">
          {mutation.isPending ? 'Saving...' : 'Save Address'}
        </button>
        <button type="button" onClick={onDone} className="px-4 py-2.5 text-sm border rounded-lg hover:bg-gray-100 touch-target">Cancel</button>
      </div>
    </form>
  );
}

function AccordionStep({ step, title, icon, open, onToggle, children }: {
  step: number; title: string; icon: React.ReactNode; open: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className="border rounded-xl overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between p-4 text-left touch-target">
        <div className="flex items-center gap-3">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${open ? 'bg-primary text-white' : 'bg-gray-200 text-gray-500'}`}>
            {step}
          </div>
          <span className="font-semibold text-sm flex items-center gap-2">{icon} {title}</span>
        </div>
        <ChevronDown size={18} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { user, openAuthModal } = useAuthStore();
  const { items, total, cartId, clearLocal } = useCartStore();
  const { data: addresses, isLoading: loadingAddresses } = useAddresses();
  const deleteAddr = useDeleteAddress();
  const formRef = useRef<HTMLFormElement>(null);

  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payuData, setPayuData] = useState<Record<string, string> | null>(null);
  const [mobileStep, setMobileStep] = useState(1);

  useEffect(() => {
    if (!user) {
      openAuthModal();
      navigate('/cart', { replace: true });
      return;
    }
    if (items.length === 0 && !payuData) navigate('/cart', { replace: true });
  }, [user, items, navigate, payuData, openAuthModal]);

  useEffect(() => {
    if (addresses?.length && !selectedAddressId) {
      const def = addresses.find((a) => a.is_default) ?? addresses[0];
      setSelectedAddressId(def.id);
    }
  }, [addresses, selectedAddressId]);

  useEffect(() => {
    if (payuData && formRef.current) formRef.current.submit();
  }, [payuData]);

  async function handleCheckout() {
    if (!selectedAddressId) { toast.error('Please select a delivery address'); return; }
    if (!cartId) { toast.error('Cart not found'); return; }
    setPaying(true);
    try {
      const { data } = await api.post<CheckoutResponse>('/orders/checkout', { address_id: selectedAddressId, cart_id: cartId });
      clearLocal();
      setPayuData(data.payu_form_data);
      toast.success('Order placed! Redirecting to payment...');
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Checkout failed');
    } finally {
      setPaying(false);
    }
  }

  if (loadingAddresses) return <Spinner className="py-32" />;

  const shipping = total >= 499 ? 0 : 49;
  const grandTotal = total + shipping;

  const addressSection = (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base sm:text-lg font-semibold flex items-center gap-2">
          <MapPin size={18} className="text-primary" /> Delivery Address
        </h2>
        <button onClick={() => setShowForm(true)} className="text-xs sm:text-sm text-primary font-medium flex items-center gap-1 hover:underline touch-target">
          <Plus size={15} /> Add New
        </button>
      </div>
      {showForm && <AddressForm onDone={() => setShowForm(false)} />}
      <div className="space-y-2 sm:space-y-3">
        {addresses?.map((addr) => (
          <label
            key={addr.id}
            className={`flex gap-3 p-3 sm:p-4 border rounded-xl cursor-pointer transition ${selectedAddressId === addr.id ? 'border-primary bg-primary-light/5' : 'hover:border-gray-300'}`}
          >
            <input type="radio" name="address" checked={selectedAddressId === addr.id} onChange={() => setSelectedAddressId(addr.id)} className="mt-1 accent-primary" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm">{addr.full_name}</span>
                {addr.is_default && (
                  <span className="text-[10px] bg-primary-light/20 text-primary px-2 py-0.5 rounded-full font-medium">Default</span>
                )}
              </div>
              <p className="text-sm text-gray-600 mt-0.5">{addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}</p>
              <p className="text-sm text-gray-600">{addr.city}, {addr.state} – {addr.pincode}</p>
              <p className="text-sm text-gray-500">Ph: {addr.phone}</p>
            </div>
            <button onClick={(e) => { e.preventDefault(); deleteAddr.mutate(addr.id); }} className="text-red-400 hover:text-red-600 shrink-0 touch-target">
              <Trash2 size={15} />
            </button>
          </label>
        ))}
        {!addresses?.length && !showForm && (
          <div className="text-center py-8 text-gray-400">
            <p>No saved addresses.</p>
            <button onClick={() => setShowForm(true)} className="text-sm text-primary mt-2 hover:underline">Add your first address</button>
          </div>
        )}
      </div>
    </div>
  );

  const orderReviewSection = (
    <div className="space-y-3 max-h-72 overflow-y-auto">
      {items.map((item) => (
        <div key={item.id} className="flex items-center justify-between text-sm gap-3">
          <img
            src={item.resolved_image_url || item.product.images?.[0] || 'https://placehold.co/48x48?text=Plant'}
            alt={item.product.name}
            className="w-12 h-12 rounded-lg object-cover shrink-0"
            loading="lazy"
          />
          <div className="flex-1 min-w-0">
            <p className="text-gray-700 line-clamp-1">{item.product.name} × {item.quantity}</p>
            {optionSummary(item) && <p className="text-xs text-gray-400 line-clamp-1">{optionSummary(item)}</p>}
          </div>
          <span className="font-medium shrink-0">₹{item.line_total.toFixed(0)}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-8 pb-24 lg:pb-8">
      <h1 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-8">Checkout</h1>

      {/* Desktop layout */}
      <div className="hidden lg:grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">{addressSection}</div>
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl border p-6 space-y-4 sticky top-24">
            <h3 className="font-bold text-lg">Order Summary</h3>
            {orderReviewSection}
            <div className="border-t pt-3 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>₹{total.toFixed(2)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Shipping</span><span className="text-green-600">{shipping === 0 ? 'Free' : `₹${shipping}`}</span></div>
            </div>
            <div className="border-t pt-3 flex justify-between text-lg font-bold">
              <span>Total</span><span className="text-primary">₹{grandTotal.toFixed(2)}</span>
            </div>
            <button onClick={handleCheckout} disabled={paying || !selectedAddressId} className="w-full py-3.5 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition disabled:opacity-60">
              {paying ? 'Processing...' : 'Pay Now'}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile accordion layout */}
      <div className="lg:hidden space-y-3">
        <AccordionStep step={1} title="Select Address" icon={<MapPin size={16} className="text-primary" />} open={mobileStep === 1} onToggle={() => setMobileStep(mobileStep === 1 ? 0 : 1)}>
          {addressSection}
        </AccordionStep>

        <AccordionStep step={2} title="Review Order" icon={<ShoppingBag size={16} className="text-primary" />} open={mobileStep === 2} onToggle={() => setMobileStep(mobileStep === 2 ? 0 : 2)}>
          {orderReviewSection}
          <div className="mt-3 space-y-2 text-sm border-t pt-3">
            <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>₹{total.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Shipping</span><span className="text-green-600">{shipping === 0 ? 'Free' : `₹${shipping}`}</span></div>
            <div className="flex justify-between font-bold text-base border-t pt-2"><span>Total</span><span className="text-primary">₹{grandTotal.toFixed(2)}</span></div>
          </div>
        </AccordionStep>
      </div>

      {/* Mobile fixed Pay Now button */}
      <div className="lg:hidden fixed bottom-14 left-0 right-0 z-30 bg-white border-t px-3 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.08)] safe-bottom">
        <button onClick={handleCheckout} disabled={paying || !selectedAddressId} className="w-full py-3 bg-primary text-white rounded-xl font-semibold text-sm disabled:opacity-60">
          {paying ? 'Processing...' : `Pay Now — ₹${grandTotal.toFixed(0)}`}
        </button>
      </div>

      {payuData && (
        <form ref={formRef} method="POST" action={payuData.action} className="hidden">
          {Object.entries(payuData).filter(([k]) => k !== 'action').map(([k, v]) => (
            <input key={k} type="hidden" name={k} value={v} />
          ))}
        </form>
      )}
    </div>
  );
}
