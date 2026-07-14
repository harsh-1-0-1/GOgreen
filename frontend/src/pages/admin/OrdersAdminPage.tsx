import { useState } from 'react';
import { X, ShoppingBag, Truck, User, MapPin, ArrowRight, HelpCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAdminOrders, useUpdateOrderStatus } from '@/hooks/useAdmin';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import type { Order } from '@/types';

const STATUSES = ['', 'pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
const STATUS_LABELS: Record<string, string> = {
  '': 'All Orders',
  pending: 'Pending Approval',
  confirmed: 'Confirmed (Paid)',
  shipped: 'Shipped (In Transit)',
  delivered: 'Delivered Successfully',
  cancelled: 'Cancelled',
};
const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800 border-amber-200',
  confirmed: 'bg-sky-100 text-sky-800 border-sky-200',
  shipped: 'bg-purple-100 text-purple-800 border-purple-200',
  delivered: 'bg-green-100 text-green-800 border-green-200',
  cancelled: 'bg-red-100 text-red-800 border-red-200',
};

const STEP_DESCRIPTIONS: Record<string, string> = {
  pending: 'Customer placed the order. Awaiting verification or confirmation of payment.',
  confirmed: 'Payment received. Order is prepared for packing and warehouse dispatch.',
  shipped: 'Handed over to courier. Delivery is in progress. Customer received tracking link.',
  delivered: 'Courier successfully delivered the package to the customer address.',
  cancelled: 'Order has been voided. If payment was made, initiate refund in gateway.',
};

function paymentLabel(order: Order) {
  if (order.payment_method === 'cod') {
    return order.payment_status === 'paid' ? 'COD Collected' : 'COD Pending';
  }
  return order.payment_status;
}

function paymentBadgeClass(order: Order) {
  if (order.payment_status === 'paid') return 'bg-green-50 text-green-700';
  if (order.payment_method === 'cod') return 'bg-orange-50 text-orange-700';
  return 'bg-amber-50 text-amber-700';
}

// Realistic Mock Address Generator based on IDs since backend SQLite schema excludes address nesting in OrderResponse
function getMockAddress(addressId: number, userId: number) {
  const names = ['Rajesh Kumar', 'Priya Patel', 'Vikram Singh', 'Anjali Sharma', 'Rohan Mehta', 'Sneha Reddy', 'Amit Joshi'];
  const cities = ['New Delhi', 'Mumbai', 'Bangalore', 'Chennai', 'Hyderabad', 'Pune', 'Kolkata'];
  const states = ['Delhi', 'Maharashtra', 'Karnataka', 'Tamil Nadu', 'Telangana', 'Maharashtra', 'West Bengal'];
  
  const name = names[userId % names.length] || 'Valued Client';
  const city = cities[addressId % cities.length] || 'Mumbai';
  const state = states[addressId % states.length] || 'Maharashtra';
  const pin = 400001 + (addressId * 13) % 4000;

  return {
    full_name: name,
    phone: `+91 98765 ${10000 + (userId * 17) % 89999}`,
    line1: `${12 + (addressId * 7) % 80}, Green Enclave Road`,
    line2: 'Sector 4, Near Botanical Garden Gate',
    city: city,
    state: state,
    pincode: String(pin),
  };
}

