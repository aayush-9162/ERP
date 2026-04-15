import { useState, useEffect } from 'react';
import { getCustomerReportApi, getCustomerLedgerApi } from '../../api/reports.api';
import { HiOutlineCurrencyRupee, HiOutlineExclamation } from 'react-icons/hi';

export default function CustomerLedgerPage() {
  const [customers, setCustomers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [ledger, setLedger] = useState(null);

  useEffect(() => {
    getCustomerReportApi().then((r) => setCustomers(r.data.data.customers)).catch(() => {});
  }, []);

  async function loadLedger(id) {
    setSelected(id);
    const r = await getCustomerLedgerApi(id);
    setLedger(r.data.data);
  }

  const fmt = (v) => `₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  const statusBadge = (s) => ({ PAID: 'bg-green-50 text-green-700', PARTIAL: 'bg-amber-50 text-amber-700', UNPAID: 'bg-red-50 text-red-700' }[s] || '');

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Customer Report & Ledger</h1>

      {/* Customer summary table */}
      <div className="mb-8 overflow-hidden rounded-xl bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
              <tr>
                <th className="px-5 py-3">Customer</th>
                <th className="px-5 py-3">Phone</th>
                <th className="px-5 py-3 text-right">Orders</th>
                <th className="px-5 py-3 text-right">Total Spent</th>
                <th className="px-5 py-3 text-right">Outstanding</th>
                <th className="px-5 py-3 text-right">Credit Limit</th>
                <th className="px-5 py-3">Last Purchase</th>
                <th className="px-5 py-3 text-right">Ledger</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {customers.map((c) => (
                <tr key={c.id} className={`hover:bg-gray-50 ${selected === c.id ? 'bg-primary-50' : ''}`}>
                  <td className="px-5 py-3 font-medium">{c.name}</td>
                  <td className="px-5 py-3 text-gray-500">{c.phone || '-'}</td>
                  <td className="px-5 py-3 text-right">{c.total_orders}</td>
                  <td className="px-5 py-3 text-right tabular-nums font-semibold">{fmt(c.total_spent)}</td>
                  <td className="px-5 py-3 text-right tabular-nums">
                    {parseFloat(c.outstanding) > 0 ? (
                      <span className="flex items-center justify-end gap-1 font-semibold text-red-600">
                        <HiOutlineExclamation className="h-3.5 w-3.5" />{fmt(c.outstanding)}
                      </span>
                    ) : <span className="text-green-600">{fmt(0)}</span>}
                  </td>
                  <td className="px-5 py-3 text-right tabular-nums text-gray-500">{parseFloat(c.credit_limit) > 0 ? fmt(c.credit_limit) : '-'}</td>
                  <td className="px-5 py-3 text-xs text-gray-500">{c.last_purchase_date ? new Date(c.last_purchase_date).toLocaleDateString('en-IN') : '-'}</td>
                  <td className="px-5 py-3 text-right">
                    <button onClick={() => loadLedger(c.id)} className="text-xs font-medium text-primary-600 hover:underline">View</button>
                  </td>
                </tr>
              ))}
              {customers.length === 0 && <tr><td colSpan="8" className="px-5 py-8 text-center text-gray-400">No customers</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Customer ledger detail */}
      {ledger && (
        <div className="rounded-xl bg-white shadow-sm">
          <div className="border-b border-gray-100 px-5 py-4 flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Ledger — {customers.find((c) => c.id === selected)?.name}</h3>
            <div className="flex gap-4 text-sm">
              <span>Total: <strong>{fmt(ledger.summary.total_sales)}</strong></span>
              <span>Paid: <strong className="text-green-600">{fmt(ledger.summary.total_paid)}</strong></span>
              <span>Outstanding: <strong className="text-red-600">{fmt(ledger.summary.outstanding)}</strong></span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
                <tr>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Reference</th>
                  <th className="px-5 py-3 text-right">Amount</th>
                  <th className="px-5 py-3 text-right">Paid</th>
                  <th className="px-5 py-3 text-right">Balance</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {ledger.entries.map((e) => (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="px-5 py-2.5 text-xs text-gray-500">{new Date(e.created_at).toLocaleDateString('en-IN')}</td>
                    <td className="px-5 py-2.5 font-mono text-xs">{e.reference}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums">{fmt(e.amount)}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums text-green-600">{fmt(e.paid_amount)}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums font-semibold text-red-600">{parseFloat(e.balance) > 0 ? fmt(e.balance) : fmt(0)}</td>
                    <td className="px-5 py-2.5"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge(e.status)}`}>{e.status}</span></td>
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
