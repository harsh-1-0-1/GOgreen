import { DollarSign, Package, ShoppingCart, Users } from 'lucide-react';
import { useAdminStats, useAdminOrders } from '@/hooks/useAdmin';
import Spinner from '@/components/ui/Spinner';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700', confirmed: 'bg-blue-100 text-blue-700',
  shipped: 'bg-purple-100 text-purple-700', delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
};

export default function DashboardPage() {
  const { data: stats, isLoading } = useAdminStats();
  const { data: recentOrders } = useAdminOrders(undefined, 1);

  if (isLoading) return <Spinner className="py-20" />;

  const cards = [
    { label: 'Revenue (Month)', value: `₹${stats?.revenue_month?.toLocaleString() ?? 0}`, icon: DollarSign, color: 'bg-green-50 text-green-600' },
    { label: 'Total Orders', value: stats?.total_orders ?? 0, icon: ShoppingCart, color: 'bg-blue-50 text-blue-600' },
    { label: 'Active Products', value: stats?.total_products ?? 0, icon: Package, color: 'bg-purple-50 text-purple-600' },
    { label: 'Registered Users', value: stats?.total_users ?? 0, icon: Users, color: 'bg-amber-50 text-amber-600' },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      <h1 className="text-xl sm:text-2xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-white rounded-xl border p-3 sm:p-5">
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <span className="text-[10px] sm:text-xs text-gray-500 font-medium uppercase tracking-wider">{c.label}</span>
              <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center ${c.color}`}>
                <c.icon size={16} />
              </div>
            </div>
            <p className="text-lg sm:text-2xl font-bold">{c.value}</p>
          </div>
        ))}
      </div>

      {stats?.orders_by_status && (
        <div className="bg-white rounded-xl border p-3 sm:p-5">
          <h3 className="font-semibold text-sm sm:text-base mb-3 sm:mb-4">Orders by Status</h3>
          <div className="flex flex-wrap gap-2 sm:gap-3">
            {Object.entries(stats.orders_by_status).map(([status, count]) => (
              <div key={status} className="px-3 py-1.5 sm:px-4 sm:py-2 bg-gray-50 rounded-lg text-xs sm:text-sm">
                <span className="capitalize font-medium">{status}</span>
                <span className="ml-2 font-bold text-primary">{count as number}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent orders: table on desktop, cards on mobile */}
      <div className="bg-white rounded-xl border">
        <div className="p-3 sm:p-5 border-b">
          <h3 className="font-semibold text-sm sm:text-base">Recent Orders</h3>
        </div>

        {/* Desktop table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="px-5 py-3 font-medium">ID</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Payment</th>
                <th className="px-5 py-3 font-medium">Amount</th>
                <th className="px-5 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders?.items?.slice(0, 10).map((o: any) => (
                <tr key={o.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium">#{o.id}</td>
                  <td className="px-5 py-3"><span className={`text-xs font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_COLORS[o.status] || 'bg-gray-100'}`}>{o.status}</span></td>
                  <td className="px-5 py-3 capitalize">{o.payment_status}</td>
                  <td className="px-5 py-3 font-semibold">₹{o.total_amount}</td>
                  <td className="px-5 py-3 text-gray-500">{new Date(o.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
              {(!recentOrders?.items?.length) && (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-400">No orders yet</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="sm:hidden p-3 space-y-2">
          {recentOrders?.items?.slice(0, 10).map((o: any) => (
            <div key={o.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm font-medium">#{o.id}</p>
                <p className="text-xs text-gray-500">{new Date(o.created_at).toLocaleDateString()}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold">₹{o.total_amount}</p>
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_COLORS[o.status] || 'bg-gray-100'}`}>{o.status}</span>
              </div>
            </div>
          ))}
          {(!recentOrders?.items?.length) && (
            <p className="text-center text-gray-400 py-6 text-sm">No orders yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
