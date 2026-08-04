import { DollarSign, Package, ShoppingCart, Users, ArrowRight } from 'lucide-react';
import { useAdminStats, useAdminOrders } from '@/hooks/useAdmin';
import Spinner from '@/components/ui/Spinner';
import { Link } from 'react-router-dom';
import type { Order } from '@/types';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  confirmed: 'bg-blue-100 text-blue-700 border-blue-200',
  shipped: 'bg-purple-100 text-purple-700 border-purple-200',
  delivered: 'bg-green-100 text-green-700 border-green-200',
  cancelled: 'bg-red-100 text-red-700 border-red-200',
};

export default function DashboardPage() {
  const { data: stats, isLoading } = useAdminStats();
  const { data: recentOrders } = useAdminOrders(undefined, 1);

  if (isLoading) return <Spinner className="py-20" />;

  const cards = [
    {
      label: 'Revenue (Month)',
      value: `₹${stats?.revenue_month?.toLocaleString() ?? 0}`,
      icon: DollarSign,
      color: 'bg-green-50 text-green-600 border-green-100',
      description: 'Total completed sales earnings this month.'
    },
    {
      label: 'Total Orders',
      value: stats?.total_orders ?? 0,
      icon: ShoppingCart,
      color: 'bg-blue-50 text-blue-600 border-blue-100',
      description: 'Overall order count since store launch.'
    },
    {
      label: 'Active Products',
      value: stats?.total_products ?? 0,
      icon: Package,
      color: 'bg-purple-50 text-purple-600 border-purple-100',
      description: 'Unique plant/product items cataloged.'
    },
    {
      label: 'Registered Users',
      value: stats?.total_users ?? 0,
      icon: Users,
      color: 'bg-amber-50 text-amber-600 border-amber-100',
      description: 'Registered client customer accounts.'
    },
  ];

  return (
    <div className="space-y-6">
      
      {/* Welcome Banner */}
      <div className="bg-[#1B4332] rounded-2xl p-6 text-white relative overflow-hidden shadow-md">
        <div className="relative z-10 space-y-1">
          <span className="text-[10px] uppercase font-bold tracking-widest text-[#E6F3EE] bg-white/10 px-2.5 py-1 rounded-full">
            Store Performance
          </span>
          <h1 className="text-xl sm:text-2xl font-bold pt-1">Welcome back to Plantoga Admin Panel!</h1>
          <p className="text-xs text-white/80 max-w-md">Here is a quick overview of your orders, revenue, inventory status, and website operations today.</p>
        </div>
        {/* Background Plant Abstract Shapes */}
        <div className="absolute right-0 bottom-0 top-0 w-1/3 opacity-15 pointer-events-none flex items-center justify-center">
          <Package size={140} className="text-white" />
        </div>
      </div>

      {/* Quick Action Buttons */}
      <div className="bg-white rounded-xl border p-4 shadow-sm space-y-2">
        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Quick Actions & Shortcuts</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link
            to="/admin/products"
            className="flex items-center justify-between p-3.5 bg-gray-50 border border-gray-100 hover:border-primary/20 hover:bg-primary-light/5 rounded-xl transition group"
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">📦</span>
              <span className="text-xs font-semibold text-gray-700">Add New Product</span>
            </div>
            <ArrowRight size={14} className="text-gray-400 group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link
            to="/admin/orders"
            className="flex items-center justify-between p-3.5 bg-gray-50 border border-gray-100 hover:border-primary/20 hover:bg-primary-light/5 rounded-xl transition group"
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">🚚</span>
              <span className="text-xs font-semibold text-gray-700">View Pending Orders</span>
            </div>
            <ArrowRight size={14} className="text-gray-400 group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link
            to="/admin/banners"
            className="flex items-center justify-between p-3.5 bg-gray-50 border border-gray-100 hover:border-primary/20 hover:bg-primary-light/5 rounded-xl transition group"
          >
            <div className="flex items-center gap-2">
              <span className="text-lg">🎨</span>
              <span className="text-xs font-semibold text-gray-700">Manage Banners</span>
            </div>
            <ArrowRight size={14} className="text-gray-400 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-white rounded-xl border p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{c.label}</span>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${c.color}`}>
                  <c.icon size={15} />
                </div>
              </div>
              <p className="text-xl sm:text-2xl font-bold text-gray-900">{c.value}</p>
            </div>
            <p className="text-[10px] text-gray-400 mt-2.5 pt-1.5 border-t border-gray-50 leading-relaxed">
              {c.description}
            </p>
          </div>
        ))}
      </div>

      {/* Orders by status summary */}
      {stats?.orders_by_status && (
        <div className="bg-white rounded-xl border p-4 shadow-sm space-y-3">
          <h3 className="font-bold text-sm text-gray-800">Operational Funnel (Orders by Status)</h3>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {Object.entries(stats.orders_by_status).map(([status, count]) => (
              <div key={status} className="p-3 bg-gray-50/50 border border-gray-100 rounded-xl flex flex-col justify-between">
                <span className="capitalize text-[10px] font-bold text-gray-400 tracking-wider block">{status}</span>
                <span className="text-base font-bold text-primary mt-1">{count as number} <span className="text-[10px] text-gray-400 font-normal">units</span></span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent orders */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b bg-gray-50/50 flex items-center justify-between">
          <h3 className="font-bold text-sm text-gray-800">Recent Customer Purchases</h3>
          <Link to="/admin/orders" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
            All orders <ArrowRight size={12} />
          </Link>
        </div>

        {/* Desktop table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b bg-gray-50/30">
                <th className="px-5 py-3 font-semibold text-xs">Order ID</th>
                <th className="px-5 py-3 font-semibold text-xs">Customer Name</th>
                <th className="px-5 py-3 font-semibold text-xs">Delivery Status</th>
                <th className="px-5 py-3 font-semibold text-xs">Payment Gateway</th>
                <th className="px-5 py-3 font-semibold text-xs">Total Amount</th>
                <th className="px-5 py-3 font-semibold text-xs">Purchased On</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders?.items?.slice(0, 5).map((o: Order) => (
                <tr key={o.id} className="border-b last:border-0 hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3 font-semibold text-gray-900">#{o.id}</td>
                  <td className="px-5 py-3 font-medium text-gray-700">{o.address?.full_name || `Customer #${o.user_id}`}</td>
                  <td className="px-5 py-3">
                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border capitalize ${STATUS_COLORS[o.status] || 'bg-gray-100'}`}>
                      {o.status}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded capitalize ${
                      o.payment_status === 'paid' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
                    }`}>
                      {o.payment_status}
                    </span>
                  </td>
                  <td className="px-5 py-3 font-bold text-gray-950">₹{o.total_amount}</td>
                  <td className="px-5 py-3 text-gray-400 text-xs">{new Date(o.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
              {(!recentOrders?.items?.length) && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-gray-400 text-xs italic">
                    No sales registrations logged yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="sm:hidden p-3 space-y-2">
          {recentOrders?.items?.slice(0, 5).map((o: Order) => (
            <div key={o.id} className="flex items-center justify-between p-3 bg-gray-50 border rounded-xl shadow-xs">
              <div>
                <p className="text-sm font-semibold text-gray-900">#{o.id}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{new Date(o.created_at).toLocaleDateString()}</p>
              </div>
              <div className="text-right space-y-1">
                <p className="text-sm font-bold text-primary">₹{o.total_amount}</p>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full capitalize border ${STATUS_COLORS[o.status] || 'bg-gray-100'}`}>
                  {o.status}
                </span>
              </div>
            </div>
          ))}
          {(!recentOrders?.items?.length) && (
            <p className="text-center text-gray-400 py-6 text-xs italic">No orders registered yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
