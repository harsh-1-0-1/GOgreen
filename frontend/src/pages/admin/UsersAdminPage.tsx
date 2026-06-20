import { useState } from 'react';
import { useAdminUsers } from '@/hooks/useAdmin';
import { Shield, User, HelpCircle, Lock, Unlock } from 'lucide-react';

export default function UsersAdminPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useAdminUsers(page);

  return (
    <div className="space-y-4">
      
      {/* Title */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">User Directory</h1>
        <p className="text-xs text-gray-500 mt-0.5">Browse registered accounts, contact details, and administration access levels.</p>
      </div>

      {/* Role Descriptions Banner */}
      <div className="bg-white border rounded-xl p-4 shadow-sm grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex gap-2">
          <div className="bg-gray-100 p-2 rounded-lg text-gray-600 h-9 w-9 flex items-center justify-center shrink-0">
            <User size={18} />
          </div>
          <div>
            <span className="text-xs font-bold text-gray-800 block">Standard Customer Role</span>
            <p className="text-[11px] text-gray-500 mt-0.5">Can place orders, add plants to carts, manage delivery addresses, and leave reviews.</p>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="bg-purple-50 p-2 rounded-lg text-purple-600 h-9 w-9 flex items-center justify-center shrink-0">
            <Shield size={18} />
          </div>
          <div>
            <span className="text-xs font-bold text-purple-900 block">Administrator Staff Role</span>
            <p className="text-[11px] text-gray-500 mt-0.5">Full backend privileges. Can configure products, design banners, and process orders.</p>
          </div>
        </div>
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block bg-white rounded-xl border overflow-x-auto shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b bg-gray-50">
              <th className="px-5 py-3.5 font-semibold text-xs">Customer ID</th>
              <th className="px-5 py-3.5 font-semibold text-xs">Customer Name</th>
              <th className="px-5 py-3.5 font-semibold text-xs">Registered Email Address</th>
              <th className="px-5 py-3.5 font-semibold text-xs">Contact Number</th>
              <th className="px-5 py-3.5 font-semibold text-xs">Account Authorization Level</th>
              <th className="px-5 py-3.5 font-semibold text-xs">Login Status</th>
              <th className="px-5 py-3.5 font-semibold text-xs">Account Created On</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="px-5 py-12 text-center text-gray-400">Loading accounts register...</td></tr>
            ) : data?.items?.length === 0 ? (
              <tr><td colSpan={7} className="px-5 py-12 text-center text-gray-400">No registered users found.</td></tr>
            ) : (
              data?.items?.map((u: any) => (
                <tr key={u.id} className="border-b last:border-0 hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-3.5 text-gray-400 font-semibold">#{u.id}</td>
                  <td className="px-5 py-3.5 font-semibold text-gray-900">{u.full_name}</td>
                  <td className="px-5 py-3.5 text-gray-700">{u.email}</td>
                  <td className="px-5 py-3.5 text-gray-500">{u.phone || '—'}</td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      u.is_admin ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {u.is_admin ? <Shield size={10} /> : <User size={10} />}
                      {u.is_admin ? 'Administrator' : 'Standard Customer'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      u.is_active ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                    }`}>
                      {u.is_active ? <Unlock size={10} /> : <Lock size={10} />}
                      {u.is_active ? 'Permitted' : 'Locked Account'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-gray-400 text-xs">
                    {u.created_at ? new Date(u.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-2">
        {isLoading ? (
          <p className="text-center text-gray-400 py-8 text-sm">Loading users...</p>
        ) : data?.items?.length === 0 ? (
          <p className="text-center text-gray-400 py-8 text-sm">No users found.</p>
        ) : (
          data?.items?.map((u: any) => (
            <div key={u.id} className="bg-white rounded-xl border p-3 shadow-sm space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-900">{u.full_name || 'Anonymous User'}</p>
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${u.is_admin ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                  {u.is_admin ? 'Admin' : 'User'}
                </span>
              </div>
              <p className="text-xs text-gray-500 truncate">{u.email}</p>
              <div className="flex items-center justify-between mt-1 pt-1.5 border-t border-gray-100 text-[10px] text-gray-400 font-medium">
                <span>📞 {u.phone || 'No phone'}</span>
                <span>Created {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {data && data.pages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1.5 border bg-white rounded-lg text-xs font-semibold disabled:opacity-30">Prev</button>
          <span className="text-xs text-gray-500 font-medium">Page {page} of {data.pages}</span>
          <button disabled={page >= data.pages} onClick={() => setPage(page + 1)} className="px-3 py-1.5 border bg-white rounded-lg text-xs font-semibold disabled:opacity-30">Next</button>
        </div>
      )}
    </div>
  );
}
