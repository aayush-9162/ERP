import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getPaymentsApi, getPaymentsSummaryApi } from '../../api/payments.api';
import { HiOutlineArrowDown, HiOutlineArrowUp, HiOutlineSwitchHorizontal, HiOutlineEye } from 'react-icons/hi';

const fmt = (v) => `₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Default range: today only (local time)
function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function today() {
  return ymd(new Date());
}

export default function PaymentsPage() {
  const [rows, setRows]               = useState([]);
  const [pagination, setPagination]   = useState({ page: 1, total: 0, totalPages: 1 });
  const [summary, setSummary]         = useState(null);
  const [search, setSearch]           = useState('');
  const [direction, setDirection]     = useState('');     // '', 'IN', 'OUT'
  const [method, setMethod]           = useState('');     // '', 'CASH', 'UPI', 'CARD', 'BANK'
  const [from, setFrom]               = useState(today());
  const [to, setTo]                   = useState(today());

  // Build a single set of filter params used for both list and summary
  function buildFilterParams() {
    const params = {};
    if (search.trim()) params.search = search.trim();
    if (direction)     params.direction = direction;
    if (method)        params.method    = method;
    if (from)          params.from = from;
    if (to)            params.to   = to;
    return params;
  }

  const fetchRows = useCallback(async (page = 1) => {
    try {
      const res = await getPaymentsApi({ ...buildFilterParams(), page, limit: 20 });
      setRows(res.data.data);
      setPagination(res.data.pagination);
    } catch {
      toast.error('Failed to load payments');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, direction, method, from, to]);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await getPaymentsSummaryApi(buildFilterParams());
      setSummary(res.data.data.summary);
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, direction, method, from, to]);

  useEffect(() => { fetchRows(); },    [fetchRows]);
  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
        <p className="text-sm text-gray-500">Money received from customers and paid to suppliers</p>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Total Received</p>
                <p className="mt-1 text-xl font-bold text-green-700">{fmt(summary.total_in)}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500 text-white">
                <HiOutlineArrowDown className="h-5 w-5" />
              </div>
            </div>
          </div>
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Total Paid Out</p>
                <p className="mt-1 text-xl font-bold text-red-600">{fmt(summary.total_out)}</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500 text-white">
                <HiOutlineArrowUp className="h-5 w-5" />
              </div>
            </div>
          </div>
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500">Net Cash Flow</p>
                <p className={`mt-1 text-xl font-bold ${summary.net >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                  {summary.net < 0 ? '-' : ''}{fmt(Math.abs(summary.net))}
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500 text-white">
                <HiOutlineSwitchHorizontal className="h-5 w-5" />
              </div>
            </div>
          </div>
          <div className="rounded-xl bg-white p-5 shadow-sm">
            <p className="mb-2 text-xs text-gray-500">By Method</p>
            <div className="space-y-1 text-xs">
              {summary.by_method.length === 0 && <p className="text-gray-400">No payments yet</p>}
              {summary.by_method.map((m, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className="text-gray-600">
                    <span className={m.direction === 'IN' ? 'text-green-600' : 'text-red-600'}>{m.direction === 'IN' ? '↓' : '↑'}</span>{' '}
                    {m.method}
                  </span>
                  <span className="tabular-nums font-medium">{fmt(m.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search invoice/purchase #, customer or supplier..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-sm rounded-lg border border-gray-300 px-4 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
        />
        <select value={direction} onChange={(e) => setDirection(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500">
          <option value="">All Directions</option>
          <option value="IN">Received</option>
          <option value="OUT">Paid</option>
        </select>
        <select value={method} onChange={(e) => setMethod(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500">
          <option value="">All Methods</option>
          <option value="CASH">Cash</option>
          <option value="UPI">UPI</option>
          <option value="CARD">Card</option>
          <option value="BANK">Bank</option>
        </select>
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          From <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-primary-500" />
          To <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-primary-500" />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
              <tr>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Document</th>
                <th className="px-5 py-3">Party</th>
                <th className="px-5 py-3">Method</th>
                <th className="px-5 py-3">Reference</th>
                <th className="px-5 py-3 text-right">Amount</th>
                <th className="px-5 py-3 text-right">View</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((r) => (
                <tr key={`${r.direction}-${r.id}`} className="hover:bg-gray-50">
                  <td className="px-5 py-3 text-xs text-gray-500">
                    {r.created_at ? new Date(r.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }) : '-'}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${r.direction === 'IN' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                      {r.direction === 'IN' ? 'Received' : 'Paid'}
                    </span>
                  </td>
                  <td className="px-5 py-3 font-mono text-xs">{r.doc_number}</td>
                  <td className="px-5 py-3">{r.party_name || <span className="text-gray-400">—</span>}</td>
                  <td className="px-5 py-3 text-xs text-gray-600">{r.method}</td>
                  <td className="px-5 py-3 text-xs text-gray-400">{r.reference || '-'}</td>
                  <td className={`px-5 py-3 text-right font-semibold tabular-nums ${r.direction === 'IN' ? 'text-green-700' : 'text-red-600'}`}>
                    {r.direction === 'IN' ? '+' : '-'}{fmt(r.amount)}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link
                      to={r.direction === 'IN' ? `/sales/${r.related_id}` : `/purchases/${r.related_id}`}
                      className="text-primary-600 hover:text-primary-700"
                    >
                      <HiOutlineEye className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan="8" className="px-5 py-8 text-center text-gray-400">No payments found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-end gap-2">
          {Array.from({ length: pagination.totalPages }, (_, i) => (
            <button
              key={i}
              onClick={() => fetchRows(i + 1)}
              className={`h-8 w-8 rounded-lg text-sm font-medium ${pagination.page === i + 1 ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
