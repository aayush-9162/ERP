import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getDashboardStats } from '../../api/admin.api';
import { HiOutlineOfficeBuilding, HiOutlineUsers, HiOutlineCurrencyRupee, HiOutlineShoppingCart } from 'react-icons/hi';

const STATUS_COLORS = {
  active: 'bg-green-100 text-green-700',
  trial: 'bg-blue-100 text-blue-700',
  suspended: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getDashboardStats()
      .then((res) => setStats(res.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" /></div>;
  }

  if (!stats) return <p className="text-gray-500">Failed to load dashboard.</p>;

  const cards = [
    { label: 'Total Tenants', value: stats.tenants?.total_tenants || 0, sub: `${stats.tenants?.active_tenants || 0} active`, icon: HiOutlineOfficeBuilding, color: 'bg-indigo-500' },
    { label: 'Total Users', value: stats.users?.total_users || 0, sub: `${stats.users?.active_users || 0} active`, icon: HiOutlineUsers, color: 'bg-emerald-500' },
    { label: 'Total Companies', value: stats.companies?.total_companies || 0, sub: 'across all tenants', icon: HiOutlineShoppingCart, color: 'bg-amber-500' },
    { label: 'Platform Sales', value: `${Number(stats.revenue?.total_platform_revenue || 0).toLocaleString()}`, sub: `${stats.revenue?.total_sales || 0} transactions`, icon: HiOutlineCurrencyRupee, color: 'bg-rose-500' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
        <p className="text-sm text-gray-500">Platform overview and recent activity</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card) => (
          <div key={card.label} className="bg-white rounded-xl shadow-sm p-5 flex items-start gap-4">
            <div className={`${card.color} p-3 rounded-lg text-white`}>
              <card.icon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-800">{card.value}</p>
              <p className="text-sm font-medium text-gray-600">{card.label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{card.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tenant Status Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Tenant Status</h2>
          <div className="space-y-3">
            {[
              { label: 'Active', count: stats.tenants?.active_tenants, color: 'bg-green-500' },
              { label: 'Trial', count: stats.tenants?.trial_tenants, color: 'bg-blue-500' },
              { label: 'Suspended', count: stats.tenants?.suspended_tenants, color: 'bg-red-500' },
              { label: 'Cancelled', count: stats.tenants?.cancelled_tenants, color: 'bg-gray-400' },
            ].map((item) => {
              const total = stats.tenants?.total_tenants || 1;
              const pct = Math.round(((item.count || 0) / total) * 100);
              return (
                <div key={item.label} className="flex items-center gap-3">
                  <span className="text-sm text-gray-600 w-20">{item.label}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2.5">
                    <div className={`${item.color} h-2.5 rounded-full`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-sm font-medium text-gray-700 w-8 text-right">{item.count || 0}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Tenants */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-800">Recent Tenants</h2>
            <Link to="/tenants" className="text-sm text-indigo-600 hover:underline">View all</Link>
          </div>
          <div className="space-y-3">
            {stats.recentTenants?.map((t) => (
              <Link
                key={t.id}
                to={`/tenants/${t.id}`}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-gray-800">{t.business_name}</p>
                  <p className="text-xs text-gray-400">{t.owner_email} - {t.country}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[t.status] || ''}`}>
                  {t.status}
                </span>
              </Link>
            ))}
            {(!stats.recentTenants || stats.recentTenants.length === 0) && (
              <p className="text-sm text-gray-400 text-center py-4">No tenants yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
