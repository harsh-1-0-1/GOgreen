import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Settings, CreditCard, Truck, Mail, Globe, Palette } from 'lucide-react';
import toast from 'react-hot-toast';
import { useSettings, useUpdateSettings } from '@/hooks/useSettings';
const MENU_ITEMS = [
    { id: 'store', label: '🏬 Store Info', icon: Settings },
    { id: 'payments', label: '💳 Payments', icon: CreditCard },
    { id: 'shipping', label: '🚚 Shipping & Delivery', icon: Truck },
    { id: 'emails', label: '📧 Email Alerts', icon: Mail },
    { id: 'seo', label: '🌐 Search Engine (SEO)', icon: Globe },
    { id: 'branding', label: '🎨 Branding & Colors', icon: Palette },
];
const INPUT = 'w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary mt-1 bg-white';
// ── Sub-components defined before use ────────────────────────────────────────
function SectionHeader({ title, desc }) {
    return (_jsxs("div", { className: "border-b pb-2", children: [_jsx("h3", { className: "text-sm font-bold text-gray-800", children: title }), _jsx("p", { className: "text-[10px] text-gray-400 mt-0.5", children: desc })] }));
}
function Toggle({ value, onChange }) {
    return (_jsx("button", { type: "button", onClick: () => onChange(!value), className: `relative w-10 h-5 rounded-full transition-colors shrink-0 ${value ? 'bg-primary' : 'bg-gray-300'}`, "aria-pressed": value, children: _jsx("span", { className: `absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-[22px]' : 'translate-x-0.5'}` }) }));
}
// ── Inner form — receives already-loaded data as props ────────────────────────
// Keyed on `updated_at` by the parent so it re-mounts (and re-initialises) when
// the server data changes (e.g. after a successful save), without any useEffect.
function SettingsForm({ initial, savedAt, }) {
    const updateSettings = useUpdateSettings();
    const [activeTab, setActiveTab] = useState('store');
    const [form, setForm] = useState(initial);
    function set(key, value) {
        setForm((prev) => ({ ...prev, [key]: value }));
    }
    async function handleSave(e) {
        e.preventDefault();
        try {
            await updateSettings.mutateAsync(form);
            toast.success('Settings saved successfully.');
        }
        catch {
            toast.error('Failed to save settings. Please try again.');
        }
    }
    return (_jsxs("div", { className: "grid grid-cols-1 md:grid-cols-4 gap-5", children: [_jsx("div", { className: "md:col-span-1 bg-white rounded-xl border p-2 shadow-sm space-y-1 h-fit", children: MENU_ITEMS.map((item) => (_jsxs("button", { type: "button", onClick: () => setActiveTab(item.id), className: `w-full py-2.5 px-3 rounded-lg text-xs font-semibold text-left transition flex items-center gap-2 ${activeTab === item.id
                        ? 'bg-primary text-white'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`, children: [_jsx(item.icon, { size: 14 }), item.label] }, item.id))) }), _jsx("div", { className: "md:col-span-3 bg-white p-5 rounded-xl border shadow-sm", children: _jsxs("form", { onSubmit: handleSave, className: "space-y-4", children: [activeTab === 'store' && (_jsxs("div", { className: "space-y-4", children: [_jsx(SectionHeader, { title: "\uD83C\uDFEC Store Information", desc: "Contact details that appear in customer invoice receipts and the site footer." }), _jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "text-xs font-semibold text-gray-700", children: "Business Name" }), _jsx("input", { value: form.store_name, onChange: (e) => set('store_name', e.target.value), required: true, className: INPUT })] }), _jsxs("div", { children: [_jsx("label", { className: "text-xs font-semibold text-gray-700", children: "Support Email Address" }), _jsx("input", { type: "email", value: form.support_email, onChange: (e) => set('support_email', e.target.value), className: INPUT })] }), _jsxs("div", { children: [_jsx("label", { className: "text-xs font-semibold text-gray-700", children: "Contact Phone" }), _jsx("input", { value: form.support_phone, onChange: (e) => set('support_phone', e.target.value), placeholder: "917083883105", className: INPUT }), _jsx("p", { className: "text-[9px] text-gray-400 mt-1", children: "E.164 without +, e.g. 917083883105" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "text-xs font-semibold text-gray-700", children: "Warehouse Address" }), _jsx("textarea", { rows: 2, value: form.warehouse_address, onChange: (e) => set('warehouse_address', e.target.value), className: INPUT })] })] })), activeTab === 'payments' && (_jsxs("div", { className: "space-y-4", children: [_jsx(SectionHeader, { title: "\uD83D\uDCB3 Merchant Payment Gateways", desc: "Razorpay keys are managed via environment variables on the server. Only operational toggles live here." }), _jsxs("div", { className: "pt-2 flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs font-semibold text-gray-800", children: "Enable Cash on Delivery (COD)" }), _jsx("p", { className: "text-[9px] text-gray-400", children: "Allow customers to choose COD at checkout." })] }), _jsx(Toggle, { value: form.cod_enabled, onChange: (v) => set('cod_enabled', v) })] }), _jsxs("div", { className: "mt-3 p-3 rounded-lg bg-amber-50 border border-amber-100 text-[11px] text-amber-800 leading-relaxed", children: [_jsx("span", { className: "font-bold", children: "Razorpay API keys" }), " are configured via", ' ', _jsx("code", { className: "font-mono bg-amber-100 px-1 rounded", children: "RAZORPAY_KEY_ID" }), " and", ' ', _jsx("code", { className: "font-mono bg-amber-100 px-1 rounded", children: "RAZORPAY_KEY_SECRET" }), " env vars on the server \u2014 they are never stored in the database."] })] })), activeTab === 'shipping' && (_jsxs("div", { className: "space-y-4", children: [_jsx(SectionHeader, { title: "\uD83D\uDE9A Shipping & Delivery Thresholds", desc: "Set shipping costs and the free-delivery basket minimum." }), _jsxs("div", { className: "grid grid-cols-1 sm:grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "text-xs font-semibold text-gray-700", children: "Order Price for Free Delivery (\u20B9)" }), _jsx("input", { type: "number", min: 0, step: 1, value: form.free_shipping_threshold, onChange: (e) => set('free_shipping_threshold', Number(e.target.value)), required: true, className: INPUT }), _jsx("p", { className: "text-[9px] text-gray-400 mt-1", children: "Orders at or above this total get free delivery." })] }), _jsxs("div", { children: [_jsx("label", { className: "text-xs font-semibold text-gray-700", children: "Delivery Charge (\u20B9)" }), _jsx("input", { type: "number", min: 0, step: 1, value: form.flat_shipping_rate, onChange: (e) => set('flat_shipping_rate', Number(e.target.value)), required: true, className: INPUT }), _jsx("p", { className: "text-[9px] text-gray-400 mt-1", children: "Charged on orders below the minimum." })] })] })] })), activeTab === 'emails' && (_jsxs("div", { className: "space-y-4", children: [_jsx(SectionHeader, { title: "\uD83D\uDCE7 Email Notifications", desc: "Configure which events trigger operational emails." }), _jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "flex items-center justify-between py-1.5", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs font-semibold text-gray-800", children: "Customer Order Confirmation Emails" }), _jsx("p", { className: "text-[9px] text-gray-400", children: "Send an order summary email to the customer immediately after purchase." })] }), _jsx(Toggle, { value: form.notify_new_order, onChange: (v) => set('notify_new_order', v) })] }), _jsxs("div", { className: "flex items-center justify-between py-1.5 border-t", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs font-semibold text-gray-800", children: "Low-Stock Alerts" }), _jsx("p", { className: "text-[9px] text-gray-400", children: "Receive an alert when product stock drops below safe levels." })] }), _jsx(Toggle, { value: form.notify_low_stock, onChange: (v) => set('notify_low_stock', v) })] })] })] })), activeTab === 'seo' && (_jsxs("div", { className: "space-y-4", children: [_jsx(SectionHeader, { title: "\uD83C\uDF10 Search Engine Optimization (SEO)", desc: "Global homepage meta tags for Google and Bing." }), _jsxs("div", { children: [_jsx("label", { className: "text-xs font-semibold text-gray-700", children: "Homepage Meta Title" }), _jsx("input", { value: form.meta_title, onChange: (e) => set('meta_title', e.target.value), className: INPUT }), _jsx("p", { className: "text-[9px] text-gray-400 mt-1", children: "Recommended: 50\u201360 characters." })] }), _jsxs("div", { children: [_jsx("label", { className: "text-xs font-semibold text-gray-700", children: "Homepage Meta Description" }), _jsx("textarea", { rows: 3, value: form.meta_description, onChange: (e) => set('meta_description', e.target.value), className: INPUT }), _jsx("p", { className: "text-[9px] text-gray-400 mt-1", children: "Recommended: 120\u2013160 characters." })] })] })), activeTab === 'branding' && (_jsxs("div", { className: "space-y-4", children: [_jsx(SectionHeader, { title: "\uD83C\uDFA8 Branding & Theme", desc: "Modify primary and accent colours used across the store." }), _jsxs("div", { className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { children: [_jsx("label", { className: "text-xs font-semibold text-gray-700", children: "Primary Brand Color" }), _jsxs("div", { className: "flex gap-2 items-center mt-1", children: [_jsx("input", { type: "color", value: form.primary_color, onChange: (e) => set('primary_color', e.target.value), className: "w-8 h-8 rounded border cursor-pointer shrink-0" }), _jsx("input", { value: form.primary_color, onChange: (e) => set('primary_color', e.target.value), className: "w-full px-2.5 py-1.5 text-xs border rounded-lg uppercase" })] })] }), _jsxs("div", { children: [_jsx("label", { className: "text-xs font-semibold text-gray-700", children: "Accent Highlights Color" }), _jsxs("div", { className: "flex gap-2 items-center mt-1", children: [_jsx("input", { type: "color", value: form.accent_color, onChange: (e) => set('accent_color', e.target.value), className: "w-8 h-8 rounded border cursor-pointer shrink-0" }), _jsx("input", { value: form.accent_color, onChange: (e) => set('accent_color', e.target.value), className: "w-full px-2.5 py-1.5 text-xs border rounded-lg uppercase" })] })] })] })] })), _jsxs("div", { className: "pt-4 border-t flex items-center justify-between", children: [_jsxs("p", { className: "text-[10px] text-gray-400", children: ["Last saved:", ' ', new Date(savedAt).toLocaleString('en-IN', {
                                            dateStyle: 'medium',
                                            timeStyle: 'short',
                                        })] }), _jsx("button", { type: "submit", disabled: updateSettings.isPending, className: "ml-auto px-5 py-2.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary/95 transition shadow-sm disabled:opacity-60 disabled:cursor-not-allowed", children: updateSettings.isPending ? 'Saving…' : 'Save Settings' })] })] }) })] }));
}
// ── Page shell — handles loading / error states ───────────────────────────────
export default function SettingsAdminPage() {
    const { data: saved, isLoading, isError } = useSettings();
    if (isLoading) {
        return (_jsx("div", { className: "flex items-center justify-center h-40 text-sm text-gray-400", children: "Loading settings\u2026" }));
    }
    if (isError || !saved) {
        return (_jsx("div", { className: "flex items-center justify-center h-40 text-sm text-red-500", children: "Could not load settings. Make sure you are logged in as admin." }));
    }
    return (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-xl sm:text-2xl font-bold text-gray-900", children: "System Settings" }), _jsx("p", { className: "text-xs text-gray-500 mt-0.5", children: "Control global store details, transaction methods, delivery limits, notification rules, and branding styles." })] }), _jsx(SettingsForm, { initial: {
                    store_name: saved.store_name,
                    support_email: saved.support_email,
                    support_phone: saved.support_phone,
                    warehouse_address: saved.warehouse_address,
                    cod_enabled: saved.cod_enabled,
                    free_shipping_threshold: saved.free_shipping_threshold,
                    flat_shipping_rate: saved.flat_shipping_rate,
                    notify_new_order: saved.notify_new_order,
                    notify_low_stock: saved.notify_low_stock,
                    meta_title: saved.meta_title,
                    meta_description: saved.meta_description,
                    primary_color: saved.primary_color,
                    accent_color: saved.accent_color,
                }, savedAt: saved.updated_at }, saved.updated_at)] }));
}
