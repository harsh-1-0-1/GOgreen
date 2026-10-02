import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Tag, Percent, IndianRupee, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCoupons, useCreateCoupon, useDeleteCoupon, useUpdateCoupon } from '@/hooks/useCoupons';
import Spinner from '@/components/ui/Spinner';
import { getApiErrorDetail } from '@/lib/apiError';
export default function CouponsAdminPage() {
    const { data: coupons = [], isLoading } = useCoupons();
    const createCoupon = useCreateCoupon();
    const updateCoupon = useUpdateCoupon();
    const deleteCoupon = useDeleteCoupon();
    const [code, setCode] = useState('');
    const [type, setType] = useState('percent');
    const [value, setValue] = useState('');
    const [minAmount, setMinAmount] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const handleCreate = async (e) => {
        e.preventDefault();
        if (!code.trim() || !value || !minAmount) {
            toast.error('Please fill in all fields');
            return;
        }
        setSubmitting(true);
        try {
            const created = await createCoupon.mutateAsync({
                code: code.trim(),
                type,
                value: Number(value),
                min_amount: Number(minAmount),
                is_active: true,
            });
            toast.success(`Coupon code "${created.code}" created successfully!`);
            setCode('');
            setValue('');
            setMinAmount('');
        }
        catch (err) {
            toast.error(getApiErrorDetail(err, 'Could not create coupon'));
        }
        finally {
            setSubmitting(false);
        }
    };
    const handleToggle = async (coupon) => {
        try {
            await updateCoupon.mutateAsync({ id: coupon.id, body: { is_active: !coupon.is_active } });
            toast.success(`Coupon "${coupon.code}" ${coupon.is_active ? 'paused' : 'activated'}`);
        }
        catch (err) {
            toast.error(getApiErrorDetail(err, 'Could not update coupon'));
        }
    };
    const handleDelete = async (id, codeStr) => {
        if (!confirm(`Are you sure you want to delete coupon code "${codeStr}"?`))
            return;
        try {
            await deleteCoupon.mutateAsync(id);
            toast.success('Coupon code deleted');
        }
        catch (err) {
            toast.error(getApiErrorDetail(err, 'Could not delete coupon'));
        }
    };
    const inputClass = "w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary";
    return (_jsxs("div", { className: "space-y-5", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-xl sm:text-2xl font-bold text-gray-900", children: "Coupons & Discounts" }), _jsx("p", { className: "text-xs text-gray-500 mt-0.5", children: "Generate coupon codes, configure flat reductions, and incentivize client orders." })] }), _jsxs("div", { className: "bg-emerald-50 border border-emerald-100 rounded-xl p-4 shadow-sm grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-gray-600 leading-normal", children: [_jsxs("div", { className: "flex gap-2", children: [_jsx("div", { className: "bg-primary/10 w-9 h-9 rounded-lg flex items-center justify-center text-primary shrink-0", children: _jsx(Percent, { size: 18 }) }), _jsxs("div", { children: [_jsx("span", { className: "font-bold text-primary", children: "Percentage Discount (%)" }), _jsxs("p", { className: "text-[11px] text-gray-500 mt-0.5", children: ["Deducts a slice off the total bill. Example: ", _jsx("strong", { children: "15% OFF" }), " on \u20B91,000 saves \u20B9150 for the customer."] })] })] }), _jsxs("div", { className: "flex gap-2", children: [_jsx("div", { className: "bg-primary/10 w-9 h-9 rounded-lg flex items-center justify-center text-primary shrink-0", children: _jsx(IndianRupee, { size: 18 }) }), _jsxs("div", { children: [_jsx("span", { className: "font-bold text-primary", children: "Fixed Flat Discount (\u20B9)" }), _jsxs("p", { className: "text-[11px] text-gray-500 mt-0.5", children: ["Deducts a precise flat rupee amount. Example: ", _jsx("strong", { children: "\u20B9200 OFF" }), " reduces a \u20B91,500 order down to \u20B91,300."] })] })] })] }), _jsxs("div", { className: "grid grid-cols-1 md:grid-cols-3 gap-5", children: [_jsxs("div", { className: "md:col-span-1 bg-white p-4 rounded-xl border shadow-sm space-y-4 h-fit", children: [_jsx("h2", { className: "text-sm font-bold text-gray-800 pb-2 border-b", children: "Create Promo Code" }), _jsxs("form", { onSubmit: handleCreate, className: "space-y-3", children: [_jsxs("div", { children: [_jsx("label", { className: "text-xs font-semibold text-gray-700 block mb-1", children: "Coupon Code *" }), _jsx("input", { placeholder: "e.g. FESTIVE200", value: code, onChange: (e) => setCode(e.target.value), required: true, className: "w-full px-3 py-2 text-xs border rounded-lg focus:outline-none uppercase" }), _jsx("p", { className: "text-[9px] text-gray-400 mt-1", children: "Codes are auto-capitalized. Do not include spaces." })] }), _jsxs("div", { children: [_jsx("label", { className: "text-xs font-semibold text-gray-700 block mb-1", children: "Discount Type" }), _jsxs("div", { className: "flex gap-2 border rounded-lg p-0.5 bg-gray-50 text-xs font-bold text-gray-600", children: [_jsxs("button", { type: "button", onClick: () => setType('percent'), className: `flex-1 py-1 rounded flex items-center justify-center gap-1 transition ${type === 'percent' ? 'bg-white text-primary shadow-xs' : 'hover:bg-gray-100'}`, children: [_jsx(Percent, { size: 12 }), " Percentage"] }), _jsxs("button", { type: "button", onClick: () => setType('fixed'), className: `flex-1 py-1 rounded flex items-center justify-center gap-1 transition ${type === 'fixed' ? 'bg-white text-primary shadow-xs' : 'hover:bg-gray-100'}`, children: [_jsx(IndianRupee, { size: 12 }), " Fixed Flat"] })] })] }), _jsxs("div", { className: "grid grid-cols-2 gap-3", children: [_jsxs("div", { children: [_jsxs("label", { className: "text-xs font-semibold text-gray-700 block mb-1", children: [type === 'percent' ? 'Percentage (%)' : 'Amount (₹)', " *"] }), _jsx("input", { type: "number", placeholder: type === 'percent' ? '15' : '200', value: value, onChange: (e) => setValue(e.target.value), required: true, min: 1, step: "any", className: inputClass })] }), _jsxs("div", { children: [_jsx("label", { className: "text-xs font-semibold text-gray-700 block mb-1", children: "Min Order Total (\u20B9) *" }), _jsx("input", { type: "number", placeholder: "999", value: minAmount, onChange: (e) => setMinAmount(e.target.value), required: true, min: 0, step: "any", className: inputClass })] })] }), _jsx("div", { className: "rounded-lg bg-gray-50 border p-3 text-[10px] text-gray-500 leading-normal", children: type === 'percent' ? (_jsxs("p", { children: ["\uD83D\uDCA1 Formula: Orders above \u20B9", minAmount || 'X', " will get ", value || 'Y', "% deducted from cart total before delivery tax."] })) : (_jsxs("p", { children: ["\uD83D\uDCA1 Formula: Orders above \u20B9", minAmount || 'X', " will get flat \u20B9", value || 'Y', " subtracted directly at checkout."] })) }), _jsxs("button", { type: "submit", disabled: submitting || createCoupon.isPending, className: "w-full py-2.5 bg-primary text-white text-xs rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-primary/95 transition disabled:opacity-60", children: [_jsx(Plus, { size: 14 }), " Add Coupon"] })] })] }), _jsxs("div", { className: "md:col-span-2 bg-white p-4 rounded-xl border shadow-sm", children: [_jsx("h2", { className: "text-sm font-bold text-gray-800 pb-2 border-b mb-3", children: "Coupons Ledger" }), isLoading ? (_jsx(Spinner, { className: "py-10" })) : coupons.length === 0 ? (_jsx("div", { className: "py-10 text-center text-xs text-gray-400", children: "No coupons yet. Create your first promo code to get started." })) : (_jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-xs text-left", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b text-gray-500 bg-gray-50", children: [_jsx("th", { className: "p-3 font-semibold", children: "Promo Code" }), _jsx("th", { className: "p-3 font-semibold", children: "Deduction Value" }), _jsx("th", { className: "p-3 font-semibold", children: "Min Basket Limit" }), _jsx("th", { className: "p-3 font-semibold text-center", children: "Times Claimed" }), _jsx("th", { className: "p-3 font-semibold text-center", children: "Active Status" }), _jsx("th", { className: "p-3 font-semibold text-right w-16", children: "Actions" })] }) }), _jsx("tbody", { children: coupons.map((c) => (_jsxs("tr", { className: "border-b last:border-0 hover:bg-gray-50/50", children: [_jsxs("td", { className: "p-3 font-bold text-gray-900 flex items-center gap-1.5", children: [_jsx(Tag, { size: 13, className: "text-primary-light" }), c.code] }), _jsx("td", { className: "p-3 font-medium", children: c.type === 'percent' ? `${c.value}% Off` : `₹${c.value} Flat` }), _jsxs("td", { className: "p-3 text-gray-600", children: ["\u20B9", c.min_amount] }), _jsxs("td", { className: "p-3 text-center font-bold text-primary", children: [c.times_used, " claims"] }), _jsx("td", { className: "p-3 text-center", children: _jsx("button", { onClick: () => handleToggle(c), disabled: updateCoupon.isPending, className: `text-[9px] font-bold px-2 py-0.5 rounded border disabled:opacity-60 ${c.is_active
                                                                ? 'bg-green-50 text-green-700 border-green-200'
                                                                : 'bg-gray-100 text-gray-500 border-gray-200'}`, children: c.is_active ? 'Active' : 'Paused' }) }), _jsx("td", { className: "p-3 text-right", children: _jsx("button", { onClick: () => handleDelete(c.id, c.code), disabled: deleteCoupon.isPending, className: "p-1.5 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition disabled:opacity-60", children: _jsx(Trash2, { size: 13 }) }) })] }, c.id))) })] }) }))] })] })] }));
}
