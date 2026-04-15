import { useState, useEffect, useCallback } from 'react';
import { getSalesApi, getSalesSummaryApi } from '../../api/sales.api';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import { HiOutlinePlus, HiOutlineEye, HiOutlineCurrencyRupee, HiOutlineDocumentText, HiOutlineClock } from 'react-icons/hi';

export default function SalesListPage() {
  const { isAdmin, isManager } = useAuth();
  const [sales, setSales] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const [summary, setSummary] = useState(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const fetchSales = useCallback(async (page = 1) => {
    try {
      const params = { page, limit: 15, search };
      if (filterStatus) params.payment_status = filterStatus;
      const res = await getSalesApi(params);
      setSales(res.data.data);
      setPagination(res.data.pagination);
    } catch {
      toast.error('Failed to load sales');
    }
  }, [search, filterStatus]);

  useEffect(() => { fetchSales(); }, [fetchSales]);
  useEffect(() => {
    getSalesSummaryApi().then((r) => setSummary(r.data.data.summary)).catch(() => {});
  }, []);

  const statusBadge = (status) => {
    const map = {
      PAID: 'bg-green-50 text-green-700',
      PARTIAL: 'bg-amber-50 text-amber-700',
      UNPAID: 'bg-red-50 text-red-700',
    };
    return `rounded-full px-2.5 py-0.5 text-xs font-medium ${map[status] || ''}`;
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sales</h1>
          <p className="text-sm text-gray-500">{pagination.total} invoices</p>
        </div>
        <Link to="/pos" className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700">
          <HiOutlinePlus className="h-4 w-4" /> New Sale
        </Link>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div><p className="text-xs text-gray-500">Total Revenue</p><p className="mt-1 text-xl font-bold">₹{summary.total_revenue.toLocaleString('en-IN')}</p></div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500 text-white"><HiOutlineCurrencyRupee className="h-5 w-5" /></div>
            </div>
          </div>
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div><p className="text-xs text-gray-500">Today</p><p className="mt-1 text-xl font-bold">{summary.today_invoices} invoices</p></div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500 text-white"><HiOutlineDocumentText className="h-5 w-5" /></div>
            </div>
          </div>
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div><p className="text-xs text-gray-500">Today Revenue</p><p className="mt-1 text-xl font-bold">₹{summary.today_revenue.toLocaleString('en-IN')}</p></div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-500 text-white"><HiOutlineCurrencyRupee className="h-5 w-5" /></div>
            </div>
          </div>
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div><p className="text-xs text-gray-500">Unpaid</p><p className="mt-1 text-xl font-bold text-red-600">₹{summary.unpaid_amount.toLocaleString('en-IN')}</p></div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500 text-white"><HiOutlineClock className="h-5 w-5" /></div>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-3">
        <input type="text" placeholder="Search by invoice number..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-xs rounded-lg border border-gray-300 px-4 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100" />
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500">
          <option value="">All Status</option>
          <option value="PAID">Paid</option>
          <option value="PARTIAL">Partial</option>
          <option value="UNPAID">Unpaid</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
              <tr>
                <th className="px-5 py-3">Invoice</th>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Customer</th>
                <th className="px-5 py-3 text-right">Amount</th>
                <th className="px-5 py-3 text-right">Paid</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Method</th>
                <th className="px-5 py-3">By</th>
                <th className="px-5 py-3 text-right">View</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sales.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-medium font-mono text-xs">{s.invoice_number}</td>
                  <td className="px-5 py-3 text-xs text-gray-500">{new Date(s.created_at).toLocaleDateString('en-IN', { dateStyle: 'medium' })}</td>
                  <td className="px-5 py-3">{s.customer?.name || <span className="text-gray-400">Walk-in</span>}</td>
                  <td className="px-5 py-3 text-right font-semibold tabular-nums">₹{Number(s.final_amount).toLocaleString('en-IN')}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-gray-500">₹{Number(s.paid_amount).toLocaleString('en-IN')}</td>
                  <td className="px-5 py-3"><span className={statusBadge(s.payment_status)}>{s.payment_status}</span></td>
                  <td className="px-5 py-3 text-xs text-gray-500">{s.payment_method || '-'}</td>
                  <td className="px-5 py-3 text-xs text-gray-500">{s.createdBy?.first_name}</td>
                  <td className="px-5 py-3 text-right">
                    <Link to={`/sales/${s.id}`} className="text-primary-600 hover:text-primary-700"><HiOutlineEye className="h-4 w-4" /></Link>
                  </td>
                </tr>
              ))}
              {sales.length === 0 && (
                <tr><td colSpan="9" className="px-5 py-8 text-center text-gray-400">No sales found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-end gap-2">
          {Array.from({ length: pagination.totalPages }, (_, i) => (
            <button key={i} onClick={() => fetchSales(i + 1)}
              className={`h-8 w-8 rounded-lg text-sm font-medium ${pagination.page === i + 1 ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
