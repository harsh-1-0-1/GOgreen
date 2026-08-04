import { useState } from 'react';
import { Settings, CreditCard, Truck, Mail, Globe, Palette } from 'lucide-react';
import toast from 'react-hot-toast';
import { useSettings, useUpdateSettings } from '@/hooks/useSettings';
import type { StoreSettings } from '@/hooks/useSettings';

type Tab = 'store' | 'payments' | 'shipping' | 'emails' | 'seo' | 'branding';
type FormValues = Omit<StoreSettings, 'id' | 'updated_at'>;

const MENU_ITEMS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'store',    label: '🏬 Store Info',          icon: Settings   },
  { id: 'payments', label: '💳 Payments',             icon: CreditCard },
  { id: 'shipping', label: '🚚 Shipping & Delivery',  icon: Truck      },
  { id: 'emails',   label: '📧 Email Alerts',         icon: Mail       },
  { id: 'seo',      label: '🌐 Search Engine (SEO)',  icon: Globe      },
  { id: 'branding', label: '🎨 Branding & Colors',    icon: Palette    },
];

const INPUT = 'w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary mt-1 bg-white';

// ── Sub-components defined before use ────────────────────────────────────────

function SectionHeader({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="border-b pb-2">
      <h3 className="text-sm font-bold text-gray-800">{title}</h3>
      <p className="text-[10px] text-gray-400 mt-0.5">{desc}</p>
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${value ? 'bg-primary' : 'bg-gray-300'}`}
      aria-pressed={value}
    >
      <span
        className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-[22px]' : 'translate-x-0.5'}`}
      />
    </button>
  );
}

// ── Inner form — receives already-loaded data as props ────────────────────────
// Keyed on `updated_at` by the parent so it re-mounts (and re-initialises) when
// the server data changes (e.g. after a successful save), without any useEffect.