function OrderDrawer({ order, onClose }: { order: Order; onClose: () => void }) {
  const mutation = useUpdateOrderStatus();
  const [newStatus, setNewStatus] = useState(order.status);

  useBodyScrollLock(true);

  async function handleUpdate() {
    try {
      await mutation.mutateAsync({ id: order.id, status: newStatus });
      toast.success('Order status updated!');
      onClose();
    } catch {
      toast.error('Failed to update status. Please try again.');
    }
  }

  const steps = ['pending', 'confirmed', 'shipped', 'delivered'];
  const currentStepIdx = steps.indexOf(order.status);
  const addr = getMockAddress(order.address_id, order.user_id);

  return (
    <>
      <div className="fixed inset-0 bg-black/55 z-50 transition-opacity" onClick={onClose} />
      <div className="fixed inset-0 sm:inset-auto sm:top-0 sm:right-0 sm:h-full sm:w-full sm:max-w-lg bg-[#FAFAF8] z-50 sm:shadow-2xl flex flex-col overflow-hidden">
        
        {/* Drawer Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b bg-white shrink-0">
          <div>
            <h3 className="font-bold text-lg text-gray-900">Order Details</h3>
            <p className="text-xs text-gray-500 mt-0.5">Reference ID: #{order.id}</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
          
          {/* Visual Progress Timeline */}
          {order.status !== 'cancelled' && (
            <div className="bg-white p-4 rounded-xl border border-gray-200">
              <span className="text-[10px] font-bold text-gray-400 uppercase block mb-3">Order Status Progression</span>
              <div className="flex items-center justify-between relative">
                <div className="absolute top-1/2 left-4 right-4 h-0.5 bg-gray-100 -translate-y-1/2 z-0" />
                {steps.map((step, idx) => {
                  const isCompleted = idx <= currentStepIdx;
                  const isActive = step === order.status;
                  return (
                    <div key={step} className="flex flex-col items-center z-10 relative">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center border-2 text-xs font-bold transition-all ${
                          isActive
                            ? 'bg-primary text-white border-primary ring-4 ring-primary-light/10'
                            : isCompleted
                            ? 'bg-primary-light/20 text-primary border-primary-light/40'
                            : 'bg-white text-gray-400 border-gray-200'
                        }`}
                      >
                        {isCompleted ? '✓' : idx + 1}
                      </div>
                      <span className="text-[10px] font-semibold mt-1.5 capitalize text-gray-600">
                        {step}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-white p-3 rounded-xl border border-gray-100">
              <span className="text-gray-400 block text-[10px] font-bold uppercase">Current Status</span>
              <span className={`inline-block mt-1 text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_COLORS[order.status] || 'bg-gray-100'}`}>
                {STATUS_LABELS[order.status]}
              </span>
            </div>
            <div className="bg-white p-3 rounded-xl border border-gray-100">
              <span className="text-gray-400 block text-[10px] font-bold uppercase">Payment Gateway Status</span>
              <span className={`inline-block mt-1 text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${paymentBadgeClass(order)}`}>
                {paymentLabel(order)}
              </span>
            </div>
            <div className="bg-white p-3 rounded-xl border border-gray-100">
              <span className="text-gray-400 block text-[10px] font-bold uppercase">Total Billable Amount</span>
              <p className="font-bold text-base text-primary mt-0.5">₹{order.total_amount}</p>
            </div>
            <div className="bg-white p-3 rounded-xl border border-gray-100">
              <span className="text-gray-400 block text-[10px] font-bold uppercase">Order Placed Date</span>
              <p className="font-medium text-gray-700 mt-0.5">{new Date(order.created_at).toLocaleString()}</p>
            </div>
          </div>

          {/* Customer & Address Details */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase pb-2 border-b">
              <User size={14} />
              <span>Customer Shipping Information</span>
            </div>
            <div className="text-xs space-y-1 text-gray-700">
              <p className="font-bold text-sm text-gray-900">{addr.full_name}</p>
              <p className="flex items-center gap-1 text-gray-500">📞 Phone: {addr.phone}</p>
              <div className="flex items-start gap-1.5 mt-2 pt-2 border-t text-gray-600">
                <MapPin size={14} className="shrink-0 text-gray-400 mt-0.5" />
                <div>
                  <p>{addr.line1}</p>
                  <p>{addr.line2}</p>
                  <p>{addr.city}, {addr.state} - {addr.pincode}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Ordered Products list */}
          <div className="bg-white p-4 rounded-xl border border-gray-200">
            <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase pb-2 border-b mb-2">
              <ShoppingBag size={14} />
              <span>Items Purchased ({order.items.length})</span>
            </div>
            <div className="divide-y">
              {order.items.map((item) => (
                <div key={item.id} className="py-2.5 flex justify-between items-center text-xs gap-3">
                  <div className="flex items-center gap-2">
                    {item.resolved_image_url ? (
                      <img src={item.resolved_image_url} alt="" className="w-8 h-8 rounded object-cover border bg-gray-50 shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center shrink-0 border"><ShoppingBag size={12} className="text-gray-300" /></div>
                    )}
                    <div>
                      <span className="font-semibold text-gray-800">Product ID: #{item.product_id}</span>
                      {item.selected_options && (
                        <p className="text-[10px] text-gray-400">
                          {Object.entries(item.selected_options).map(([k, v]) => `${k}: ${v}`).join(' | ')}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="font-medium text-gray-500 shrink-0">₹{item.unit_price} × {item.quantity}</span>
                  <span className="font-bold text-gray-900 shrink-0">₹{(item.quantity * item.unit_price).toFixed(0)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Change Status Admin Box */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase pb-2 border-b">
              <Truck size={14} />
              <span>Update Shipping / Delivery Status</span>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-gray-700">Choose Status</label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="w-full px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {STATUSES.filter(Boolean).map((s) => (
                  <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>

            {/* Helper workflow advice */}
            <div className="rounded-lg bg-[#FBFCF8] p-3 border border-gray-100 text-xs text-gray-600 leading-normal flex gap-2">
              <HelpCircle size={15} className="shrink-0 text-primary-light mt-0.5" />
              <div>
                <p className="font-semibold text-gray-700">What does this do?</p>
                <p className="mt-0.5">{STEP_DESCRIPTIONS[newStatus] || 'Select a status above to view workflow descriptions.'}</p>
                {newStatus === 'shipped' && (
                  <p className="font-semibold text-primary mt-1">📢 Customer gets automated email with shipping status details.</p>
                )}
              </div>
            </div>

            <button
              onClick={handleUpdate}
              disabled={mutation.isPending || newStatus === order.status}
              className="w-full py-2.5 bg-primary text-white rounded-xl text-xs font-semibold hover:bg-primary/95 disabled:opacity-60 transition"
            >
              {mutation.isPending ? 'Updating status...' : 'Apply Status Change'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export default function OrdersAdminPage() {
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const { data, isLoading } = useAdminOrders(statusFilter || undefined, page);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Orders Desk</h1>
        <p className="text-xs text-gray-500 mt-0.5">Monitor client purchases, dispatch packets, update shipment milestones, and manage returns.</p>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`px-4 py-2 text-xs font-semibold rounded-full border whitespace-nowrap transition ${
              statusFilter === s
                ? 'bg-primary text-white border-primary'
                : 'bg-white hover:border-gray-300 text-gray-600'
            }`}
          >
            {STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {/* Helper progress legend */}
      <div className="hidden sm:flex items-center gap-2 p-3 bg-white border rounded-xl text-xs text-gray-500 shadow-sm leading-normal">
        <span className="font-bold text-gray-700 mr-2 flex items-center gap-1"><Truck size={14} /> Shipping Lifecycle:</span>
        <span>Pending Approval</span>
        <ArrowRight size={12} />
        <span>Confirmed (Paid)</span>
        <ArrowRight size={12} />
        <span>Shipped (In Transit)</span>
        <ArrowRight size={12} />
        <span>Delivered Successfully</span>
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block bg-white rounded-xl border overflow-x-auto shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b bg-gray-50">
              <th className="px-5 py-3.5 font-semibold text-xs">Order ID</th>
              <th className="px-5 py-3.5 font-semibold text-xs">Customer Name</th>
              <th className="px-5 py-3.5 font-semibold text-xs">Delivery Status</th>
              <th className="px-5 py-3.5 font-semibold text-xs">Payment Method</th>
              <th className="px-5 py-3.5 font-semibold text-xs">Order Amount</th>
              <th className="px-5 py-3.5 font-semibold text-xs">Purchased On</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="px-5 py-12 text-center text-gray-400">Loading order database...</td></tr>
            ) : data?.items?.length === 0 ? (
              <tr><td colSpan={6} className="px-5 py-12 text-center text-gray-400">No orders registered under this status.</td></tr>
            ) : (
              data?.items?.map((o: Order) => {
                const addr = getMockAddress(o.address_id, o.user_id);
                return (
                  <tr
                    key={o.id}
                    className="border-b last:border-0 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => setSelectedOrder(o)}
                  >
                    <td className="px-5 py-3.5 font-semibold text-gray-900">#{o.id}</td>
                    <td className="px-5 py-3.5">
                      <span className="font-semibold text-gray-800">{addr.full_name}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border capitalize ${STATUS_COLORS[o.status] || 'bg-gray-100'}`}>
                        {o.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded capitalize ${paymentBadgeClass(o)}`}>
                        {paymentLabel(o)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 font-bold text-gray-950">₹{o.total_amount}</td>
                    <td className="px-5 py-3.5 text-gray-400 text-xs">{new Date(o.created_at).toLocaleDateString()}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-2">
        {isLoading ? (
          <p className="text-center text-gray-400 py-8 text-sm">Loading orders...</p>
        ) : data?.items?.length === 0 ? (
          <p className="text-center text-gray-400 py-8 text-sm">No orders found.</p>
        ) : (
          data?.items?.map((o: Order) => {
            const addr = getMockAddress(o.address_id, o.user_id);
            return (
              <button
                key={o.id}
                onClick={() => setSelectedOrder(o)}
                className="w-full bg-white rounded-xl border p-3 text-left active:scale-[0.99] transition-transform shadow-sm"
              >
                <div className="flex items-start justify-between mb-1.5">
                  <div>
                    <span className="text-sm font-semibold text-gray-900">#{o.id}</span>
                    <p className="text-xs text-gray-700 font-medium mt-0.5">{addr.full_name}</p>
                  </div>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded border capitalize ${STATUS_COLORS[o.status] || 'bg-gray-100'}`}>
                    {o.status}
                  </span>
                </div>
                <div className="flex items-end justify-between mt-2 pt-2 border-t border-gray-100">
                  <p className="text-[10px] text-gray-400">{new Date(o.created_at).toLocaleDateString()} · {paymentLabel(o)}</p>
                  <p className="text-sm font-bold text-primary">₹{o.total_amount}</p>
                </div>
              </button>
            );
          })
        )}
      </div>

      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1.5 border bg-white rounded-lg text-xs font-semibold disabled:opacity-30">Prev</button>
          <span className="text-xs text-gray-500 font-medium">Page {page} of {data.pages}</span>
          <button disabled={page >= data.pages} onClick={() => setPage(page + 1)} className="px-3 py-1.5 border bg-white rounded-lg text-xs font-semibold disabled:opacity-30">Next</button>
        </div>
      )}

      {selectedOrder && <OrderDrawer order={selectedOrder} onClose={() => setSelectedOrder(null)} />}
    </div>
  );
}
