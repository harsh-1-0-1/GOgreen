import { useState } from 'react';
import { Tag, Percent, IndianRupee, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface Coupon {
  id: number;
  code: string;
  type: 'percent' | 'fixed';
  value: number;
  minAmount: number;
  isActive: boolean;
  timesUsed: number;
}

const INITIAL_COUPONS: Coupon[] = [
  { id: 1, code: 'PLANTOGA15', type: 'percent', value: 15, minAmount: 999, isActive: true, timesUsed: 142 },
  { id: 2, code: 'WELCOME200', type: 'fixed', value: 200, minAmount: 1499, isActive: true, timesUsed: 89 },
  { id: 3, code: 'MONSOON50', type: 'percent', value: 50, minAmount: 2999, isActive: false, timesUsed: 312 },
  { id: 4, code: 'PLANTLOVE', type: 'fixed', value: 100, minAmount: 500, isActive: true, timesUsed: 23 },
];

export default function CouponsAdminPage() {
  const [coupons, setCoupons] = useState<Coupon[]>(INITIAL_COUPONS);
  const [code, setCode] = useState('');
  const [type, setType] = useState<'percent' | 'fixed'>('percent');
  const [value, setValue] = useState<string>('');
  const [minAmount, setMinAmount] = useState<string>('');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !value || !minAmount) {
      toast.error('Please fill in all fields');
      return;
    }

    const newCoupon: Coupon = {
      id: Date.now(),
      code: code.trim().toUpperCase(),
      type,
      value: Number(value),
      minAmount: Number(minAmount),
      isActive: true,
      timesUsed: 0,
    };

    setCoupons([newCoupon, ...coupons]);
    toast.success(`Coupon code "${newCoupon.code}" created successfully!`);
    
    // reset form
    setCode('');
    setValue('');
    setMinAmount('');
  };

  const handleToggle = (id: number) => {
    setCoupons(
      coupons.map((c) => (c.id === id ? { ...c, isActive: !c.isActive } : c))
    );
    toast.success('Coupon visibility toggled');
  };

  const handleDelete = (id: number, codeStr: string) => {
    if (confirm(`Are you sure you want to delete coupon code "${codeStr}"?`)) {
      setCoupons(coupons.filter((c) => c.id !== id));
      toast.success('Coupon code deleted');
    }
  };

  const inputClass = "w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary";

  return (
    <div className="space-y-5">
      
      {/* Title */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Coupons & Discounts</h1>
        <p className="text-xs text-gray-500 mt-0.5">Generate coupon codes, configure flat reductions, and incentivize client orders.</p>
      </div>

      {/* Explanatory banner */}
      <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4 shadow-sm grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-gray-600 leading-normal">
        <div className="flex gap-2">
          <div className="bg-primary/10 w-9 h-9 rounded-lg flex items-center justify-center text-primary shrink-0">
            <Percent size={18} />
          </div>
          <div>
            <span className="font-bold text-primary">Percentage Discount (%)</span>
            <p className="text-[11px] text-gray-500 mt-0.5">Deducts a slice off the total bill. Example: <strong>15% OFF</strong> on ₹1,000 saves ₹150 for the customer.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="bg-primary/10 w-9 h-9 rounded-lg flex items-center justify-center text-primary shrink-0">
            <IndianRupee size={18} />
          </div>
          <div>
            <span className="font-bold text-primary">Fixed Flat Discount (₹)</span>
            <p className="text-[11px] text-gray-500 mt-0.5">Deducts a precise flat rupee amount. Example: <strong>₹200 OFF</strong> reduces a ₹1,500 order down to ₹1,300.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        {/* Coupon Form */}
        <div className="md:col-span-1 bg-white p-4 rounded-xl border shadow-sm space-y-4 h-fit">
          <h2 className="text-sm font-bold text-gray-800 pb-2 border-b">Create Promo Code</h2>
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">Coupon Code *</label>
              <input
                placeholder="e.g. FESTIVE200"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none uppercase"
              />
              <p className="text-[9px] text-gray-400 mt-1">Codes are auto-capitalized. Do not include spaces.</p>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-700 block mb-1">Discount Type</label>
              <div className="flex gap-2 border rounded-lg p-0.5 bg-gray-50 text-xs font-bold text-gray-600">
                <button
                  type="button"
                  onClick={() => setType('percent')}
                  className={`flex-1 py-1 rounded flex items-center justify-center gap-1 transition ${type === 'percent' ? 'bg-white text-primary shadow-xs' : 'hover:bg-gray-100'}`}
                >
                  <Percent size={12} /> Percentage
                </button>
                <button
                  type="button"
                  onClick={() => setType('fixed')}
                  className={`flex-1 py-1 rounded flex items-center justify-center gap-1 transition ${type === 'fixed' ? 'bg-white text-primary shadow-xs' : 'hover:bg-gray-100'}`}
                >
                  <IndianRupee size={12} /> Fixed Flat
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">
                  {type === 'percent' ? 'Percentage (%)' : 'Amount (₹)'} *
                </label>
                <input
                  type="number"
                  placeholder={type === 'percent' ? '15' : '200'}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  required
                  className={inputClass}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 block mb-1">Min Order Total (₹) *</label>
                <input
                  type="number"
                  placeholder="999"
                  value={minAmount}
                  onChange={(e) => setMinAmount(e.target.value)}
                  required
                  className={inputClass}
                />
              </div>
            </div>

            {/* Formula Preview Box */}
            <div className="rounded-lg bg-gray-50 border p-3 text-[10px] text-gray-500 leading-normal">
              {type === 'percent' ? (
                <p>💡 Formula: Orders above ₹{minAmount || 'X'} will get {value || 'Y'}% deducted from cart total before delivery tax.</p>
              ) : (
                <p>💡 Formula: Orders above ₹{minAmount || 'X'} will get flat ₹{value || 'Y'} subtracted directly at checkout.</p>
              )}
            </div>

            <button
              type="submit"
              className="w-full py-2.5 bg-primary text-white text-xs rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-primary/95 transition"
            >
              <Plus size={14} /> Add Coupon
            </button>
          </form>
        </div>

        {/* Coupon Registry Table */}
        <div className="md:col-span-2 bg-white p-4 rounded-xl border shadow-sm">
          <h2 className="text-sm font-bold text-gray-800 pb-2 border-b mb-3">Coupons Ledger</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b text-gray-500 bg-gray-50">
                  <th className="p-3 font-semibold">Promo Code</th>
                  <th className="p-3 font-semibold">Deduction Value</th>
                  <th className="p-3 font-semibold">Min Basket Limit</th>
                  <th className="p-3 font-semibold text-center">Times Claimed</th>
                  <th className="p-3 font-semibold text-center">Active Status</th>
                  <th className="p-3 font-semibold text-right w-16">Actions</th>
                </tr>
              </thead>
              <tbody>
                {coupons.map((c) => (
                  <tr key={c.id} className="border-b last:border-0 hover:bg-gray-50/50">
                    <td className="p-3 font-bold text-gray-900 flex items-center gap-1.5">
                      <Tag size={13} className="text-primary-light" />
                      {c.code}
                    </td>
                    <td className="p-3 font-medium">
                      {c.type === 'percent' ? `${c.value}% Off` : `₹${c.value} Flat`}
                    </td>
                    <td className="p-3 text-gray-600">₹{c.minAmount}</td>
                    <td className="p-3 text-center font-bold text-primary">{c.timesUsed} claims</td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => handleToggle(c.id)}
                        className={`text-[9px] font-bold px-2 py-0.5 rounded border ${
                          c.isActive
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : 'bg-gray-100 text-gray-500 border-gray-200'
                        }`}
                      >
                        {c.isActive ? 'Active' : 'Paused'}
                      </button>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => handleDelete(c.id, c.code)}
                        className="p-1.5 text-red-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
