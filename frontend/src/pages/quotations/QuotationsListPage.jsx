import { useState, useEffect, useCallback } from 'react';
import { getQuotationsApi, updateQuotationStatusApi, convertQuotationApi } from '../../api/quotations.api';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import { HiOutlinePlus, HiOutlineEye, HiOutlineRefresh } from 'react-icons/hi';

export default function QuotationsListPage() {
  const { isAdmin, isManager } = useAuth();
  const canManage = isAdmin || isManager;
  const navigate = useNavigate();

  const [quotations, setQuotations] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const fetch = useCallback(async (page = 1) => {
    try {
      const params = { page, limit: 15, search };
      if (filterStatus) params.status = filterStatus;
      const res = await getQuotationsApi(params);
      setQuotations(res.data.data);
      setPagination(res.data.pagination);
    } catch { toast.error('Failed to load'); }
  }, [search, filterStatus]);

  useEffect(() => { fetch(); }, [fetch]);

  const badge = (s) => ({
    DRAFT: 'bg-gray-100 text-gray-700', SENT: 'bg-blue-50 text-blue-700',
    ACCEPTED: 'bg-green-50 text-green-700', REJECTED: 'bg-red-50 text-red-700',
    CONVERTED: 'bg-purple-50 text-purple-700',
  }[s] || '');

  async function handleConvert(id) {
    if (!confirm('Convert this quotation to a sale? Stock will be deducted.')) return;
    try {
      const res = await convertQuotationApi(id, { payment_method: 'CASH', paid_amount: 0 });
      toast.success('Converted to sale');
      navigate(`/sales/${res.data.data.sale.id}`);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">Quotations</h1><p className="text-sm text-gray-500">{pagination.total} quotations</p></div>
        <Link to="/quotations/new" className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700"><HiOutlinePlus className="h-4 w-4" /> New Quotation</Link>
      </div>

      <div className="mb-4 flex flex-wrap gap-3">
        <input type="text" placeholder="Search by number..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full max-w-xs rounded-lg border px-4 py-2 text-sm outline-none focus:border-primary-500" />
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="rounded-lg border px-3 py-2 text-sm"><option value="">All Status</option><option>DRAFT</option><option>SENT</option><option>ACCEPTED</option><option>REJECTED</option><option>CONVERTED</option></select>
      </div>

      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
              <tr><th className="px-5 py-3">Number</th><th className="px-5 py-3">Date</th><th className="px-5 py-3">Customer</th><th className="px-5 py-3 text-right">Amount</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Valid Until</th><th className="px-5 py-3 text-right">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {quotations.map((q) => (
                <tr key={q.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 font-mono text-xs font-medium">{q.quotation_number}</td>
                  <td className="px-5 py-3 text-xs text-gray-500">{q.createdAt ? new Date(q.createdAt).toLocaleDateString('en-IN') : '-'}</td>
                  <td className="px-5 py-3">{q.customer?.name || <span className="text-gray-400">No customer</span>}</td>
                  <td className="px-5 py-3 text-right font-semibold tabular-nums">₹{Number(q.final_amount).toLocaleString('en-IN')}</td>
                  <td className="px-5 py-3"><span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badge(q.status)}`}>{q.status}</span></td>
                  <td className="px-5 py-3 text-xs text-gray-500">{q.valid_until || '-'}</td>
                  <td className="px-5 py-3 text-right flex items-center justify-end gap-2">
                    <Link to={`/quotations/${q.id}`} className="text-primary-600 hover:text-primary-700"><HiOutlineEye className="h-4 w-4" /></Link>
                    {canManage && (q.status === 'ACCEPTED' || q.status === 'DRAFT' || q.status === 'SENT') && (
                      <button onClick={() => handleConvert(q.id)} className="text-green-600 hover:text-green-700" title="Convert to Sale"><HiOutlineRefresh className="h-4 w-4" /></button>
                    )}
                  </td>
                </tr>
              ))}
              {quotations.length === 0 && <tr><td colSpan="7" className="px-5 py-8 text-center text-gray-400">No quotations found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {pagination.totalPages > 1 && (
        <div className="mt-4 flex justify-end gap-2">
          {Array.from({ length: pagination.totalPages }, (_, i) => (
            <button key={i} onClick={() => fetch(i + 1)} className={`h-8 w-8 rounded-lg text-sm font-medium ${pagination.page === i + 1 ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>{i + 1}</button>
          ))}
        </div>
      )}
    </div>
  );
}