function SettingsForm({
  initial,
  savedAt,
}: {
  initial: FormValues;
  savedAt: string;
}) {
  const updateSettings = useUpdateSettings();
  const [activeTab, setActiveTab] = useState<Tab>('store');
  const [form, setForm] = useState<FormValues>(initial);

  function set<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    try {
      await updateSettings.mutateAsync(form);
      toast.success('Settings saved successfully.');
    } catch {
      toast.error('Failed to save settings. Please try again.');
    }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
      {/* Left tab nav */}
      <div className="md:col-span-1 bg-white rounded-xl border p-2 shadow-sm space-y-1 h-fit">
        {MENU_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setActiveTab(item.id)}
            className={`w-full py-2.5 px-3 rounded-lg text-xs font-semibold text-left transition flex items-center gap-2 ${
              activeTab === item.id
                ? 'bg-primary text-white'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <item.icon size={14} />
            {item.label}
          </button>
        ))}
      </div>

      {/* Right form */}
      <div className="md:col-span-3 bg-white p-5 rounded-xl border shadow-sm">
        <form onSubmit={handleSave} className="space-y-4">

          {/* ── Store Info ── */}
          {activeTab === 'store' && (
            <div className="space-y-4">
              <SectionHeader
                title="🏬 Store Information"
                desc="Contact details that appear in customer invoice receipts and the site footer."
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-700">Business Name</label>
                  <input
                    value={form.store_name}
                    onChange={(e) => set('store_name', e.target.value)}
                    required
                    className={INPUT}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700">Support Email Address</label>
                  <input
                    type="email"
                    value={form.support_email}
                    onChange={(e) => set('support_email', e.target.value)}
                    className={INPUT}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700">Contact Phone</label>
                  <input
                    value={form.support_phone}
                    onChange={(e) => set('support_phone', e.target.value)}
                    placeholder="917083883105"
                    className={INPUT}
                  />
                  <p className="text-[9px] text-gray-400 mt-1">E.164 without +, e.g. 917083883105</p>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700">Warehouse Address</label>
                <textarea
                  rows={2}
                  value={form.warehouse_address}
                  onChange={(e) => set('warehouse_address', e.target.value)}
                  className={INPUT}
                />
              </div>
            </div>
          )}

          {/* ── Payments ── */}
          {activeTab === 'payments' && (
            <div className="space-y-4">
              <SectionHeader
                title="💳 Merchant Payment Gateways"
                desc="Razorpay keys are managed via environment variables on the server. Only operational toggles live here."
              />
              <div className="pt-2 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-gray-800">Enable Cash on Delivery (COD)</p>
                  <p className="text-[9px] text-gray-400">Allow customers to choose COD at checkout.</p>
                </div>
                <Toggle value={form.cod_enabled} onChange={(v) => set('cod_enabled', v)} />
              </div>
              <div className="mt-3 p-3 rounded-lg bg-amber-50 border border-amber-100 text-[11px] text-amber-800 leading-relaxed">
                <span className="font-bold">Razorpay API keys</span> are configured via{' '}
                <code className="font-mono bg-amber-100 px-1 rounded">RAZORPAY_KEY_ID</code> and{' '}
                <code className="font-mono bg-amber-100 px-1 rounded">RAZORPAY_KEY_SECRET</code> env vars
                on the server — they are never stored in the database.
              </div>
            </div>
          )}

          {/* ── Shipping ── */}
          {activeTab === 'shipping' && (
            <div className="space-y-4">
              <SectionHeader
                title="🚚 Shipping & Delivery Thresholds"
                desc="Set shipping costs and the free-delivery basket minimum."
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-700">Free Delivery Minimum (₹)</label>
                  <input
                    type="number"
                    min={0}
                    value={form.free_shipping_threshold}
                    onChange={(e) => set('free_shipping_threshold', Number(e.target.value))}
                    required
                    className={INPUT}
                  />
                  <p className="text-[9px] text-gray-400 mt-1">Orders at or above this total get free delivery.</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700">Flat Shipping Charge (₹)</label>
                  <input
                    type="number"
                    min={0}
                    value={form.flat_shipping_rate}
                    onChange={(e) => set('flat_shipping_rate', Number(e.target.value))}
                    required
                    className={INPUT}
                  />
                  <p className="text-[9px] text-gray-400 mt-1">Charged on orders below the minimum.</p>
                </div>
              </div>
            </div>
          )}

          {/* ── Emails ── */}
          {activeTab === 'emails' && (
            <div className="space-y-4">
              <SectionHeader
                title="📧 Email Notifications"
                desc="Configure which events trigger operational emails."
              />
              <div className="space-y-3">
                <div className="flex items-center justify-between py-1.5">
                  <div>
                    <p className="text-xs font-semibold text-gray-800">Customer Order Confirmation Emails</p>
                    <p className="text-[9px] text-gray-400">Send an order summary email to the customer immediately after purchase.</p>
                  </div>
                  <Toggle value={form.notify_new_order} onChange={(v) => set('notify_new_order', v)} />
                </div>
                <div className="flex items-center justify-between py-1.5 border-t">
                  <div>
                    <p className="text-xs font-semibold text-gray-800">Low-Stock Alerts</p>
                    <p className="text-[9px] text-gray-400">Receive an alert when product stock drops below safe levels.</p>
                  </div>
                  <Toggle value={form.notify_low_stock} onChange={(v) => set('notify_low_stock', v)} />
                </div>
              </div>
            </div>
          )}

          {/* ── SEO ── */}
          {activeTab === 'seo' && (
            <div className="space-y-4">
              <SectionHeader
                title="🌐 Search Engine Optimization (SEO)"
                desc="Global homepage meta tags for Google and Bing."
              />
              <div>
                <label className="text-xs font-semibold text-gray-700">Homepage Meta Title</label>
                <input
                  value={form.meta_title}
                  onChange={(e) => set('meta_title', e.target.value)}
                  className={INPUT}
                />
                <p className="text-[9px] text-gray-400 mt-1">Recommended: 50–60 characters.</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700">Homepage Meta Description</label>
                <textarea
                  rows={3}
                  value={form.meta_description}
                  onChange={(e) => set('meta_description', e.target.value)}
                  className={INPUT}
                />
                <p className="text-[9px] text-gray-400 mt-1">Recommended: 120–160 characters.</p>
              </div>
            </div>
          )}

          {/* ── Branding ── */}
          {activeTab === 'branding' && (
            <div className="space-y-4">
              <SectionHeader
                title="🎨 Branding & Theme"
                desc="Modify primary and accent colours used across the store."
              />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-gray-700">Primary Brand Color</label>
                  <div className="flex gap-2 items-center mt-1">
                    <input
                      type="color"
                      value={form.primary_color}
                      onChange={(e) => set('primary_color', e.target.value)}
                      className="w-8 h-8 rounded border cursor-pointer shrink-0"
                    />
                    <input
                      value={form.primary_color}
                      onChange={(e) => set('primary_color', e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs border rounded-lg uppercase"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700">Accent Highlights Color</label>
                  <div className="flex gap-2 items-center mt-1">
                    <input
                      type="color"
                      value={form.accent_color}
                      onChange={(e) => set('accent_color', e.target.value)}
                      className="w-8 h-8 rounded border cursor-pointer shrink-0"
                    />
                    <input
                      value={form.accent_color}
                      onChange={(e) => set('accent_color', e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs border rounded-lg uppercase"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Save */}
          <div className="pt-4 border-t flex items-center justify-between">
            <p className="text-[10px] text-gray-400">
              Last saved:{' '}
              {new Date(savedAt).toLocaleString('en-IN', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </p>
            <button
              type="submit"
              disabled={updateSettings.isPending}
              className="ml-auto px-5 py-2.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary/95 transition shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {updateSettings.isPending ? 'Saving…' : 'Save Settings'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}

// ── Page shell — handles loading / error states ───────────────────────────────

export default function SettingsAdminPage() {
  const { data: saved, isLoading, isError } = useSettings();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-gray-400">
        Loading settings…
      </div>
    );
  }

  if (isError || !saved) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-red-500">
        Could not load settings. Make sure you are logged in as admin.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">System Settings</h1>
        <p className="text-xs text-gray-500 mt-0.5">
          Control global store details, transaction methods, delivery limits, notification rules, and branding styles.
        </p>
      </div>
      {/*
        Key on updated_at so the form re-mounts with fresh initialValues whenever
        the server data changes — avoids the setState-in-effect anti-pattern.
      */}
      <SettingsForm
        key={saved.updated_at}
        initial={{
          store_name:              saved.store_name,
          support_email:           saved.support_email,
          support_phone:           saved.support_phone,
          warehouse_address:       saved.warehouse_address,
          cod_enabled:             saved.cod_enabled,
          free_shipping_threshold: saved.free_shipping_threshold,
          flat_shipping_rate:      saved.flat_shipping_rate,
          notify_new_order:        saved.notify_new_order,
          notify_low_stock:        saved.notify_low_stock,
          meta_title:              saved.meta_title,
          meta_description:        saved.meta_description,
          primary_color:           saved.primary_color,
          accent_color:            saved.accent_color,
        }}
        savedAt={saved.updated_at}
      />
    </div>
  );
}
