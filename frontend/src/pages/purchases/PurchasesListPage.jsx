import { useState, useEffect, useCallback } from 'react';
import { getPurchasesApi, getPurchaseSummaryApi } from '../../api/purchases.api';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { HiOutlinePlus, HiOutlineEye, HiOutlineCurrencyRupee, HiOutlineDocumentText, HiOutlineClock } from 'react-icons/hi';

export default function PurchasesListPage() {
  const [purchases, setPurchases] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const [summary, setSummary] = useState(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const fetchPurchases = useCallback(async (page = 1) => {
    try {
      const params = { page, limit: 15, search };
      if (filterStatus) params.payment_status = filterStatus;
      const res = await getPurchasesApi(params);
      setPurchases(res.data.data);
      setPagination(res.data.pagination);
    } catch { toast.error('Failed to load purchases'); }
  }, [search, filterStatus]);

  useEffect(() => { fetchPurchases(); }, [fetchPurchases]);
  useEffect(() => { getPurchaseSummaryApi().then((r) => setSummary(r.data.data.summary)).catch(() => {}); }, []);

  const badge = (status) => ({ PAID: 'bg-green-50 text-green-700', PARTIAL: 'bg-amber-50 text-amber-700', UNPAID: 'bg-red-50 text-red-700' }[status] || '');

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">Purchases</h1><p className="text-sm text-gray-500">{pagination.total} purchase orders</p></div>
        <Link to="/purchases/new" className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700"><HiOutlinePlus className="h-4 w-4" /> New Purchase</Link>
      </div>

      {summary && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><p className="text-xs text-gray-500">Total Spent</p><p className="mt-1 text-xl font-bold">₹{summary.total_spent.toLocaleString('en-IN')}</p></div><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-500 text-white"><HiOutlineCurrencyRupee className="h-5 w-5" /></div></div></div>
          <div className="rounded-xl bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><p className="text-xs text-gray-500">Today</p><p className="mt-1 text-xl font-bold">{summary.today_purchases} orders</p></div><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500 text-white"><HiOutlineDocumentText className="h-5 w-5" /></div></div></div>
          <div className="rounded-xl bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><p className="text-xs text-gray-500">Today Spent</p><p className="mt-1 text-xl font-bold">₹{summary.today_spent.toLocaleString('en-IN')}</p></div><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-500 text-white"><HiOutlineCurrencyRupee className="h-5 w-5" /></div></div></div>
          <div className="rounded-xl bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><div><p className="text-xs text-gray-500">Payable</p><p className="mt-1 text-xl font-bold text-red-600">₹{summary.unpaid_amount.toLocaleString('en-IN')}</p></div><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500 text-white"><HiOutlineClock className="h-5 w-5" /></div></div></div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap gap-3">
        <input type="text" placeholder="Search by purchase number..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full max-w-xs rounded-lg border px-4 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100" />
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary-500">
          <option value="">All Status</option><option value="PAID">Paid</option><option value="PARTIAL">Partial</option><option value="UNPAID">Unpaid</option>
        </select>
      </div>

      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
              <tr><th className="px-5 py-3">Purchase #</th><th className="px-5 py-3">Date</th><th className="px-5 py-3">Supplier</th><th className="px-5 py-3 text-right">Amount</th><th className="px-5 py-3 text-right">Paid</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">By</th><th className="px-5 py-3 text-right">View</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {purchases.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-mono text-xs font-medium">{p.purchase_number}</td>
                  <td className="px-5 py-3 text-xs text-gray-500">{new Date(p.created_at).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</td>
                  <td className="px-5 py-3">{p.supplier?.name}</td>
                  <td className="px-5 py-3 text-right font-semibold tabular-nums">₹{Number(p.final_amount).toLocaleString('en-IN')}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-gray-500">₹{Number(p.paid_amount).toLocaleString('en-IN')}</td>
                  <td className="px-5 py-3"><span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badge(p.payment_status)}`}>{p.payment_status}</span></td>
                  <td className="px-5 py-3 text-xs text-gray-500">{p.createdBy?.first_name}</td>
                  <td className="px-5 py-3 text-right"><Link to={`/purchases/${p.id}`} className="text-primary-600 hover:text-primary-700"><HiOutlineEye className="h-4 w-4" /></Link></td>
                </tr>
              ))}
              {purchases.length === 0 && <tr><td colSpan="8" className="px-5 py-8 text-center text-gray-400">No purchases found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {pagination.totalPages > 1 && (
        <div className="mt-4 flex justify-end gap-2">
          {Array.from({ length: pagination.totalPages }, (_, i) => (
            <button key={i} onClick={() => fetchPurchases(i + 1)} className={`h-8 w-8 rounded-lg text-sm font-medium ${pagination.page === i + 1 ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>{i + 1}</button>
          ))}
        </div>
      )}
    </div>
  );
}
