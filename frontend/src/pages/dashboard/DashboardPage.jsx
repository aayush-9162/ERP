import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getUsersApi } from '../../api/users.api';
import { getCompanyApi } from '../../api/company.api';
import { getInventorySummaryApi, getLowStockApi } from '../../api/inventory.api';
import { getSalesSummaryApi } from '../../api/sales.api';
import { getPurchaseSummaryApi } from '../../api/purchases.api';
import { Link } from 'react-router-dom';
import {
  HiOutlineUsers, HiOutlineCube, HiOutlineExclamation, HiOutlineCurrencyRupee,
  HiOutlineDocumentText, HiOutlineShoppingCart, HiOutlineClock, HiOutlineTruck,
} from 'react-icons/hi';

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalUsers: 0, companyName: '-',
    totalProducts: 0, lowStockCount: 0, stockValue: 0,
    totalRevenue: 0, todayRevenue: 0, todayInvoices: 0, unpaidReceivable: 0,
    totalSpent: 0, unpaidPayable: 0,
  });
  const [lowStock, setLowStock] = useState([]);

  useEffect(() => {
    async function load() {
      const [usersRes, companyRes, invRes, lowRes, salesRes, purRes] = await Promise.allSettled([
        getUsersApi({ limit: 1 }), getCompanyApi(), getInventorySummaryApi(),
        getLowStockApi(), getSalesSummaryApi(), getPurchaseSummaryApi(),
      ]);
      setStats({
        totalUsers: usersRes.status === 'fulfilled' ? usersRes.value.data.pagination?.total || 0 : 0,
        companyName: companyRes.status === 'fulfilled' ? companyRes.value.data.data.company.name : '-',
        totalProducts: invRes.status === 'fulfilled' ? invRes.value.data.data.summary.total_products : 0,
        lowStockCount: invRes.status === 'fulfilled' ? invRes.value.data.data.summary.low_stock_count : 0,
        stockValue: invRes.status === 'fulfilled' ? invRes.value.data.data.summary.total_stock_value : 0,
        totalRevenue: salesRes.status === 'fulfilled' ? salesRes.value.data.data.summary.total_revenue : 0,
        todayRevenue: salesRes.status === 'fulfilled' ? salesRes.value.data.data.summary.today_revenue : 0,
        todayInvoices: salesRes.status === 'fulfilled' ? salesRes.value.data.data.summary.today_invoices : 0,
        unpaidReceivable: salesRes.status === 'fulfilled' ? salesRes.value.data.data.summary.unpaid_amount : 0,
        totalSpent: purRes.status === 'fulfilled' ? purRes.value.data.data.summary.total_spent : 0,
        unpaidPayable: purRes.status === 'fulfilled' ? purRes.value.data.data.summary.unpaid_amount : 0,
      });
      if (lowRes.status === 'fulfilled') setLowStock(lowRes.value.data.data.products.slice(0, 5));
    }
    load();
  }, []);

  const cards = [
    { title: 'Revenue', value: `₹${stats.totalRevenue.toLocaleString('en-IN')}`, icon: HiOutlineCurrencyRupee, color: 'bg-green-500' },
    { title: 'Purchases', value: `₹${stats.totalSpent.toLocaleString('en-IN')}`, icon: HiOutlineTruck, color: 'bg-indigo-500' },
    { title: 'Today Sales', value: `${stats.todayInvoices} inv`, icon: HiOutlineShoppingCart, color: 'bg-blue-500' },
    { title: 'Receivable', value: `₹${stats.unpaidReceivable.toLocaleString('en-IN')}`, icon: HiOutlineClock, color: 'bg-amber-500' },
    { title: 'Payable', value: `₹${stats.unpaidPayable.toLocaleString('en-IN')}`, icon: HiOutlineClock, color: 'bg-red-500' },
    { title: 'Products', value: stats.totalProducts, icon: HiOutlineCube, color: 'bg-teal-500' },
    { title: 'Low Stock', value: stats.lowStockCount, icon: HiOutlineExclamation, color: 'bg-orange-500' },
    { title: 'Users', value: stats.totalUsers, icon: HiOutlineUsers, color: 'bg-gray-500' },
  ];

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500">Welcome back, {user?.first_name} — {stats.companyName}</p>
        </div>
        <div className="flex gap-2">
          <Link to="/pos" className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700">New Sale</Link>
          <Link to="/purchases/new" className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">New Purchase</Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        {cards.map((card) => (
          <div key={card.title} className="rounded-xl bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase text-gray-500">{card.title}</p>
                <p className="mt-1 text-lg font-bold text-gray-900">{card.value}</p>
              </div>
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${card.color} text-white`}>
                <card.icon className="h-4 w-4" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {lowStock.length > 0 && (
        <div className="mt-8 rounded-xl bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <HiOutlineExclamation className="h-4 w-4 text-amber-500" /> Low Stock Alerts
            </h3>
            <Link to="/inventory" className="text-xs font-medium text-primary-600 hover:underline">View all</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
                <tr><th className="px-5 py-2.5">Product</th><th className="px-5 py-2.5">SKU</th><th className="px-5 py-2.5 text-right">Stock</th><th className="px-5 py-2.5 text-right">Min Alert</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {lowStock.map((p) => (
                  <tr key={p.id} className="hover:bg-red-50/40">
                    <td className="px-5 py-2.5 font-medium">{p.name}</td>
                    <td className="px-5 py-2.5 font-mono text-xs text-gray-400">{p.sku}</td>
                    <td className="px-5 py-2.5 text-right font-semibold text-red-600">{p.total_stock}</td>
                    <td className="px-5 py-2.5 text-right text-gray-500">{p.min_stock_alert}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
