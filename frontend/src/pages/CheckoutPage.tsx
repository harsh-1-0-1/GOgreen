import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { BadgePercent, Banknote, ChevronDown, ChevronUp, CreditCard, LockKeyhole, PackageCheck, ShieldCheck, Sprout } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { clearDirectCheckoutSession, readDirectCheckoutSession } from '@/lib/directCheckout';
import type { CartItemProduct, CheckoutResponse } from '@/types';
import { useCreateAddress } from '@/hooks/useAddresses';
import { useAuthStore } from '@/store/authStore';
import { useCartStore } from '@/store/cartStore';
import { LOGO_PATH } from '@/lib/branding';
import { formatSelectedOptions } from '@/lib/variantDisplay';
import { getApiErrorDetail } from '@/lib/apiError';

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
  return `h-11 w-full rounded-lg border bg-white px-3.5 text-sm outline-none transition placeholder:text-gray-400 focus:ring-2 ${
    hasError ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : 'border-gray-200 focus:border-primary focus:ring-primary/15'
  }`;
}

function optionSummary(item: CheckoutItem) {
  if (!item.selected_options) return null;
  return formatSelectedOptions(item.selected_options, item.product.variants) || null;
}

type CheckoutItem = {
  id?: number;
  product_id: number;
  quantity: number;
  selected_options: import('@/types').SelectedOptions;
  product: CartItemProduct;
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
    <div className="space-y-4">
      <div className="space-y-3">
        {items.map((item) => (
          <div key={`${item.product_id}-${JSON.stringify(item.selected_options)}`} className="flex gap-3 items-center">
            <div className="relative h-12 w-12 shrink-0 rounded-lg border border-gray-200 bg-white">
              <img src={item.resolved_image_url || item.product.images?.[0]} alt={item.product.name} className="h-full w-full rounded-lg object-cover" />
              <span className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-gray-950 text-[10px] font-bold text-white">{item.quantity}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-gray-950 truncate">{item.product.name}</p>
              {optionSummary(item) && <p className="mt-0.5 text-[10px] text-gray-500 truncate">{optionSummary(item)}</p>}
            </div>
            <p className="text-xs font-semibold text-gray-950">{money(item.line_total)}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <input className={inputClass()} placeholder="Discount code or gift card" />
        <button className="h-11 rounded-lg border border-gray-200 bg-[#fbf8f1] px-4 text-xs sm:text-sm font-semibold text-gray-600 transition hover:border-primary">Apply</button>
      </div>

      <div className="space-y-2 text-xs">
        <div className="flex justify-between"><span>Subtotal</span><span>{money(subtotal)}</span></div>
        <div className="flex justify-between"><span>Shipping</span><span className="text-right text-gray-500">{shipping === 0 ? 'Free' : money(shipping)}</span></div>
        <div className="flex justify-between border-t border-gray-200 pt-3 text-base font-bold text-gray-900"><span>Total</span><span><span className="mr-1.5 text-[10px] font-medium text-gray-500">INR</span>{money(total)}</span></div>
      </div>
    </div>
  );

  return (
    <div className="lg:hidden">
      <button onClick={() => setMobileOpen(!mobileOpen)} className="flex w-full items-center justify-between border-y border-gray-200 bg-gray-50 px-4 py-3.5 text-left text-sm">
        <span className="flex items-center gap-1.5 font-semibold text-primary">Order summary {mobileOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</span>
        <span className="text-base font-bold text-gray-900">{money(total)}</span>
      </button>
      {mobileOpen && <div className="border-b border-gray-200 bg-[#fbfaf7] px-4 py-4">{body}</div>}
    </div>
  );
}

function DesktopSummary({ items, subtotal, shipping, total }: { items: CheckoutItem[]; subtotal: number; shipping: number; total: number }) {
  return (
    <aside className="sticky top-0 min-h-screen border-l border-gray-200 bg-[#fbfaf7] px-4 py-6 sm:px-6 lg:pl-10 lg:pr-4 lg:py-8">
      <h2 className="mb-4 text-base font-bold text-gray-900">Order Summary</h2>
      <div className="space-y-4">
        {items.map((item) => (
          <div key={`${item.product_id}-${JSON.stringify(item.selected_options)}`} className="flex gap-3 items-center">
            <div className="relative h-12 w-12 shrink-0 rounded-lg border border-gray-200 bg-white">
              <img src={item.resolved_image_url || item.product.images?.[0]} alt={item.product.name} className="h-full w-full rounded-lg object-cover" />
              <span className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-gray-950 text-[10px] font-bold text-white">{item.quantity}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-gray-950 truncate">{item.product.name}</p>
              {optionSummary(item) && <p className="mt-0.5 text-[10px] text-gray-500 truncate">{optionSummary(item)}</p>}
            </div>
            <p className="text-xs font-semibold text-gray-950">{money(item.line_total)}</p>
          </div>
        ))}
        <div className="flex gap-2">
          <input className={inputClass()} placeholder="Discount code or gift card" />
          <button className="h-11 rounded-lg border border-gray-200 bg-[#fbf8f1] px-4 text-xs sm:text-sm font-semibold text-gray-600 transition hover:border-primary">Apply</button>
        </div>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between"><span>Subtotal</span><span>{money(subtotal)}</span></div>
          <div className="flex justify-between"><span>Shipping</span><span className="text-right text-gray-500">{shipping === 0 ? 'Free' : money(shipping)}</span></div>
          <div className="flex justify-between border-t border-gray-200 pt-3 text-base font-bold text-gray-900"><span>Total</span><span><span className="mr-1.5 text-[10px] font-medium text-gray-500">INR</span>{money(total)}</span></div>
        </div>
      </div>
    </aside>
  );
}

export default function CheckoutPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const firstInputRef = useRef<HTMLInputElement>(null);
  const { user, openAuthModal } = useAuthStore();
  const cart = useCartStore();
  const createAddress = useCreateAddress();

  const [form, setForm] = useState<AddressFormState>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [shippingMethod, setShippingMethod] = useState<'standard' | 'express'>('standard');
  const [paymentMethod, setPaymentMethod] = useState<'razorpay' | 'cod'>('razorpay');
  const [billingMode, setBillingMode] = useState<'same' | 'different'>('same');
  const [paying, setPaying] = useState(false);

  const isBuyNow = new URLSearchParams(location.search).get('mode') === 'buy-now';
  const directSession = useMemo(() => (isBuyNow ? readDirectCheckoutSession() : null), [isBuyNow]);
  const items: CheckoutItem[] = isBuyNow ? directSession?.items ?? [] : cart.items;
  const subtotal = items.reduce((sum, item) => sum + item.line_total, 0);
  const shipping = subtotal >= 499 ? 0 : 49;
  const total = subtotal + shipping;
  const addressReady = Boolean(form.address && form.city && form.state && form.pincode && form.phone);

  useEffect(() => {
    firstInputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (isBuyNow && !directSession) navigate('/cart', { replace: true });
    if (!isBuyNow && cart.items.length === 0) navigate('/cart', { replace: true });
  }, [cart.items.length, directSession, isBuyNow, navigate]);

  const [lastUser, setLastUser] = useState(user);
  if (user && lastUser !== user) {
    setLastUser(user);
    setForm((prev) => ({
      ...prev,
      contact: prev.contact || user.email,
      firstName: prev.firstName || user.full_name?.split(' ')[0] || '',
      lastName: prev.lastName || user.full_name?.split(' ').slice(1).join(' ') || '',
      phone: prev.phone || user.phone || '',
    }));
  }



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

  async function openRazorpay(response: CheckoutResponse, shouldClearCart: boolean = false) {
    const data = response.razorpay_order_data;
    if (!data) return;
    if (!(import.meta.env.VITE_RAZORPAY_KEY_ID || data.key_id) || !data.order_id) {
      toast.error('Razorpay is not configured yet. Add VITE_RAZORPAY_KEY_ID in frontend or RAZORPAY_KEY_ID in backend.');
      navigate(`/orders/${response.order_id}`);
      return;
    }
    const loaded = await loadRazorpayScript();
    if (!loaded || !window.Razorpay) {
      toast.error('Could not load Razorpay. Please try again.');
      return;
    }
    new window.Razorpay({
      key: import.meta.env.VITE_RAZORPAY_KEY_ID || data.key_id,
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
        if (shouldClearCart) {
          cart.clearLocal();
        }
        toast.success('Payment completed');
        navigate(`/orders/${response.order_id}`);
      },
      modal: { ondismiss: () => toast.error('Payment was cancelled') },
    }).open();
  }

  function completeCodOrder(orderId: number) {
    clearDirectCheckoutSession();
    if (!isBuyNow) cart.clearLocal();
    toast.success('COD order placed successfully');
    navigate(`/orders/${orderId}`);
  }

  async function handlePay(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setPaying(true);
    try {
      let currentUser = user;
      if (!currentUser) {
        const email = form.contact;
        const firstName = form.firstName;
        const lastName = form.lastName;
        const fullName = `${firstName} ${lastName}`.trim();
        const phone = form.phone;
        
        await useAuthStore.getState().guestCheckoutAuth(email, fullName, phone);
        currentUser = useAuthStore.getState().user;
      }

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
          payment_method: paymentMethod,
        });
        if (paymentMethod === 'cod') completeCodOrder(data.order_id);
        else await openRazorpay(data, false);
      } else {
        const currentCartId = useCartStore.getState().cartId;
        if (!currentCartId) throw new Error('Cart not found');
        const { data } = await api.post<CheckoutResponse>('/orders/checkout', {
          address_id: savedAddress.id,
          cart_id: currentCartId,
          payment_method: paymentMethod,
        });
        if (paymentMethod === 'cod') completeCodOrder(data.order_id);
        else await openRazorpay(data, true);
      }
    } catch (err) {
      toast.error(getApiErrorDetail(err, 'Checkout failed'));
    } finally {
      setPaying(false);
    }
  }

  return (
    <div className="min-h-screen bg-white text-gray-950">
      <header className="border-b border-gray-200 bg-white px-4 py-4 text-center lg:py-5">
        <Link to="/" className="inline-block">
          <img
            src={LOGO_PATH}
            alt="Plantoga"
            className="mx-auto object-contain h-[76px] sm:h-[88px] lg:h-[96px] w-auto"
          />
        </Link>
      </header>

      <OrderSummary items={items} subtotal={subtotal} shipping={shipping} total={total} mobileOpen={summaryOpen} setMobileOpen={setSummaryOpen} />

      <main className="mx-auto grid max-w-5xl lg:grid-cols-[minmax(0,1fr)_400px]">
        <form onSubmit={handlePay} className="px-4 py-6 sm:px-6 lg:pl-8 lg:pr-12 lg:py-8">
          <section className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h1 className="text-base sm:text-lg font-bold text-gray-900">Contact</h1>
              {!user && (
                <button type="button" onClick={openAuthModal} className="text-xs sm:text-sm font-medium text-primary underline hover:text-primary-light">Sign in</button>
              )}
            </div>
            <Field label="Email or mobile phone number">
              <input ref={firstInputRef} value={form.contact} onChange={(e) => set('contact', e.target.value)} className={inputClass(Boolean(errors.contact))} placeholder="Email or mobile phone number" />
            </Field>
            <label className="flex items-center gap-2.5 text-xs sm:text-sm text-gray-700 select-none cursor-pointer">
              <input type="checkbox" checked={form.newsletter} onChange={(e) => set('newsletter', e.target.checked)} className="h-4 w-4 rounded accent-primary border-gray-300 text-primary" />
              Email me with news and offers
            </label>
          </section>

          <section className="mt-7 space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-gray-900">Delivery</h2>
            <select value={form.country} onChange={(e) => set('country', e.target.value)} className={inputClass()}>
              <option>India</option>
            </select>
            <div className="grid gap-3 sm:grid-cols-2">
              <input value={form.firstName} onChange={(e) => set('firstName', e.target.value)} className={inputClass(Boolean(errors.firstName))} placeholder="First name" />
              <input value={form.lastName} onChange={(e) => set('lastName', e.target.value)} className={inputClass(Boolean(errors.lastName))} placeholder="Last name" />
            </div>
            <input value={form.address} onChange={(e) => set('address', e.target.value)} className={inputClass(Boolean(errors.address))} placeholder="Address" />
            <input value={form.apartment} onChange={(e) => set('apartment', e.target.value)} className={inputClass()} placeholder="Apartment, suite, etc. (optional)" />
            <div className="grid gap-3 sm:grid-cols-2">
              <input value={form.city} onChange={(e) => set('city', e.target.value)} className={inputClass(Boolean(errors.city))} placeholder="City" />
              <select value={form.state} onChange={(e) => set('state', e.target.value)} className={inputClass(Boolean(errors.state))}>
                {states.map((state) => <option key={state}>{state}</option>)}
              </select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <input inputMode="numeric" value={form.pincode} onChange={(e) => set('pincode', e.target.value)} className={inputClass(Boolean(errors.pincode))} placeholder="PIN code" maxLength={6} />
              <input inputMode="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} className={inputClass(Boolean(errors.phone))} placeholder="Phone" maxLength={10} />
            </div>
            <label className="flex items-center gap-2.5 text-xs sm:text-sm text-gray-700 select-none cursor-pointer">
              <input type="checkbox" checked={form.saveInfo} onChange={(e) => set('saveInfo', e.target.checked)} className="h-4 w-4 rounded accent-primary border-gray-300 text-primary" />
              Save this information for next time
            </label>
          </section>

          <section className="mt-7 space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-gray-900">Shipping method</h2>
            {addressReady ? (
              <div className="overflow-hidden rounded-lg border border-gray-200">
                {[
                  ['standard', 'Standard Delivery', '3-5 Days', shipping === 0 ? 'Free' : money(shipping)],
                  ['express', 'Express Delivery', '1-2 Days', money(99)],
                ].map(([value, title, subtitle, price]) => (
                  <label key={value} className={`flex cursor-pointer items-center gap-3 border-b border-gray-200 p-3 last:border-0 text-sm ${shippingMethod === value ? 'border-primary bg-primary/5' : ''}`}>
                    <input type="radio" name="shipping" checked={shippingMethod === value} onChange={() => setShippingMethod(value as 'standard' | 'express')} className="h-4 w-4 accent-primary" />
                    <span className="flex-1"><span className="block font-semibold text-gray-950">{title}</span><span className="text-xs text-gray-500">{subtitle}</span></span>
                    <span className="font-semibold text-gray-950">{price}</span>
                  </label>
                ))}
              </div>
            ) : (
              <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-500">Enter your shipping address to view available shipping methods.</div>
            )}
          </section>

          <section className="mt-7 space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-gray-900">Payment</h2>
            <p className="text-xs sm:text-sm text-gray-500">All transactions are secure and encrypted.</p>
            <div className="overflow-hidden rounded-lg border border-gray-200">
              <label className={`flex cursor-pointer items-start gap-3 border-b border-gray-200 p-3 text-sm ${paymentMethod === 'razorpay' ? 'border-primary bg-primary/5' : 'bg-white'}`}>
                <input type="radio" name="payment_method" checked={paymentMethod === 'razorpay'} onChange={() => setPaymentMethod('razorpay')} className="mt-0.5 h-4 w-4 accent-primary" />
                <span className="flex-1 font-bold text-gray-950">Razorpay Secure <span className="text-xs text-gray-500 font-normal ml-1.5">(UPI, Cards, NetBanking, Wallets)</span></span>
                <CreditCard className="text-primary h-5 w-5" />
              </label>
              <label className={`flex cursor-pointer items-start gap-3 p-3 text-sm ${paymentMethod === 'cod' ? 'border-primary bg-primary/5' : 'bg-white'}`}>
                <input type="radio" name="payment_method" checked={paymentMethod === 'cod'} onChange={() => setPaymentMethod('cod')} className="mt-0.5 h-4 w-4 accent-primary" />
                <span className="flex-1 font-bold text-gray-950">Cash on Delivery <span className="text-xs text-gray-500 font-normal ml-1.5">(Pay when your order arrives)</span></span>
                <Banknote className="text-primary h-5 w-5" />
              </label>
              <div className="bg-gray-50 p-4 text-center text-xs text-gray-600">
                {paymentMethod === 'razorpay'
                  ? 'You’ll be redirected to Razorpay Secure to complete your purchase.'
                  : 'Your order will be placed now. Payment will be collected at delivery.'}
              </div>
            </div>
          </section>

          <section className="mt-7 space-y-3">
            <h2 className="text-base sm:text-lg font-bold text-gray-900">Billing address</h2>
            <div className="overflow-hidden rounded-lg border border-gray-200">
              <label className={`flex cursor-pointer items-center gap-3 border-b border-gray-200 p-3 text-sm cursor-pointer ${billingMode === 'same' ? 'border-primary bg-primary/5' : ''}`}>
                <input type="radio" checked={billingMode === 'same'} onChange={() => setBillingMode('same')} className="h-4 w-4 accent-primary" />
                <span className="font-semibold text-gray-950">Same as shipping address</span>
              </label>
              <label className={`flex cursor-pointer items-center gap-3 p-3 text-sm cursor-pointer ${billingMode === 'different' ? 'border-primary bg-primary/5' : ''}`}>
                <input type="radio" checked={billingMode === 'different'} onChange={() => setBillingMode('different')} className="h-4 w-4 accent-primary" />
                <span className="font-semibold text-gray-950">Use a different billing address</span>
              </label>
            </div>
            {billingMode === 'different' && <div className="rounded-lg bg-gray-50 p-3.5 text-xs text-gray-600">Billing form can reuse the same fields and API once separate billing storage is added.</div>}
          </section>

          <button disabled={paying || createAddress.isPending} className="mt-6 h-12 w-full rounded-lg bg-primary text-base font-semibold text-white transition hover:bg-primary/95 disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.99]">
            {paying || createAddress.isPending ? 'Processing...' : paymentMethod === 'cod' ? 'Place COD Order' : 'Pay Now'}
          </button>

          <section className="mt-8 space-y-4 border-t border-gray-100 pt-6">
            <h2 className="text-sm sm:text-base font-bold text-gray-950">10 Million+ Happy Customers Trust Us!</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                [ShieldCheck, '14-Day Replacement Guarantee', 'If your plant arrives damaged, we’ll replace it.'],
                [Sprout, 'Farm-Fresh Long-Lasting Plants', 'Grown with love and care for your home.'],
                [PackageCheck, 'Safe Secure Packaging', 'Every plant is packed with care and reaches you safely.'],
                [LockKeyhole, 'Trusted Plant Community', 'India’s growing green family.'],
              ].map(([Icon, title, text]) => (
                <div key={title as string} className="flex gap-3">
                  <Icon className="h-7 w-7 shrink-0 text-primary/70 mt-0.5" />
                  <div>
                    <h3 className="text-xs font-semibold text-gray-900">{title as string}</h3>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-gray-500">{text as string}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>


        </form>

        <div className="hidden lg:block">
          <DesktopSummary items={items} subtotal={subtotal} shipping={shipping} total={total} />
        </div>
      </main>

      <button type="button" className="fixed bottom-5 left-4 z-20 hidden rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-xs font-semibold shadow-sm hover:border-primary transition lg:inline-flex">
        <BadgePercent size={16} className="mr-1.5" /> Add discount
      </button>
    </div>
  );
}
