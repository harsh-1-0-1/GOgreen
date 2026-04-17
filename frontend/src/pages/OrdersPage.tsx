import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Package } from 'lucide-react';
import { useOrders } from '@/hooks/useOrders';
import Spinner from '@/components/ui/Spinner';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  confirmed: 'bg-blue-100 text-blue-700',
  shipped: 'bg-purple-100 text-purple-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

const PAYMENT_COLORS: Record<string, string> = {
  pending: 'text-yellow-600',
  paid: 'text-green-600',
  failed: 'text-red-600',
  refunded: 'text-gray-600',
};

export default function OrdersPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useOrders(page);

  if (isLoading) return <Spinner className="py-32" />;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-8 flex items-center gap-2">
        <Package size={24} className="text-primary" /> My Orders
      </h1>

      {!data?.items.length ? (
        <div className="text-center py-20 text-gray-400">
          <Package size={48} strokeWidth={1} className="mx-auto mb-3" />
          <p className="text-lg font-medium">No orders yet</p>
          <Link to="/products" className="text-sm text-primary hover:underline mt-2 inline-block">
            Start Shopping
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {data.items.map((order) => (
            <Link
              key={order.id}
              to={`/orders/${order.id}`}
              className="block bg-white rounded-2xl border p-5 hover:shadow-md transition"
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="text-sm text-gray-400">Order #</span>
                  <span className="font-bold ml-1">{order.id}</span>
                </div>
                <span
                  className={`text-xs font-semibold px-3 py-1 rounded-full capitalize ${
                    STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {order.status}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="text-gray-500">
                  {new Date(order.created_at).toLocaleDateString('en-IN', {
                    year: 'numeric', month: 'short', day: 'numeric',
                  })}
                  <span className="mx-2">·</span>
                  {order.items.length} item{order.items.length !== 1 && 's'}
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-medium capitalize ${PAYMENT_COLORS[order.payment_status] || ''}`}>
                    {order.payment_status}
                  </span>
                  <span className="font-bold text-primary text-lg">₹{order.total_amount.toFixed(0)}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-4 mt-8">
          <button
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
            className="p-2 border rounded-lg hover:bg-gray-50 disabled:opacity-30"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm text-gray-500">Page {page} of {data.pages}</span>
          <button
            disabled={page >= data.pages}
            onClick={() => setPage(page + 1)}
            className="p-2 border rounded-lg hover:bg-gray-50 disabled:opacity-30"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
