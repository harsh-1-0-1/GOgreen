import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BadgePercent, Banknote, ChevronDown, ChevronUp, CreditCard, LockKeyhole, PackageCheck, ShieldCheck, Sprout, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '@/lib/api';
import { clearDirectCheckoutSession, readDirectCheckoutSession } from '@/lib/directCheckout';
import { useCreateAddress } from '@/hooks/useAddresses';
import { useValidateCoupon } from '@/hooks/useCoupons';
import { useAuthStore } from '@/store/authStore';
import { useCartStore } from '@/store/cartStore';
import { formatSelectedOptions } from '@/lib/variantDisplay';
import { getApiErrorDetail } from '@/lib/apiError';
import { getShippingFee, useShippingSettings } from '@/hooks/useSettings';
const states = ['Madhya Pradesh', 'Maharashtra', 'Delhi', 'Karnataka', 'Tamil Nadu', 'Telangana', 'Uttar Pradesh', 'West Bengal'];
function money(value) {
    return `₹${value.toFixed(2)}`;
}
function loadRazorpayScript() {
    return new Promise((resolve) => {
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
function Field({ label, className = '', children }) {
    return (_jsxs("label", { className: `block ${className}`, children: [_jsx("span", { className: "sr-only", children: label }), children] }));
}
function inputClass(hasError) {
    return `h-11 w-full rounded-lg border bg-white px-3.5 text-sm outline-none transition placeholder:text-gray-400 focus:ring-2 ${hasError ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : 'border-gray-200 focus:border-primary focus:ring-primary/15'}`;
}
function optionSummary(item) {
    if (!item.selected_options)
        return null;
    return formatSelectedOptions(item.selected_options, item.product.variants) || null;
}
const emptyForm = {
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
function CouponSection({ couponCode, onCouponCodeChange, applying, error, applied, onApply, onRemove, inputRef }) {
    if (applied) {
        return (_jsxs("div", { className: "flex items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(BadgePercent, { size: 15, className: "text-primary" }), _jsxs("span", { children: [_jsx("span", { className: "font-bold text-gray-900", children: applied.code }), _jsxs("span", { className: "ml-1 text-emerald-700", children: ["applied \u2014 you saved ", money(applied.discount_amount)] })] })] }), _jsx("button", { type: "button", onClick: onRemove, className: "text-gray-400 transition hover:text-gray-700", "aria-label": "Remove discount", children: _jsx(X, { size: 15 }) })] }));
    }
    return (_jsxs("div", { children: [_jsxs("div", { className: "flex gap-2", children: [_jsx("input", { ref: inputRef, value: couponCode, onChange: (e) => onCouponCodeChange(e.target.value), placeholder: "Discount code", className: inputClass(Boolean(error)) }), _jsx("button", { type: "button", onClick: onApply, disabled: applying || !couponCode.trim(), className: "h-11 rounded-lg border border-gray-200 bg-[#fbf8f1] px-4 text-xs sm:text-sm font-semibold text-gray-600 transition hover:border-primary disabled:cursor-not-allowed disabled:opacity-60", children: applying ? '...' : 'Apply' })] }), error && _jsx("p", { className: "mt-1.5 text-[11px] text-red-500", children: error })] }));
}
function OrderSummary({ items, subtotal, shipping, discount, total, mobileOpen, setMobileOpen, couponProps, }) {
    const body = (_jsxs("div", { className: "space-y-4", children: [_jsx("div", { className: "space-y-3", children: items.map((item) => (_jsxs("div", { className: "flex gap-3 items-center", children: [_jsxs("div", { className: "relative h-12 w-12 shrink-0 rounded-lg border border-gray-200 bg-white", children: [_jsx("img", { src: item.resolved_image_url || item.product.images?.[0], alt: item.product.name, className: "h-full w-full rounded-lg object-cover" }), _jsx("span", { className: "absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-gray-950 text-[10px] font-bold text-white", children: item.quantity })] }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("p", { className: "text-xs font-semibold text-gray-950 truncate", children: item.product.name }), optionSummary(item) && _jsx("p", { className: "mt-0.5 text-[10px] text-gray-500 truncate", children: optionSummary(item) })] }), _jsx("p", { className: "text-xs font-semibold text-gray-950", children: money(item.line_total) })] }, `${item.product_id}-${JSON.stringify(item.selected_options)}`))) }), _jsx(CouponSection, { ...couponProps }), _jsxs("div", { className: "space-y-2 text-xs", children: [_jsxs("div", { className: "flex justify-between", children: [_jsx("span", { children: "Subtotal" }), _jsx("span", { children: money(subtotal) })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { children: "Delivery" }), _jsx("span", { className: "text-right text-gray-500", children: shipping === 0 ? 'Free' : money(shipping) })] }), discount > 0 && (_jsxs("div", { className: "flex justify-between text-emerald-700", children: [_jsx("span", { children: "Discount" }), _jsxs("span", { children: ["\u2212", money(discount)] })] })), _jsxs("div", { className: "flex justify-between border-t border-gray-200 pt-3 text-base font-bold text-gray-900", children: [_jsx("span", { children: "Total" }), _jsxs("span", { children: [_jsx("span", { className: "mr-1.5 text-[10px] font-medium text-gray-500", children: "INR" }), money(total)] })] })] })] }));
    return (_jsxs("div", { className: "lg:hidden", children: [_jsxs("button", { onClick: () => setMobileOpen(!mobileOpen), className: "flex w-full items-center justify-between border-y border-gray-200 bg-gray-50 px-4 py-3.5 text-left text-sm", children: [_jsxs("span", { className: "flex items-center gap-1.5 font-semibold text-primary", children: ["Order summary ", mobileOpen ? _jsx(ChevronUp, { size: 16 }) : _jsx(ChevronDown, { size: 16 })] }), _jsx("span", { className: "text-base font-bold text-gray-900", children: money(total) })] }), mobileOpen && _jsx("div", { className: "border-b border-gray-200 bg-[#fbfaf7] px-4 py-4", children: body })] }));
}
function DesktopSummary({ items, subtotal, shipping, discount, total, couponProps }) {
    return (_jsxs("aside", { className: "sticky top-0 min-h-screen border-l border-gray-200 bg-[#fbfaf7] px-4 py-6 sm:px-6 lg:pl-10 lg:pr-4 lg:py-8", children: [_jsx("h2", { className: "mb-4 text-base font-bold text-gray-900", children: "Order Summary" }), _jsxs("div", { className: "space-y-4", children: [items.map((item) => (_jsxs("div", { className: "flex gap-3 items-center", children: [_jsxs("div", { className: "relative h-12 w-12 shrink-0 rounded-lg border border-gray-200 bg-white", children: [_jsx("img", { src: item.resolved_image_url || item.product.images?.[0], alt: item.product.name, className: "h-full w-full rounded-lg object-cover" }), _jsx("span", { className: "absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-gray-950 text-[10px] font-bold text-white", children: item.quantity })] }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("p", { className: "text-xs font-semibold text-gray-950 truncate", children: item.product.name }), optionSummary(item) && _jsx("p", { className: "mt-0.5 text-[10px] text-gray-500 truncate", children: optionSummary(item) })] }), _jsx("p", { className: "text-xs font-semibold text-gray-950", children: money(item.line_total) })] }, `${item.product_id}-${JSON.stringify(item.selected_options)}`))), _jsx(CouponSection, { ...couponProps }), _jsxs("div", { className: "space-y-2 text-xs", children: [_jsxs("div", { className: "flex justify-between", children: [_jsx("span", { children: "Subtotal" }), _jsx("span", { children: money(subtotal) })] }), _jsxs("div", { className: "flex justify-between", children: [_jsx("span", { children: "Delivery" }), _jsx("span", { className: "text-right text-gray-500", children: shipping === 0 ? 'Free' : money(shipping) })] }), discount > 0 && (_jsxs("div", { className: "flex justify-between text-emerald-700", children: [_jsx("span", { children: "Discount" }), _jsxs("span", { children: ["\u2212", money(discount)] })] })), _jsxs("div", { className: "flex justify-between border-t border-gray-200 pt-3 text-base font-bold text-gray-900", children: [_jsx("span", { children: "Total" }), _jsxs("span", { children: [_jsx("span", { className: "mr-1.5 text-[10px] font-medium text-gray-500", children: "INR" }), money(total)] })] })] })] })] }));
}
export default function CheckoutPage() {
    const location = useLocation();
    const navigate = useNavigate();
    const firstInputRef = useRef(null);
    const couponInputRef = useRef(null);
    const { user, openAuthModal } = useAuthStore();
    const cart = useCartStore();
    const createAddress = useCreateAddress();
    const validateCoupon = useValidateCoupon();
    const { data: shippingSettings } = useShippingSettings();
    const [form, setForm] = useState(emptyForm);
    const [errors, setErrors] = useState({});
    const [summaryOpen, setSummaryOpen] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState('razorpay');
    const [billingMode, setBillingMode] = useState('same');
    const [paying, setPaying] = useState(false);
    const [couponCode, setCouponCode] = useState('');
    const [appliedCoupon, setAppliedCoupon] = useState(null);
    const [couponError, setCouponError] = useState('');
    const [couponApplying, setCouponApplying] = useState(false);
    const isBuyNow = new URLSearchParams(location.search).get('mode') === 'buy-now';
    const directSession = useMemo(() => (isBuyNow ? readDirectCheckoutSession() : null), [isBuyNow]);
    const items = isBuyNow ? directSession?.items ?? [] : cart.items;
    const subtotal = items.reduce((sum, item) => sum + item.line_total, 0);
    const shipping = getShippingFee(subtotal, shippingSettings);
    const discount = appliedCoupon?.discount_amount ?? 0;
    const total = Math.max(0, subtotal + shipping - discount);
    async function applyCoupon() {
        const code = couponCode.trim();
        if (!code)
            return;
        setCouponApplying(true);
        setCouponError('');
        try {
            const result = await validateCoupon.mutateAsync({ code, subtotal });
            setAppliedCoupon(result);
            toast.success(result.message);
            setCouponCode('');
        }
        catch (err) {
            setAppliedCoupon(null);
            setCouponError(getApiErrorDetail(err, 'Coupon is not valid'));
        }
        finally {
            setCouponApplying(false);
        }
    }
    function removeCoupon() {
        setAppliedCoupon(null);
        setCouponError('');
        setCouponCode('');
    }
    function focusCouponInput() {
        couponInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        couponInputRef.current?.focus();
    }
    const couponProps = {
        couponCode,
        onCouponCodeChange: (value) => {
            setCouponCode(value);
            setCouponError('');
        },
        applying: couponApplying,
        error: couponError,
        applied: appliedCoupon,
        onApply: applyCoupon,
        onRemove: removeCoupon,
        inputRef: couponInputRef,
    };
    useEffect(() => {
        firstInputRef.current?.focus();
    }, []);
    useEffect(() => {
        if (isBuyNow && !directSession)
            navigate('/cart', { replace: true });
        if (!isBuyNow && cart.items.length === 0)
            navigate('/cart', { replace: true });
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
    function set(field, value) {
        setForm((prev) => ({ ...prev, [field]: value }));
        setErrors((prev) => ({ ...prev, [field]: '' }));
    }
    function validate() {
        const next = {};
        if (!form.contact.trim())
            next.contact = 'Enter email or mobile number';
        if (!form.firstName.trim())
            next.firstName = 'Enter first name';
        if (!form.lastName.trim())
            next.lastName = 'Enter last name';
        if (!form.address.trim())
            next.address = 'Enter address';
        if (!form.city.trim())
            next.city = 'Enter city';
        if (!form.state.trim())
            next.state = 'Select state';
        if (!/^\d{6}$/.test(form.pincode.trim()))
            next.pincode = 'Enter a valid 6 digit PIN code';
        if (!/^\d{10}$/.test(form.phone.trim()))
            next.phone = 'Enter a valid 10 digit phone number';
        setErrors(next);
        return Object.keys(next).length === 0;
    }
    async function openRazorpay(response, shouldClearCart = false) {
        const data = response.razorpay_order_data;
        if (!data)
            return;
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
    function completeCodOrder(orderId) {
        clearDirectCheckoutSession();
        if (!isBuyNow)
            cart.clearLocal();
        toast.success('COD order placed successfully');
        navigate(`/orders/${orderId}`);
    }
    async function handlePay(e) {
        e.preventDefault();
        if (!validate())
            return;
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
                const { data } = await api.post('/orders/direct-checkout', {
                    address_id: savedAddress.id,
                    items: items.map((item) => ({
                        product_id: item.product_id,
                        quantity: item.quantity,
                        selected_options: item.selected_options,
                    })),
                    payment_method: paymentMethod,
                    coupon_code: appliedCoupon?.code ?? null,
                });
                if (paymentMethod === 'cod')
                    completeCodOrder(data.order_id);
                else
                    await openRazorpay(data, false);
            }
            else {
                const currentCartId = useCartStore.getState().cartId;
                if (!currentCartId)
                    throw new Error('Cart not found');
                const { data } = await api.post('/orders/checkout', {
                    address_id: savedAddress.id,
                    cart_id: currentCartId,
                    payment_method: paymentMethod,
                    coupon_code: appliedCoupon?.code ?? null,
                });
                if (paymentMethod === 'cod')
                    completeCodOrder(data.order_id);
                else
                    await openRazorpay(data, true);
            }
        }
        catch (err) {
            toast.error(getApiErrorDetail(err, 'Checkout failed'));
        }
        finally {
            setPaying(false);
        }
    }
    return (_jsxs("div", { className: "min-h-screen bg-white text-gray-950", children: [_jsx(OrderSummary, { items: items, subtotal: subtotal, shipping: shipping, discount: discount, total: total, mobileOpen: summaryOpen, setMobileOpen: setSummaryOpen, couponProps: couponProps }), _jsxs("main", { className: "mx-auto grid max-w-5xl lg:grid-cols-[minmax(0,1fr)_400px]", children: [_jsxs("form", { onSubmit: handlePay, className: "px-4 py-6 sm:px-6 lg:pl-8 lg:pr-12 lg:py-8", children: [_jsxs("section", { className: "space-y-3", children: [_jsxs("div", { className: "flex items-baseline justify-between", children: [_jsx("h1", { className: "text-base sm:text-lg font-bold text-gray-900", children: "Contact" }), !user && (_jsx("button", { type: "button", onClick: openAuthModal, className: "text-xs sm:text-sm font-medium text-primary underline hover:text-primary-light", children: "Sign in" }))] }), _jsx(Field, { label: "Email or mobile phone number", children: _jsx("input", { ref: firstInputRef, value: form.contact, onChange: (e) => set('contact', e.target.value), className: inputClass(Boolean(errors.contact)), placeholder: "Email or mobile phone number" }) }), _jsxs("label", { className: "flex items-center gap-2.5 text-xs sm:text-sm text-gray-700 select-none cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: form.newsletter, onChange: (e) => set('newsletter', e.target.checked), className: "h-4 w-4 rounded accent-primary border-gray-300 text-primary" }), "Email me with news and offers"] })] }), _jsxs("section", { className: "mt-7 space-y-3", children: [_jsx("h2", { className: "text-base sm:text-lg font-bold text-gray-900", children: "Delivery" }), _jsx("select", { value: form.country, onChange: (e) => set('country', e.target.value), className: inputClass(), children: _jsx("option", { children: "India" }) }), _jsxs("div", { className: "grid gap-3 sm:grid-cols-2", children: [_jsx("input", { value: form.firstName, onChange: (e) => set('firstName', e.target.value), className: inputClass(Boolean(errors.firstName)), placeholder: "First name" }), _jsx("input", { value: form.lastName, onChange: (e) => set('lastName', e.target.value), className: inputClass(Boolean(errors.lastName)), placeholder: "Last name" })] }), _jsx("input", { value: form.address, onChange: (e) => set('address', e.target.value), className: inputClass(Boolean(errors.address)), placeholder: "Address" }), _jsx("input", { value: form.apartment, onChange: (e) => set('apartment', e.target.value), className: inputClass(), placeholder: "Apartment, suite, etc. (optional)" }), _jsxs("div", { className: "grid gap-3 sm:grid-cols-2", children: [_jsx("input", { value: form.city, onChange: (e) => set('city', e.target.value), className: inputClass(Boolean(errors.city)), placeholder: "City" }), _jsx("select", { value: form.state, onChange: (e) => set('state', e.target.value), className: inputClass(Boolean(errors.state)), children: states.map((state) => _jsx("option", { children: state }, state)) })] }), _jsxs("div", { className: "grid gap-3 sm:grid-cols-2", children: [_jsx("input", { inputMode: "numeric", value: form.pincode, onChange: (e) => set('pincode', e.target.value), className: inputClass(Boolean(errors.pincode)), placeholder: "PIN code", maxLength: 6 }), _jsx("input", { inputMode: "tel", value: form.phone, onChange: (e) => set('phone', e.target.value), className: inputClass(Boolean(errors.phone)), placeholder: "Phone", maxLength: 10 })] }), _jsxs("label", { className: "flex items-center gap-2.5 text-xs sm:text-sm text-gray-700 select-none cursor-pointer", children: [_jsx("input", { type: "checkbox", checked: form.saveInfo, onChange: (e) => set('saveInfo', e.target.checked), className: "h-4 w-4 rounded accent-primary border-gray-300 text-primary" }), "Save this information for next time"] })] }), _jsxs("section", { className: "mt-7 space-y-3", children: [_jsx("h2", { className: "text-base sm:text-lg font-bold text-gray-900", children: "Shipping method" }), _jsx("div", { className: "overflow-hidden rounded-lg border border-gray-200", children: _jsxs("div", { className: "flex items-center gap-3 p-3 text-sm", children: [_jsxs("span", { className: "flex-1", children: [_jsx("span", { className: "block font-semibold text-gray-950", children: "Standard Delivery" }), _jsx("span", { className: "text-xs text-gray-500", children: "3-5 Days" })] }), _jsx("span", { className: "font-semibold text-gray-950", children: shipping === 0 ? 'Free' : money(shipping) })] }) })] }), _jsxs("section", { className: "mt-7 space-y-3", children: [_jsx("h2", { className: "text-base sm:text-lg font-bold text-gray-900", children: "Payment" }), _jsx("p", { className: "text-xs sm:text-sm text-gray-500", children: "All transactions are secure and encrypted." }), _jsxs("div", { className: "overflow-hidden rounded-lg border border-gray-200", children: [_jsxs("label", { className: `flex cursor-pointer items-start gap-3 border-b border-gray-200 p-3 text-sm ${paymentMethod === 'razorpay' ? 'border-primary bg-primary/5' : 'bg-white'}`, children: [_jsx("input", { type: "radio", name: "payment_method", checked: paymentMethod === 'razorpay', onChange: () => setPaymentMethod('razorpay'), className: "mt-0.5 h-4 w-4 accent-primary" }), _jsxs("span", { className: "flex-1 font-bold text-gray-950", children: ["Razorpay Secure ", _jsx("span", { className: "text-xs text-gray-500 font-normal ml-1.5", children: "(UPI, Cards, NetBanking, Wallets)" })] }), _jsx(CreditCard, { className: "text-primary h-5 w-5" })] }), _jsxs("label", { className: `flex cursor-pointer items-start gap-3 p-3 text-sm ${paymentMethod === 'cod' ? 'border-primary bg-primary/5' : 'bg-white'}`, children: [_jsx("input", { type: "radio", name: "payment_method", checked: paymentMethod === 'cod', onChange: () => setPaymentMethod('cod'), className: "mt-0.5 h-4 w-4 accent-primary" }), _jsxs("span", { className: "flex-1 font-bold text-gray-950", children: ["Cash on Delivery ", _jsx("span", { className: "text-xs text-gray-500 font-normal ml-1.5", children: "(Pay when your order arrives)" })] }), _jsx(Banknote, { className: "text-primary h-5 w-5" })] }), _jsx("div", { className: "bg-gray-50 p-4 text-center text-xs text-gray-600", children: paymentMethod === 'razorpay'
                                                    ? 'You’ll be redirected to Razorpay Secure to complete your purchase.'
                                                    : 'Your order will be placed now. Payment will be collected at delivery.' })] })] }), _jsxs("section", { className: "mt-7 space-y-3", children: [_jsx("h2", { className: "text-base sm:text-lg font-bold text-gray-900", children: "Billing address" }), _jsxs("div", { className: "overflow-hidden rounded-lg border border-gray-200", children: [_jsxs("label", { className: `flex cursor-pointer items-center gap-3 border-b border-gray-200 p-3 text-sm cursor-pointer ${billingMode === 'same' ? 'border-primary bg-primary/5' : ''}`, children: [_jsx("input", { type: "radio", checked: billingMode === 'same', onChange: () => setBillingMode('same'), className: "h-4 w-4 accent-primary" }), _jsx("span", { className: "font-semibold text-gray-950", children: "Same as shipping address" })] }), _jsxs("label", { className: `flex cursor-pointer items-center gap-3 p-3 text-sm cursor-pointer ${billingMode === 'different' ? 'border-primary bg-primary/5' : ''}`, children: [_jsx("input", { type: "radio", checked: billingMode === 'different', onChange: () => setBillingMode('different'), className: "h-4 w-4 accent-primary" }), _jsx("span", { className: "font-semibold text-gray-950", children: "Use a different billing address" })] })] }), billingMode === 'different' && _jsx("div", { className: "rounded-lg bg-gray-50 p-3.5 text-xs text-gray-600", children: "Billing form can reuse the same fields and API once separate billing storage is added." })] }), _jsx("button", { disabled: paying || createAddress.isPending, className: "mt-6 h-12 w-full rounded-lg bg-primary text-base font-semibold text-white transition hover:bg-primary/95 disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.99]", children: paying || createAddress.isPending ? 'Processing...' : paymentMethod === 'cod' ? 'Place COD Order' : 'Pay Now' }), _jsxs("section", { className: "mt-8 space-y-4 border-t border-gray-100 pt-6", children: [_jsx("h2", { className: "text-sm sm:text-base font-bold text-gray-950", children: "10 Million+ Happy Customers Trust Us!" }), _jsx("div", { className: "grid gap-4 sm:grid-cols-2", children: [
                                            [ShieldCheck, '14-Day Replacement Guarantee', 'If your plant arrives damaged, we’ll replace it.'],
                                            [Sprout, 'Farm-Fresh Long-Lasting Plants', 'Grown with love and care for your home.'],
                                            [PackageCheck, 'Safe Secure Packaging', 'Every plant is packed with care and reaches you safely.'],
                                            [LockKeyhole, 'Trusted Plant Community', 'India’s growing green family.'],
                                        ].map(([Icon, title, text]) => (_jsxs("div", { className: "flex gap-3", children: [_jsx(Icon, { className: "h-7 w-7 shrink-0 text-primary/70 mt-0.5" }), _jsxs("div", { children: [_jsx("h3", { className: "text-xs font-semibold text-gray-900", children: title }), _jsx("p", { className: "mt-0.5 text-[11px] leading-relaxed text-gray-500", children: text })] })] }, title))) })] })] }), _jsx("div", { className: "hidden lg:block", children: _jsx(DesktopSummary, { items: items, subtotal: subtotal, shipping: shipping, discount: discount, total: total, couponProps: couponProps }) })] }), _jsxs("button", { type: "button", onClick: focusCouponInput, className: "fixed bottom-5 left-4 z-20 hidden rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-xs font-semibold shadow-sm hover:border-primary transition lg:inline-flex", children: [_jsx(BadgePercent, { size: 16, className: "mr-1.5" }), " Add discount"] })] }));
}
