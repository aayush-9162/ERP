import { useState, useEffect } from 'react';
import { getProfitLossApi } from '../../api/reports.api';

export default function ProfitLossPage() {
  const [pnl, setPnl] = useState(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  function load() {
    const params = {};
    if (from) params.from = from;
    if (to) params.to = to;
    getProfitLossApi(params).then((r) => setPnl(r.data.data)).catch(() => {});
  }

  useEffect(() => { load(); }, []);

  if (!pnl) return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" /></div>;

  const fmt = (v) => `₹${v.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Profit & Loss Statement</h1>
        <div className="flex items-center gap-2">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded border px-3 py-1.5 text-sm" />
          <span className="text-gray-400">to</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded border px-3 py-1.5 text-sm" />
          <button onClick={load} className="rounded-lg bg-primary-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-700">Apply</button>
        </div>
      </div>

      <div className="mx-auto max-w-2xl rounded-xl bg-white p-8 shadow-sm">
        <table className="w-full text-sm">
          <tbody>
            <tr className="border-b-2 border-gray-200"><td className="py-3 text-base font-bold text-gray-900" colSpan="2">Income</td></tr>
            <tr><td className="py-2 pl-4 text-gray-600">Sales Revenue</td><td className="py-2 text-right font-medium tabular-nums">{fmt(pnl.sales.revenue)}</td></tr>
            <tr className="border-b"><td className="py-2 pl-4 text-gray-600">Less: Discount Given</td><td className="py-2 text-right text-red-600 tabular-nums">-{fmt(pnl.sales.discount)}</td></tr>
            <tr><td className="py-3 pl-4 font-semibold">Net Sales</td><td className="py-3 text-right font-semibold tabular-nums">{fmt(pnl.sales.revenue - pnl.sales.discount)}</td></tr>

            <tr className="border-b-2 border-gray-200"><td className="py-3 text-base font-bold text-gray-900" colSpan="2">Cost of Goods</td></tr>
            <tr className="border-b"><td className="py-2 pl-4 text-gray-600">Purchase Cost</td><td className="py-2 text-right tabular-nums">{fmt(pnl.purchases.cost)}</td></tr>

            <tr className="bg-gray-50"><td className="py-3 pl-4 text-base font-bold text-emerald-700">Gross Profit</td><td className="py-3 text-right text-base font-bold text-emerald-700 tabular-nums">{fmt(pnl.gross_profit)}</td></tr>
            <tr><td className="py-2 pl-4 text-gray-500">Gross Margin</td><td className="py-2 text-right text-gray-500">{pnl.gross_margin}%</td></tr>

            <tr className="border-b-2 border-gray-200"><td className="py-3 text-base font-bold text-gray-900" colSpan="2">Tax Summary</td></tr>
            <tr><td className="py-2 pl-4 text-gray-600">GST Collected (Output)</td><td className="py-2 text-right tabular-nums">{fmt(pnl.sales.tax)}</td></tr>
            <tr className="border-b"><td className="py-2 pl-4 text-gray-600">GST Paid (Input)</td><td className="py-2 text-right tabular-nums">{fmt(pnl.purchases.tax)}</td></tr>
            <tr><td className="py-2 pl-4 font-semibold">Net GST Payable</td><td className="py-2 text-right font-semibold tabular-nums">{fmt(pnl.sales.tax - pnl.purchases.tax)}</td></tr>

            <tr className="border-t-2 border-gray-800 bg-gray-900 text-white">
              <td className="py-4 pl-4 text-base font-bold">Net Profit (incl. tax)</td>
              <td className={`py-4 text-right text-base font-bold tabular-nums ${pnl.net_profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmt(pnl.net_profit)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
