import { useState, useEffect } from 'react';
import { getProfitLossApi, getSalesReportApi, getTopProductsApi } from '../../api/reports.api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Link } from 'react-router-dom';
import { HiOutlineCurrencyRupee, HiOutlineTrendingUp, HiOutlineTrendingDown, HiOutlineChartBar } from 'react-icons/hi';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

export default function ReportsDashboard() {
  const [pnl, setPnl] = useState(null);
  const [salesChart, setSalesChart] = useState([]);
  const [topProducts, setTopProducts] = useState([]);

  useEffect(() => {
    getProfitLossApi().then((r) => setPnl(r.data.data)).catch(() => {});
    getSalesReportApi({ group_by: 'day' }).then((r) => setSalesChart(r.data.data.report.slice(0, 30).reverse())).catch(() => {});
    getTopProductsApi({ limit: 8 }).then((r) => setTopProducts(r.data.data.products)).catch(() => {});
  }, []);

  const cards = pnl ? [
    { title: 'Sales Revenue', value: `₹${pnl.sales.revenue.toLocaleString('en-IN')}`, icon: HiOutlineTrendingUp, color: 'bg-green-500' },
    { title: 'Purchase Cost', value: `₹${pnl.purchases.cost.toLocaleString('en-IN')}`, icon: HiOutlineTrendingDown, color: 'bg-indigo-500' },
    { title: 'Gross Profit', value: `₹${pnl.gross_profit.toLocaleString('en-IN')}`, icon: HiOutlineCurrencyRupee, color: pnl.gross_profit >= 0 ? 'bg-emerald-500' : 'bg-red-500' },
    { title: 'Gross Margin', value: `${pnl.gross_margin}%`, icon: HiOutlineChartBar, color: 'bg-blue-500' },
  ] : [];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-sm text-gray-500">Financial overview and analytics</p>
        </div>
        <div className="flex gap-2">
          <Link to="/reports/profit-loss" className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">P&L Statement</Link>
          <Link to="/reports/inventory" className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Inventory Report</Link>
        </div>
      </div>

      {/* P&L Cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.title} className="rounded-xl bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div><p className="text-xs text-gray-500">{c.title}</p><p className="mt-1 text-xl font-bold text-gray-900">{c.value}</p></div>
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${c.color} text-white`}><c.icon className="h-5 w-5" /></div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Sales Chart */}
        <div className="lg:col-span-2 rounded-xl bg-white p-5 shadow-sm">
          <h3 className="mb-4 font-semibold text-gray-900">Sales Trend (Daily)</h3>
          {salesChart.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={salesChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="period" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => `₹${Number(v).toLocaleString('en-IN')}`} />
                <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="py-16 text-center text-gray-400">No sales data yet</p>}
        </div>

        {/* Top Products */}
        <div className="rounded-xl bg-white p-5 shadow-sm">
          <h3 className="mb-4 font-semibold text-gray-900">Top Selling Products</h3>
          {topProducts.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={topProducts} dataKey="total_qty" nameKey="product_name" cx="50%" cy="50%" outerRadius={80} label={false}>
                    {topProducts.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v, name) => [`${v} units`, name]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-3 space-y-1.5">
                {topProducts.slice(0, 5).map((p, i) => (
                  <div key={p.product_id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="truncate" style={{ maxWidth: 140 }}>{p.product_name}</span>
                    </div>
                    <span className="text-gray-500">{p.total_qty} sold</span>
                  </div>
                ))}
              </div>
            </>
          ) : <p className="py-16 text-center text-gray-400">No data</p>}
        </div>
      </div>
    </div>
  );
}
