import { useState, useEffect } from 'react';
import { getInventoryValuationApi } from '../../api/reports.api';

export default function InventoryReportPage() {
  const [data, setData] = useState(null);

  useEffect(() => {
    getInventoryValuationApi().then((r) => setData(r.data.data)).catch(() => {});
  }, []);

  if (!data) return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" /></div>;

  const fmt = (v) => `₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Inventory Valuation Report</h1>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl bg-white p-5 shadow-sm"><p className="text-xs text-gray-500">Total Items</p><p className="mt-1 text-xl font-bold">{data.items.length}</p></div>
        <div className="rounded-xl bg-white p-5 shadow-sm"><p className="text-xs text-gray-500">Cost Value</p><p className="mt-1 text-xl font-bold text-indigo-600">{fmt(data.total_cost_value)}</p></div>
        <div className="rounded-xl bg-white p-5 shadow-sm"><p className="text-xs text-gray-500">Retail Value</p><p className="mt-1 text-xl font-bold text-green-600">{fmt(data.total_retail_value)}</p></div>
      </div>

      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
              <tr>
                <th className="px-5 py-3">Product</th>
                <th className="px-5 py-3">SKU</th>
                <th className="px-5 py-3">Category</th>
                <th className="px-5 py-3 text-right">Stock</th>
                <th className="px-5 py-3 text-right">Cost/Unit</th>
                <th className="px-5 py-3 text-right">Sell/Unit</th>
                <th className="px-5 py-3 text-right">Cost Value</th>
                <th className="px-5 py-3 text-right">Retail Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium">{item.name}</td>
                  <td className="px-5 py-3 font-mono text-xs text-gray-400">{item.sku}</td>
                  <td className="px-5 py-3 text-gray-500">{item.category || '-'}</td>
                  <td className="px-5 py-3 text-right font-semibold">{item.stock}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{fmt(item.purchase_price)}</td>
                  <td className="px-5 py-3 text-right tabular-nums">{fmt(item.selling_price)}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-indigo-600">{fmt(item.cost_value)}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-green-600">{fmt(item.retail_value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
