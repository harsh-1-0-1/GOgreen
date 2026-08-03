import { useState } from 'react';
import { Settings, CreditCard, Truck, Mail, Globe, Palette } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SettingsAdminPage() {
  const [activeTab, setActiveTab] = useState<'store' | 'payments' | 'shipping' | 'emails' | 'seo' | 'branding'>('store');

  // Store information state
  const [storeName, setStoreName] = useState('GOgreen Plants & Pots');
  const [storeEmail, setStoreEmail] = useState('support@gogreen.com');
  const [storePhone, setStorePhone] = useState('+91 99887 76655');
  const [storeAddress, setStoreAddress] = useState('12, Green Enclave, Sector 5, Bangalore - 560001');

  // Payments state
  const [razorpayKey, setRazorpayKey] = useState('rzp_live_ABC123XYZ');
  const [enableCod, setEnableCod] = useState(true);

  // Shipping state
  const [freeShippingLimit, setFreeShippingLimit] = useState('999');
  const [flatShippingCost, setFlatShippingCost] = useState('75');

  // Emails state
  const [notifyNewOrder, setNotifyNewOrder] = useState(true);
  const [notifyLowStock, setNotifyLowStock] = useState(true);

  // SEO state
  const [metaTitle, setMetaTitle] = useState('GOgreen - Buy Indoor Plants & Pots Online India');
  const [metaDescription, setMetaDescription] = useState('Order fresh indoor air-purifier plants, succulents, premium ceramic pots, and garden combos. Fast home delivery across India.');

  // Branding state
  const [primaryColor, setPrimaryColor] = useState('#2D6A4F');
  const [accentColor, setAccentColor] = useState('#52B788');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success('Store configuration saved successfully!');
  };

  const menuItems = [
    { id: 'store', label: '🏬 Store Info', icon: Settings },
    { id: 'payments', label: '💳 Payments', icon: CreditCard },
    { id: 'shipping', label: '🚚 Shipping & Delivery', icon: Truck },
    { id: 'emails', label: '📧 Email Alerts', icon: Mail },
    { id: 'seo', label: '🌐 Search Engine (SEO)', icon: Globe },
    { id: 'branding', label: '🎨 Branding & Colors', icon: Palette },
  ] as const;

  const inputClass = "w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary mt-1 bg-white";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">System Settings</h1>
        <p className="text-xs text-gray-500 mt-0.5">Control global store details, transaction methods, delivery limits, notification rules, and branding styles.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        
        {/* Left Side Tab Navigation */}
        <div className="md:col-span-1 bg-white rounded-xl border p-2 shadow-sm space-y-1 h-fit">
          {menuItems.map((item) => (
            <button
              key={item.id}
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

        {/* Right Side Settings Form */}
        <div className="md:col-span-3 bg-white p-5 rounded-xl border shadow-sm">
          <form onSubmit={handleSave} className="space-y-4">
            
            {activeTab === 'store' && (
              <div className="space-y-4">
                <div className="border-b pb-2">
                  <h3 className="text-sm font-bold text-gray-800">🏬 Store Information</h3>
                  <p className="text-[10px] text-gray-400">Configure contact coordinates that appear in customer invoice receipts and footer.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-700">Business Name</label>
                    <input value={storeName} onChange={(e) => setStoreName(e.target.value)} required className={inputClass} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700">Support Email Address</label>
                    <input type="email" value={storeEmail} onChange={(e) => setStoreEmail(e.target.value)} required className={inputClass} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700">Contact Hotline</label>
                    <input value={storePhone} onChange={(e) => setStorePhone(e.target.value)} required className={inputClass} />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700">Physical Warehouse Address</label>
                  <textarea rows={2} value={storeAddress} onChange={(e) => setStoreAddress(e.target.value)} required className={inputClass} />
                </div>
              </div>
            )}

            {activeTab === 'payments' && (
              <div className="space-y-4">
                <div className="border-b pb-2">
                  <h3 className="text-sm font-bold text-gray-800">💳 Merchant Payment Gateways</h3>
                  <p className="text-[10px] text-gray-400">Link payment services for order settlement.</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700">Razorpay API Key (Live)</label>
                  <input value={razorpayKey} onChange={(e) => setRazorpayKey(e.target.value)} className={inputClass} />
                  <p className="text-[9px] text-gray-400 mt-1">Obtain this key from razorpay developer panel.</p>
                </div>
                <div className="pt-2 border-t flex items-center justify-between">
                  <div>
                    <label className="text-xs font-semibold text-gray-800">Enable Cash on Delivery (COD)</label>
                    <p className="text-[9px] text-gray-400">Allow customers to choose COD checkout option.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEnableCod(!enableCod)}
                    className={`relative w-10 h-5.5 rounded-full transition-colors ${enableCod ? 'bg-primary' : 'bg-gray-300'}`}
                  >
                    <span className={`absolute top-0.5 w-4.5 h-4.5 bg-white rounded-full shadow transition-transform ${enableCod ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'shipping' && (
              <div className="space-y-4">
                <div className="border-b pb-2">
                  <h3 className="text-sm font-bold text-gray-800">🚚 Shipping & Delivery Thresholds</h3>
                  <p className="text-[10px] text-gray-400">Set shipping costs and basket limits.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-700">Free Delivery Minimum Total (₹)</label>
                    <input type="number" value={freeShippingLimit} onChange={(e) => setFreeShippingLimit(e.target.value)} required className={inputClass} />
                    <p className="text-[9px] text-gray-400 mt-1">Orders above this amount get free delivery.</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700">Flat Shipping Charge (₹)</label>
                    <input type="number" value={flatShippingCost} onChange={(e) => setFlatShippingCost(e.target.value)} required className={inputClass} />
                    <p className="text-[9px] text-gray-400 mt-1">Standard cost for orders below minimum limit.</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'emails' && (
              <div className="space-y-4">
                <div className="border-b pb-2">
                  <h3 className="text-sm font-bold text-gray-800">📧 Email Notifications</h3>
                  <p className="text-[10px] text-gray-400">Configure status triggers for operational emails.</p>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-1.5">
                    <div>
                      <label className="text-xs font-semibold text-gray-850">Client Order Email Alerts</label>
                      <p className="text-[9px] text-gray-400">Send order summary emails to customer immediately after purchase.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setNotifyNewOrder(!notifyNewOrder)}
                      className={`relative w-10 h-5.5 rounded-full transition-colors ${notifyNewOrder ? 'bg-primary' : 'bg-gray-300'}`}
                    >
                      <span className={`absolute top-0.5 w-4.5 h-4.5 bg-white rounded-full shadow transition-transform ${notifyNewOrder ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between py-1.5 border-t">
                    <div>
                      <label className="text-xs font-semibold text-gray-850">Warehouse Low-Stock Notifications</label>
                      <p className="text-[9px] text-gray-400">Receive alert mail if products drop below healthy levels.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setNotifyLowStock(!notifyLowStock)}
                      className={`relative w-10 h-5.5 rounded-full transition-colors ${notifyLowStock ? 'bg-primary' : 'bg-gray-300'}`}
                    >
                      <span className={`absolute top-0.5 w-4.5 h-4.5 bg-white rounded-full shadow transition-transform ${notifyLowStock ? 'translate-x-[18px]' : 'translate-x-0.5'}`} stroke-width="1.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'seo' && (
              <div className="space-y-4">
                <div className="border-b pb-2">
                  <h3 className="text-sm font-bold text-gray-800">🌐 Search Engine Optimization (SEO)</h3>
                  <p className="text-[10px] text-gray-400">Tune store visibility settings for Google and Bing search index crawlers.</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700">Global Homepage Meta Title</label>
                  <input value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} required className={inputClass} />
                  <p className="text-[9px] text-gray-400 mt-1">Recommended length: 50-60 characters.</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700">Homepage Meta Description</label>
                  <textarea rows={3} value={metaDescription} onChange={(e) => setMetaDescription(e.target.value)} required className={inputClass} />
                  <p className="text-[9px] text-gray-400 mt-1">Recommended length: 120-160 characters.</p>
                </div>
              </div>
            )}

            {activeTab === 'branding' && (
              <div className="space-y-4">
                <div className="border-b pb-2">
                  <h3 className="text-sm font-bold text-gray-800">🎨 Branding & Themes</h3>
                  <p className="text-[10px] text-gray-400">Modify design theme attributes for buttons and page styles.</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-700">Primary Brand Color</label>
                    <div className="flex gap-2 items-center mt-1">
                      <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="w-8 h-8 rounded border cursor-pointer shrink-0" />
                      <input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="w-full px-2.5 py-1.5 text-xs border rounded-lg uppercase" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700">Accent Highlights Color</label>
                    <div className="flex gap-2 items-center mt-1">
                      <input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="w-8 h-8 rounded border cursor-pointer shrink-0" />
                      <input value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="w-full px-2.5 py-1.5 text-xs border rounded-lg uppercase" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Save Buttons */}
            <div className="pt-4 border-t flex justify-end">
              <button
                type="submit"
                className="px-5 py-2.5 bg-primary text-white text-xs font-semibold rounded-xl hover:bg-primary/95 transition shadow-sm"
              >
                Save Settings
              </button>
            </div>

          </form>
        </div>

      </div>
    </div>
  );
}
