import { useState, useEffect } from 'react';
import { getAccountsApi, getAccountTransactionsApi } from '../../api/reports.api';

export default function AccountsPage() {
  const [accounts, setAccounts] = useState([]);
  const [selected, setSelected] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [txPagination, setTxPagination] = useState({ page: 1, totalPages: 1 });

  useEffect(() => {
    getAccountsApi().then((r) => setAccounts(r.data.data.accounts)).catch(() => {});
  }, []);

  async function loadTransactions(accId, page = 1) {
    setSelected(accId);
    const r = await getAccountTransactionsApi(accId, { page, limit: 20 });
    setTransactions(r.data.data);
    setTxPagination(r.data.pagination);
  }

  const fmt = (v) => `₹${Math.abs(Number(v)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
  const typeColor = { ASSET: 'text-blue-700 bg-blue-50', LIABILITY: 'text-red-700 bg-red-50', INCOME: 'text-green-700 bg-green-50', EXPENSE: 'text-amber-700 bg-amber-50' };

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Chart of Accounts</h1>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Accounts list */}
        <div className="lg:col-span-1">
          <div className="rounded-xl bg-white shadow-sm">
            <div className="border-b px-5 py-4"><h3 className="font-semibold text-gray-900">Accounts</h3></div>
            <div className="divide-y divide-gray-100">
              {accounts.map((a) => (
                <button key={a.id} onClick={() => loadTransactions(a.id)}
                  className={`flex w-full items-center justify-between px-5 py-3 text-left text-sm hover:bg-gray-50 ${selected === a.id ? 'bg-primary-50' : ''}`}>
                  <div>
                    <p className="font-medium">{a.name}</p>
                    <span className={`mt-0.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${typeColor[a.type]}`}>{a.type}</span>
                  </div>
                  <span className={`font-semibold tabular-nums ${parseFloat(a.balance) >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                    {parseFloat(a.balance) < 0 ? '-' : ''}{fmt(a.balance)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Transactions */}
        <div className="lg:col-span-2">
          {selected ? (
            <div className="rounded-xl bg-white shadow-sm">
              <div className="border-b px-5 py-4">
                <h3 className="font-semibold text-gray-900">Transactions — {accounts.find((a) => a.id === selected)?.name}</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
                    <tr>
                      <th className="px-5 py-3">Date</th>
                      <th className="px-5 py-3">Description</th>
                      <th className="px-5 py-3">Type</th>
                      <th className="px-5 py-3">Ref</th>
                      <th className="px-5 py-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {transactions.map((t) => (
                      <tr key={t.id} className="hover:bg-gray-50">
                        <td className="px-5 py-2.5 text-xs text-gray-500">{new Date(t.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</td>
                        <td className="px-5 py-2.5">{t.description}</td>
                        <td className="px-5 py-2.5">
                          <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${t.type === 'DEBIT' ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'}`}>{t.type}</span>
                        </td>
                        <td className="px-5 py-2.5 text-xs text-gray-400">{t.reference_type}#{t.reference_id}</td>
                        <td className={`px-5 py-2.5 text-right font-semibold tabular-nums ${t.type === 'DEBIT' ? 'text-blue-700' : 'text-green-700'}`}>{fmt(t.amount)}</td>
                      </tr>
                    ))}
                    {transactions.length === 0 && <tr><td colSpan="5" className="px-5 py-8 text-center text-gray-400">No transactions</td></tr>}
                  </tbody>
                </table>
              </div>
              {txPagination.totalPages > 1 && (
                <div className="flex justify-end gap-2 border-t px-5 py-3">
                  {Array.from({ length: txPagination.totalPages }, (_, i) => (
                    <button key={i} onClick={() => loadTransactions(selected, i + 1)}
                      className={`h-7 w-7 rounded text-xs font-medium ${txPagination.page === i + 1 ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>{i + 1}</button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-64 items-center justify-center rounded-xl bg-white shadow-sm text-gray-400">Select an account to view transactions</div>
          )}
        </div>
      </div>
    </div>
  );
}
