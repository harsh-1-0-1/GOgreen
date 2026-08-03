import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Package } from 'lucide-react';
import { useOrder } from '@/hooks/useOrders';
import Spinner from '@/components/ui/Spinner';
import { formatSelectedOptions } from '@/lib/variantDisplay';

const STATUS_STEPS = ['pending', 'confirmed', 'shipped', 'delivered'];

function paymentLabel(paymentMethod: string, paymentStatus: string) {
  if (paymentMethod === 'cod') {
    return paymentStatus === 'paid' ? 'COD collected' : 'Cash on delivery';
  }
  return paymentStatus;
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: order, isLoading, isError } = useOrder(Number(id));

  if (isLoading) return <Spinner className="py-32" />;
  if (isError || !order) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center text-gray-400">
        <p className="text-lg font-medium">Order not found</p>
        <Link to="/orders" className="text-sm text-primary hover:underline mt-2 inline-block">Back to Orders</Link>
      </div>
    );
  }

  const currentStep = STATUS_STEPS.indexOf(order.status);
  const isCancelled = order.status === 'cancelled';

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
      <Link to="/orders" className="text-xs sm:text-sm text-gray-500 flex items-center gap-1 mb-4 sm:mb-6 hover:text-primary touch-target">
        <ArrowLeft size={16} /> Back to Orders
      </Link>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 sm:mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Order #{order.id}</h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Placed on {new Date(order.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div className="sm:text-right">
          <p className="text-xl sm:text-2xl font-bold text-primary">₹{order.total_amount.toFixed(0)}</p>
          <p className={`text-xs sm:text-sm font-medium capitalize ${
            order.payment_status === 'paid' ? 'text-green-600' :
            order.payment_status === 'failed' ? 'text-red-600' : 'text-yellow-600'
          }`}>
            Payment: {paymentLabel(order.payment_method, order.payment_status)}
          </p>
        </div>
      </div>

      {/* Status timeline */}
      {!isCancelled && (
        <div className="bg-white rounded-xl sm:rounded-2xl border p-4 sm:p-6 mb-4 sm:mb-6">
          <div className="flex items-center justify-between">
            {STATUS_STEPS.map((step, i) => (
              <div key={step} className="flex-1 flex flex-col items-center relative">
                <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-bold z-10 ${
                  i <= currentStep ? 'bg-primary text-white' : 'bg-gray-200 text-gray-400'
                }`}>
                  {i + 1}
                </div>
                <span className={`text-[10px] sm:text-xs mt-1.5 sm:mt-2 capitalize ${
                  i <= currentStep ? 'text-primary font-medium' : 'text-gray-400'
                }`}>
                  {step}
                </span>
                {i < STATUS_STEPS.length - 1 && (
                  <div className={`absolute top-3.5 sm:top-4 left-1/2 w-full h-0.5 ${i < currentStep ? 'bg-primary' : 'bg-gray-200'}`} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {isCancelled && (
        <div className="bg-red-50 border border-red-200 rounded-xl sm:rounded-2xl p-4 sm:p-6 mb-4 sm:mb-6 text-center">
          <p className="text-red-600 font-semibold text-sm sm:text-base">This order has been cancelled.</p>
        </div>
      )}

      {/* Items */}
      <div className="bg-white rounded-xl sm:rounded-2xl border p-4 sm:p-6">
        <h3 className="font-bold text-sm sm:text-base mb-3 sm:mb-4 flex items-center gap-2">
          <Package size={18} className="text-primary" />
          Items ({order.items.length})
        </h3>
        <div className="divide-y">
          {order.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3 min-w-0">
                {item.resolved_image_url && (
                  <img
                    src={item.resolved_image_url}
                    alt=""
                    className="w-14 h-14 rounded-lg object-cover shrink-0"
                    loading="lazy"
                  />
                )}
                <div className="min-w-0">
                <p className="font-medium text-sm">{item.product_name || `Product #${item.product_id}`}</p>
                <p className="text-[10px] text-gray-400">Product ID: #{item.product_id}</p>
                {item.selected_options && (
                  <p className="text-xs text-gray-500">
                    {formatSelectedOptions(item.selected_options, null)}
                  </p>
                )}
                <p className="text-xs text-gray-500">Qty: {item.quantity} × ₹{item.unit_price}</p>
                </div>
              </div>
              <p className="font-bold text-sm sm:text-base">₹{(item.quantity * item.unit_price).toFixed(0)}</p>
            </div>
          ))}
        </div>
      </div>

      {order.payment_id && (
        <div className="mt-3 sm:mt-4 bg-gray-50 rounded-xl p-3 sm:p-4 text-xs sm:text-sm text-gray-500">
          Payment ID: <span className="font-mono break-all">{order.payment_id}</span>
        </div>
      )}
    </div>
  );
}
