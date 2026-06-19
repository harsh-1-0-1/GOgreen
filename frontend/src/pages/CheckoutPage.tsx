import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { BadgePercent, ChevronDown, ChevronUp, CreditCard, Leaf, LockKeyhole, PackageCheck, ShieldCheck, Sprout } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { clearDirectCheckoutSession, readDirectCheckoutSession } from '@/lib/directCheckout';
import type { CheckoutResponse, ProductVariantColor, ProductVariantPotType } from '@/types';
import { useCreateAddress } from '@/hooks/useAddresses';
import { useAuthStore } from '@/store/authStore';
import { useCartStore } from '@/store/cartStore';

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

const states = ['Madhya Pradesh', 'Maharashtra', 'Delhi', 'Karnataka', 'Tamil Nadu', 'Telangana', 'Uttar Pradesh', 'West Bengal'];

function money(value: number) {
  return `₹${value.toFixed(2)}`;
}

function loadRazorpayScript() {
  return new Promise<boolean>((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

function Field({ label, className = '', children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <label className={`block ${className}`}>
      <span className="sr-only">{label}</span>
      {children}
    </label>
  );
}

function inputClass(hasError?: boolean) {
  return `h-14 w-full rounded-xl border bg-white px-4 text-base outline-none transition placeholder:text-gray-500 focus:ring-2 ${
    hasError ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : 'border-gray-200 focus:border-primary focus:ring-primary/15'
  }`;
}

function optionSummary(item: CheckoutItem) {
  if (!item.selected_options) return null;
  const color = item.product.variants?.colors?.find((c: ProductVariantColor) => c.slug === item.selected_options?.color)?.name || item.selected_options.color;
  const pot = item.product.variants?.pot_types?.find((p: ProductVariantPotType) => p.slug === item.selected_options?.pot_type)?.name || item.selected_options.pot_type;
  return [color && `Color: ${color}`, pot && `Pot: ${pot}`].filter(Boolean).join(' · ');
}

type CheckoutItem = {
  id?: number;
  product_id: number;
  quantity: number;
  selected_options: Record<string, string> | null;
  product: any;
  unit_price: number;
  line_total: number;
  resolved_image_url: string;
};

type AddressFormState = {
  contact: string;
  newsletter: boolean;
  country: string;
  firstName: string;
  lastName: string;
  address: string;
  apartment: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  saveInfo: boolean;
};

const emptyForm: AddressFormState = {
  contact: '',
  newsletter: true,
  country: 'India',
  firstName: '',
  lastName: '',
  address: '',
  apartment: '',
  city: '',
  state: 'Madhya Pradesh',
  pincode: '',
  phone: '',
  saveInfo: false,
};

function OrderSummary({
  items,
  subtotal,
  shipping,
  total,
  mobileOpen,
  setMobileOpen,
}: {
  items: CheckoutItem[];
  subtotal: number;
  shipping: number;
  total: number;
  mobileOpen: boolean;
  setMobileOpen: (value: boolean) => void;
}) {
  const body = (
    <div className="space-y-5">
      <div className="space-y-4">
        {items.map((item) => (
          <div key={`${item.product_id}-${JSON.stringify(item.selected_options)}`} className="flex gap-3">
            <div className="relative h-16 w-16 shrink-0 rounded-xl border border-gray-200 bg-white">
              <img src={item.resolved_image_url || item.product.images?.[0]} alt={item.product.name} className="h-full w-full rounded-xl object-cover" />
              <span className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-gray-950 text-xs font-bold text-white">{item.quantity}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-950">{item.product.name}</p>
              {optionSummary(item) && <p className="mt-1 text-xs text-gray-500">{optionSummary(item)}</p>}
            </div>
            <p className="text-sm font-semibold text-gray-950">{money(item.line_total)}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <input className={inputClass()} placeholder="Discount code or gift card" />
        <button className="h-14 rounded-xl border border-gray-200 bg-[#fbf8f1] px-5 text-sm font-bold text-gray-600 transition hover:border-primary">Apply</button>
      </div>

      <div className="space-y-3 text-base">
        <div className="flex justify-between"><span>Subtotal</span><span>{money(subtotal)}</span></div>
        <div className="flex justify-between"><span>Shipping</span><span className="text-right text-gray-500">{shipping === 0 ? 'Free' : money(shipping)}</span></div>
        <div className="flex justify-between border-t border-gray-200 pt-4 text-2xl font-bold"><span>Total</span><span><span className="mr-2 text-sm font-medium text-gray-500">INR</span>{money(total)}</span></div>
      </div>
    </div>
  );

  return (
      <div className="lg:hidden">
        <button onClick={() => setMobileOpen(!mobileOpen)} className="flex w-full items-center justify-between border-y border-gray-200 bg-gray-50 px-4 py-5 text-left">
          <span className="flex items-center gap-2 font-semibold text-primary">Order summary {mobileOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</span>
          <span className="text-xl font-bold">{money(total)}</span>
        </button>
        {mobileOpen && <div className="border-b border-gray-200 bg-[#fbfaf7] px-4 py-5">{body}</div>}
      </div>
  );
}

function DesktopSummary({ items, subtotal, shipping, total }: { items: CheckoutItem[]; subtotal: number; shipping: number; total: number }) {
  return (
    <aside className="sticky top-0 min-h-screen border-l border-gray-200 bg-[#fbfaf7] px-8 py-10">
      <h2 className="mb-6 text-lg font-bold">Order Summary</h2>
      <div className="space-y-5">
        {items.map((item) => (
          <div key={`${item.product_id}-${JSON.stringify(item.selected_options)}`} className="flex gap-3">
            <div className="relative h-16 w-16 shrink-0 rounded-xl border border-gray-200 bg-white">
              <img src={item.resolved_image_url || item.product.images?.[0]} alt={item.product.name} className="h-full w-full rounded-xl object-cover" />
              <span className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-gray-950 text-xs font-bold text-white">{item.quantity}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-950">{item.product.name}</p>
              {optionSummary(item) && <p className="mt-1 text-xs text-gray-500">{optionSummary(item)}</p>}
            </div>
            <p className="text-sm font-semibold text-gray-950">{money(item.line_total)}</p>
          </div>
        ))}
        <div className="flex gap-3">
          <input className={inputClass()} placeholder="Discount code or gift card" />
          <button className="h-14 rounded-xl border border-gray-200 bg-[#fbf8f1] px-5 text-sm font-bold text-gray-600 transition hover:border-primary">Apply</button>
        </div>
        <div className="space-y-3 text-base">
          <div className="flex justify-between"><span>Subtotal</span><span>{money(subtotal)}</span></div>
          <div className="flex justify-between"><span>Shipping</span><span className="text-right text-gray-500">{shipping === 0 ? 'Free' : money(shipping)}</span></div>
          <div className="flex justify-between border-t border-gray-200 pt-4 text-2xl font-bold"><span>Total</span><span><span className="mr-2 text-sm font-medium text-gray-500">INR</span>{money(total)}</span></div>
        </div>
      </div>
    </aside>
  );
}

export default function CheckoutPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const formRef = useRef<HTMLFormElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);
  const { user, openAuthModal } = useAuthStore();
  const cart = useCartStore();
  const createAddress = useCreateAddress();

  const [form, setForm] = useState<AddressFormState>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [shippingMethod, setShippingMethod] = useState<'standard' | 'express'>('standard');
  const [billingMode, setBillingMode] = useState<'same' | 'different'>('same');
  const [paying, setPaying] = useState(false);
  const [payuData, setPayuData] = useState<Record<string, string> | null>(null);

  const isBuyNow = new URLSearchParams(location.search).get('mode') === 'buy-now';
  const directSession = useMemo(() => readDirectCheckoutSession(), [location.search]);
  const items: CheckoutItem[] = isBuyNow ? directSession?.items ?? [] : cart.items;
  const subtotal = items.reduce((sum, item) => sum + item.line_total, 0);
  const shipping = subtotal >= 499 ? 0 : 49;
  const total = subtotal + shipping;
  const addressReady = Boolean(form.address && form.city && form.state && form.pincode && form.phone);

  useEffect(() => {
    firstInputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!user) openAuthModal();
    if (isBuyNow && !directSession) navigate('/cart', { replace: true });
    if (!isBuyNow && cart.items.length === 0 && !payuData) navigate('/cart', { replace: true });
  }, [cart.items.length, directSession, isBuyNow, navigate, openAuthModal, payuData, user]);

  useEffect(() => {
    if (user) {
      setForm((prev) => ({
        ...prev,
        contact: prev.contact || user.email,
        firstName: prev.firstName || user.full_name?.split(' ')[0] || '',
        lastName: prev.lastName || user.full_name?.split(' ').slice(1).join(' ') || '',
        phone: prev.phone || user.phone || '',
      }));
    }
  }, [user]);

  useEffect(() => {
    if (payuData && formRef.current) formRef.current.submit();
  }, [payuData]);

  function set(field: keyof AddressFormState, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: '' }));
  }

  function validate() {
    const next: Record<string, string> = {};
    if (!form.contact.trim()) next.contact = 'Enter email or mobile number';
    if (!form.firstName.trim()) next.firstName = 'Enter first name';
    if (!form.lastName.trim()) next.lastName = 'Enter last name';
    if (!form.address.trim()) next.address = 'Enter address';
    if (!form.city.trim()) next.city = 'Enter city';
    if (!form.state.trim()) next.state = 'Select state';
    if (!/^\d{6}$/.test(form.pincode.trim())) next.pincode = 'Enter a valid 6 digit PIN code';
    if (!/^\d{10}$/.test(form.phone.trim())) next.phone = 'Enter a valid 10 digit phone number';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function openRazorpay(response: CheckoutResponse) {
    const data = response.razorpay_order_data;
    if (!data) return;
    if (!data.key_id || !data.order_id) {
      toast.error('Razorpay is not configured yet. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.');
      navigate(`/orders/${response.order_id}`);
      return;
    }
    const loaded = await loadRazorpayScript();
    if (!loaded || !window.Razorpay) {
      toast.error('Could not load Razorpay. Please try again.');
      return;
    }
    new window.Razorpay({
      key: data.key_id,
      amount: data.amount,
      currency: data.currency,
      name: data.name,
      description: data.description,
      order_id: data.order_id,
      prefill: data.prefill,
      notes: data.notes,
      theme: { color: '#15945b' },
      handler: () => {
        clearDirectCheckoutSession();
        toast.success('Payment completed');
        navigate(`/orders/${response.order_id}`);
      },
      modal: { ondismiss: () => toast.error('Payment was cancelled') },
    }).open();
  }

  async function handlePay(e: FormEvent) {
    e.preventDefault();
    if (!user) {
      openAuthModal();
      return;
    }
    if (!validate()) return;
    setPaying(true);
    try {
      const savedAddress = await createAddress.mutateAsync({
        full_name: `${form.firstName} ${form.lastName}`.trim(),
        phone: form.phone,
        line1: form.address,
        line2: form.apartment || null,
        city: form.city,
        state: form.state,
        pincode: form.pincode,
        is_default: form.saveInfo,
      });

      if (isBuyNow) {
        const { data } = await api.post<CheckoutResponse>('/orders/direct-checkout', {
          address_id: savedAddress.id,
          items: items.map((item) => ({
            product_id: item.product_id,
            quantity: item.quantity,
            selected_options: item.selected_options,
          })),
        });
        await openRazorpay(data);
      } else {
        if (!cart.cartId) throw new Error('Cart not found');
        const { data } = await api.post<CheckoutResponse>('/orders/checkout', { address_id: savedAddress.id, cart_id: cart.cartId });
        cart.clearLocal();
        if (data.payu_form_data) setPayuData(data.payu_form_data);
        toast.success('Order placed! Redirecting to payment...');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || err.message || 'Checkout failed');
    } finally {
      setPaying(false);
    }
  }

  return (
    <div className="min-h-screen bg-white text-gray-950">
      <header className="border-b border-gray-200 bg-white px-4 py-7 text-center lg:py-9">
        <Link to="/" className="inline-flex items-center gap-2 text-4xl font-black tracking-tight text-primary">
          <Leaf className="h-10 w-10" /> Plantoga
        </Link>
      </header>

      <OrderSummary items={items} subtotal={subtotal} shipping={shipping} total={total} mobileOpen={summaryOpen} setMobileOpen={setSummaryOpen} />

      <main className="mx-auto grid max-w-7xl lg:grid-cols-[minmax(0,1fr)_520px]">
        <form onSubmit={handlePay} className="px-4 py-8 sm:px-8 lg:px-12 lg:py-10">
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-bold">Contact</h1>
              <button type="button" onClick={openAuthModal} className="text-lg font-medium text-primary underline">Sign in</button>
            </div>
            <Field label="Email or mobile phone number">
              <input ref={firstInputRef} value={form.contact} onChange={(e) => set('contact', e.target.value)} className={inputClass(Boolean(errors.contact))} placeholder="Email or mobile phone number" />
            </Field>
            <label className="flex items-center gap-3 text-lg">
              <input type="checkbox" checked={form.newsletter} onChange={(e) => set('newsletter', e.target.checked)} className="h-7 w-7 rounded accent-primary" />
              Email me with news and offers
            </label>
          </section>

          <section className="mt-10 space-y-4">
            <h2 className="text-3xl font-bold">Delivery</h2>
            <select value={form.country} onChange={(e) => set('country', e.target.value)} className={inputClass()}>
              <option>India</option>
            </select>
            <div className="grid gap-4 sm:grid-cols-2">
              <input value={form.firstName} onChange={(e) => set('firstName', e.target.value)} className={inputClass(Boolean(errors.firstName))} placeholder="First name" />
              <input value={form.lastName} onChange={(e) => set('lastName', e.target.value)} className={inputClass(Boolean(errors.lastName))} placeholder="Last name" />
            </div>
            <input value={form.address} onChange={(e) => set('address', e.target.value)} className={inputClass(Boolean(errors.address))} placeholder="Address" />
            <input value={form.apartment} onChange={(e) => set('apartment', e.target.value)} className={inputClass()} placeholder="Apartment, suite, etc. (optional)" />
            <input value={form.city} onChange={(e) => set('city', e.target.value)} className={inputClass(Boolean(errors.city))} placeholder="City" />
            <select value={form.state} onChange={(e) => set('state', e.target.value)} className={inputClass(Boolean(errors.state))}>
              {states.map((state) => <option key={state}>{state}</option>)}
            </select>
            <input inputMode="numeric" value={form.pincode} onChange={(e) => set('pincode', e.target.value)} className={inputClass(Boolean(errors.pincode))} placeholder="PIN code" maxLength={6} />
            <input inputMode="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} className={inputClass(Boolean(errors.phone))} placeholder="Phone" maxLength={10} />
            <label className="flex items-center gap-3 text-lg">
              <input type="checkbox" checked={form.saveInfo} onChange={(e) => set('saveInfo', e.target.checked)} className="h-7 w-7 rounded accent-primary" />
              Save this information for next time
            </label>
          </section>

          <section className="mt-10 space-y-4">
            <h2 className="text-2xl font-bold">Shipping method</h2>
            {addressReady ? (
              <div className="overflow-hidden rounded-xl border border-gray-200">
                {[
                  ['standard', 'Standard Delivery', '3-5 Days', shipping === 0 ? 'Free' : money(shipping)],
                  ['express', 'Express Delivery', '1-2 Days', money(99)],
                ].map(([value, title, subtitle, price]) => (
                  <label key={value} className={`flex cursor-pointer items-center gap-3 border-b border-gray-200 p-4 last:border-0 ${shippingMethod === value ? 'border-primary bg-primary/5' : ''}`}>
                    <input type="radio" name="shipping" checked={shippingMethod === value} onChange={() => setShippingMethod(value as 'standard' | 'express')} className="h-5 w-5 accent-primary" />
                    <span className="flex-1"><span className="block font-bold">{title}</span><span className="text-sm text-gray-500">{subtitle}</span></span>
                    <span className="font-bold">{price}</span>
                  </label>
                ))}
              </div>
            ) : (
              <div className="rounded-xl bg-gray-100 p-5 text-lg text-gray-500">Enter your shipping address to view available shipping methods.</div>
            )}
          </section>

          <section className="mt-10 space-y-4">
            <h2 className="text-3xl font-bold">Payment</h2>
            <p className="text-lg text-gray-500">All transactions are secure and encrypted.</p>
            <div className="overflow-hidden rounded-xl border border-gray-200">
              <label className="flex items-start gap-3 border-2 border-primary p-4">
                <input type="radio" checked readOnly className="mt-1 h-5 w-5 accent-primary" />
                <span className="flex-1 text-lg font-bold">Razorpay Secure<br /><span className="text-base">(UPI, Cards, NetBanking, Wallets)</span></span>
                <CreditCard className="text-primary" />
              </label>
              <div className="bg-gray-50 p-6 text-center text-lg">You’ll be redirected to Razorpay Secure to complete your purchase.</div>
            </div>
          </section>

          <section className="mt-10 space-y-4">
            <h2 className="text-2xl font-bold">Billing address</h2>
            <div className="overflow-hidden rounded-xl border border-gray-200">
              <label className={`flex cursor-pointer items-center gap-3 border-b p-4 text-lg ${billingMode === 'same' ? 'border-primary bg-primary/5' : 'border-gray-200'}`}>
                <input type="radio" checked={billingMode === 'same'} onChange={() => setBillingMode('same')} className="h-5 w-5 accent-primary" />
                Same as shipping address
              </label>
              <label className="flex cursor-pointer items-center gap-3 p-4 text-lg">
                <input type="radio" checked={billingMode === 'different'} onChange={() => setBillingMode('different')} className="h-5 w-5 accent-primary" />
                Use a different billing address
              </label>
            </div>
            {billingMode === 'different' && <div className="rounded-xl bg-gray-50 p-4 text-sm text-gray-600">Billing form can reuse the same fields and API once separate billing storage is added.</div>}
          </section>

          <button disabled={paying || createAddress.isPending} className="mt-8 h-16 w-full rounded-xl bg-primary text-xl font-bold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60">
            {paying || createAddress.isPending ? 'Processing...' : 'Pay Now'}
          </button>

          <section className="mt-10 space-y-6">
            <h2 className="text-2xl font-bold">10 Million+ Happy Customers Trust Us!</h2>
            {[
              [ShieldCheck, '14-Day Replacement Guarantee', 'If your plant arrives damaged, we’ll replace it.'],
              [Sprout, 'Farm-Fresh Long-Lasting Plants', 'Grown with love and care for your home.'],
              [PackageCheck, 'Safe Secure Packaging', 'Every plant is packed with care and reaches you safely.'],
              [LockKeyhole, 'Trusted Plant Community', 'India’s growing green family and you’re now a part of it.'],
            ].map(([Icon, title, text]) => (
              <div key={title as string} className="flex gap-5">
                <Icon className="mt-1 h-14 w-14 shrink-0 text-gray-400" />
                <div><h3 className="text-xl font-bold">{title as string}</h3><p className="mt-2 text-lg leading-relaxed text-gray-500">{text as string}</p></div>
              </div>
            ))}
          </section>

          {payuData && (
            <form ref={formRef} method="POST" action={payuData.action} className="hidden">
              {Object.entries(payuData).filter(([k]) => k !== 'action').map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
            </form>
          )}
        </form>

        <div className="hidden lg:block">
          <DesktopSummary items={items} subtotal={subtotal} shipping={shipping} total={total} />
        </div>
      </main>

      <button type="button" className="fixed bottom-5 left-4 z-20 hidden rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-bold shadow-sm lg:inline-flex">
        <BadgePercent size={18} /> Add discount
      </button>
    </div>
  );
}
