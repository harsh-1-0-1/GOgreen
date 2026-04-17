import { useState } from 'react';
import { X } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAdminOrders, useUpdateOrderStatus } from '@/hooks/useAdmin';
import type { Order } from '@/types';

const STATUSES = ['', 'pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
const STATUS_LABELS: Record<string, string> = {
  '': 'All', pending: 'Pending', confirmed: 'Confirmed',
  shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled',
};
const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700', confirmed: 'bg-blue-100 text-blue-700',
  shipped: 'bg-purple-100 text-purple-700', delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

function OrderDrawer({ order, onClose }: { order: Order; onClose: () => void }) {
  const mutation = useUpdateOrderStatus();
  const [newStatus, setNewStatus] = useState(order.status);

  async function handleUpdate() {
    try {
      await mutation.mutateAsync({ id: order.id, status: newStatus });
      toast.success('Status updated');
      onClose();
    } catch {
      toast.error('Update failed');
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-50" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-full max-w-md bg-white z-50 shadow-2xl flex flex-col">
        <div className="flex items-center justify-between p-5 border-b">
          <h3 className="font-bold text-lg">Order #{order.id}</h3>
          <button onClick={onClose}><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-gray-500">Status</span><p className="font-medium capitalize">{order.status}</p></div>
            <div><span className="text-gray-500">Payment</span><p className="font-medium capitalize">{order.payment_status}</p></div>
            <div><span className="text-gray-500">Amount</span><p className="font-bold text-primary">₹{order.total_amount}</p></div>
            <div><span className="text-gray-500">Date</span><p>{new Date(order.created_at).toLocaleDateString()}</p></div>
          </div>

          <div>
            <h4 className="font-semibold text-sm mb-2">Items ({order.items.length})</h4>
            <div className="divide-y">
              {order.items.map((item) => (
                <div key={item.id} className="py-2 flex justify-between text-sm">
                  <span>Product #{item.product_id} × {item.quantity}</span>
                  <span className="font-medium">₹{(item.quantity * item.unit_price).toFixed(0)}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-semibold text-sm mb-2">Update Status</h4>
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
              className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-light"
            >
              {STATUSES.filter(Boolean).map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
            <button
              onClick={handleUpdate}
              disabled={mutation.isPending || newStatus === order.status}
              className="w-full mt-3 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-60"
            >
              {mutation.isPending ? 'Updating...' : 'Update Status'}
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
      <h1 className="text-2xl font-bold">Orders</h1>

      <div className="flex gap-2 overflow-x-auto scrollbar-hide">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(1); }}
            className={`px-4 py-2 text-sm rounded-full border whitespace-nowrap transition ${
              statusFilter === s ? 'bg-primary text-white border-primary' : 'bg-white hover:border-gray-300'
            }`}
          >
            {STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b">
              <th className="px-4 py-3 font-medium">ID</th>
              <th className="px-4 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Payment</th>
              <th className="px-4 py-3 font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Date</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
            ) : data?.items?.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No orders</td></tr>
            ) : (
              data?.items?.map((o: Order) => (
                <tr key={o.id} className="border-b last:border-0 hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedOrder(o)}>
                  <td className="px-4 py-3 font-medium">#{o.id}</td>
                  <td className="px-4 py-3">User #{o.user_id}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${STATUS_COLORS[o.status] || 'bg-gray-100'}`}>
                      {o.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 capitalize">{o.payment_status}</td>
                  <td className="px-4 py-3 font-semibold">₹{o.total_amount}</td>
                  <td className="px-4 py-3 text-gray-500">{new Date(o.created_at).toLocaleDateString()}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-30">Prev</button>
          <span className="text-sm text-gray-500">Page {page} of {data.pages}</span>
          <button disabled={page >= data.pages} onClick={() => setPage(page + 1)} className="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-30">Next</button>
        </div>
      )}

      {selectedOrder && <OrderDrawer order={selectedOrder} onClose={() => setSelectedOrder(null)} />}
    </div>
  );
}
