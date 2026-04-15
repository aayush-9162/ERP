import { useState, useEffect } from 'react';
import { getInventorySummaryApi, getLowStockApi } from '../../api/inventory.api';
import { useAuth } from '../../contexts/AuthContext';
import { Link } from 'react-router-dom';
import {
  HiOutlineCube, HiOutlineExclamation, HiOutlineBan,
  HiOutlineTag, HiOutlineCurrencyRupee, HiOutlineCollection,
} from 'react-icons/hi';

export default function InventoryDashboardPage() {
  const { isAdmin, isManager } = useAuth();
  const canAdjust = isAdmin || isManager;

  const [summary, setSummary] = useState(null);
  const [lowStock, setLowStock] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [sumRes, lowRes] = await Promise.allSettled([
          getInventorySummaryApi(),
          getLowStockApi(),
        ]);
        if (sumRes.status === 'fulfilled') setSummary(sumRes.value.data.data.summary);
        if (lowRes.status === 'fulfilled') setLowStock(lowRes.value.data.data.products);
      } catch { /* non-critical */ }
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" /></div>;
  }

  const cards = summary ? [
    { title: 'Total Products', value: summary.total_products, icon: HiOutlineCube, color: 'bg-blue-500' },
    { title: 'Categories', value: summary.total_categories, icon: HiOutlineTag, color: 'bg-purple-500' },
    { title: 'Low Stock', value: summary.low_stock_count, icon: HiOutlineExclamation, color: 'bg-amber-500' },
    { title: 'Out of Stock', value: summary.out_of_stock_count, icon: HiOutlineBan, color: 'bg-red-500' },
    { title: 'Brands', value: summary.total_brands, icon: HiOutlineCollection, color: 'bg-teal-500' },
    { title: 'Stock Value', value: `₹${summary.total_stock_value.toLocaleString('en-IN')}`, icon: HiOutlineCurrencyRupee, color: 'bg-green-500' },
  ] : [];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inventory Overview</h1>
          <p className="text-sm text-gray-500">Stock summary and alerts</p>
        </div>
        <div className="flex gap-3">
          <Link to="/inventory/products" className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            View Products
          </Link>
          {canAdjust && (
            <Link to="/inventory/stock" className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700">
              Stock Adjustment
            </Link>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {cards.map((card) => (
          <div key={card.title} className="rounded-xl bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">{card.title}</p>
                <p className="mt-1 text-xl font-bold text-gray-900">{card.value}</p>
              </div>
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${card.color} text-white`}>
                <card.icon className="h-5 w-5" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Low Stock Alert Table */}
      <div className="rounded-xl bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-4">
          <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
            <HiOutlineExclamation className="h-5 w-5 text-amber-500" />
            Low Stock Alerts ({lowStock.length})
          </h2>
        </div>
        {lowStock.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-gray-400">All products are sufficiently stocked</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
                <tr>
                  <th className="px-5 py-3">Product</th>
                  <th className="px-5 py-3">SKU</th>
                  <th className="px-5 py-3">Category</th>
                  <th className="px-5 py-3 text-right">Current Stock</th>
                  <th className="px-5 py-3 text-right">Min Alert</th>
                  <th className="px-5 py-3 text-right">Deficit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {lowStock.map((p) => (
                  <tr key={p.id} className="hover:bg-red-50/50">
                    <td className="px-5 py-3 font-medium">{p.name}</td>
                    <td className="px-5 py-3 font-mono text-xs text-gray-500">{p.sku}</td>
                    <td className="px-5 py-3 text-gray-500">{p.category?.name || '-'}</td>
                    <td className="px-5 py-3 text-right">
                      <span className={`font-semibold ${p.total_stock === 0 ? 'text-red-600' : 'text-amber-600'}`}>
                        {p.total_stock}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right text-gray-500">{p.min_stock_alert}</td>
                    <td className="px-5 py-3 text-right font-semibold text-red-600">
                      {p.min_stock_alert - p.total_stock}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
