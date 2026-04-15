import { useState } from 'react';
import { getGSTR1Api, getGSTR3BApi, downloadGSTR1CSVUrl } from '../../api/quotations.api';
import toast from 'react-hot-toast';

export default function GSTReportsPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [tab, setTab] = useState('gstr1');
  const [gstr1, setGstr1] = useState(null);
  const [gstr3b, setGstr3b] = useState(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    if (!from || !to) return toast.error('Select date range');
    setLoading(true);
    try {
      if (tab === 'gstr1') { const r = await getGSTR1Api({ from, to }); setGstr1(r.data.data); }
      else { const r = await getGSTR3BApi({ from, to }); setGstr3b(r.data.data); }
    } catch { toast.error('Failed to load'); }
    finally { setLoading(false); }
  }

  const fmt = (v) => `₹${Number(v).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">GST Reports</h1>

      <div className="mb-6 flex flex-wrap items-end gap-3">
        <div><label className="mb-1 block text-xs text-gray-500">From</label><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded border px-3 py-1.5 text-sm" /></div>
        <div><label className="mb-1 block text-xs text-gray-500">To</label><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded border px-3 py-1.5 text-sm" /></div>
        <div className="flex gap-1">
          <button onClick={() => setTab('gstr1')} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${tab === 'gstr1' ? 'bg-primary-600 text-white' : 'border text-gray-700'}`}>GSTR-1</button>
          <button onClick={() => setTab('gstr3b')} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${tab === 'gstr3b' ? 'bg-primary-600 text-white' : 'border text-gray-700'}`}>GSTR-3B</button>
        </div>
        <button onClick={load} disabled={loading} className="rounded-lg bg-primary-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50">{loading ? 'Loading...' : 'Generate'}</button>
        {from && to && tab === 'gstr1' && <a href={downloadGSTR1CSVUrl({ from, to })} target="_blank" rel="noreferrer" className="rounded-lg border px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">Download CSV</a>}
      </div>

      {/* GSTR-1 */}
      {tab === 'gstr1' && gstr1 && (
        <div className="space-y-6">
          <div className="rounded-xl bg-white shadow-sm">
            <div className="border-b px-5 py-4"><h3 className="font-semibold">B2B Invoices (GST Registered) — {gstr1.b2b.count}</h3></div>
            <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500"><tr><th className="px-5 py-3">Invoice</th><th className="px-5 py-3">Customer</th><th className="px-5 py-3">GSTIN</th><th className="px-5 py-3 text-right">Taxable</th><th className="px-5 py-3 text-right">CGST</th><th className="px-5 py-3 text-right">SGST</th><th className="px-5 py-3 text-right">Total</th></tr></thead>
              <tbody className="divide-y divide-gray-100">{gstr1.b2b.invoices.map((inv, i) => (<tr key={i} className="hover:bg-gray-50"><td className="px-5 py-2.5 font-mono text-xs">{inv.invoice_number}</td><td className="px-5 py-2.5">{inv.customer_name}</td><td className="px-5 py-2.5 font-mono text-xs text-gray-500">{inv.gst_number}</td><td className="px-5 py-2.5 text-right tabular-nums">{fmt(inv.taxable_value)}</td><td className="px-5 py-2.5 text-right tabular-nums">{fmt(inv.cgst)}</td><td className="px-5 py-2.5 text-right tabular-nums">{fmt(inv.sgst)}</td><td className="px-5 py-2.5 text-right font-semibold tabular-nums">{fmt(inv.invoice_value)}</td></tr>))}</tbody></table></div>
          </div>

          <div className="rounded-xl bg-white shadow-sm">
            <div className="border-b px-5 py-4"><h3 className="font-semibold">B2C Invoices (Unregistered) — {gstr1.b2c.count}</h3></div>
            <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500"><tr><th className="px-5 py-3">Invoice</th><th className="px-5 py-3">Customer</th><th className="px-5 py-3 text-right">Taxable</th><th className="px-5 py-3 text-right">CGST</th><th className="px-5 py-3 text-right">SGST</th><th className="px-5 py-3 text-right">Total</th></tr></thead>
              <tbody className="divide-y divide-gray-100">{gstr1.b2c.invoices.map((inv, i) => (<tr key={i} className="hover:bg-gray-50"><td className="px-5 py-2.5 font-mono text-xs">{inv.invoice_number}</td><td className="px-5 py-2.5">{inv.customer_name}</td><td className="px-5 py-2.5 text-right tabular-nums">{fmt(inv.taxable_value)}</td><td className="px-5 py-2.5 text-right tabular-nums">{fmt(inv.cgst)}</td><td className="px-5 py-2.5 text-right tabular-nums">{fmt(inv.sgst)}</td><td className="px-5 py-2.5 text-right font-semibold tabular-nums">{fmt(inv.invoice_value)}</td></tr>))}</tbody></table></div>
          </div>

          {gstr1.hsn_summary?.length > 0 && (
            <div className="rounded-xl bg-white shadow-sm">
              <div className="border-b px-5 py-4"><h3 className="font-semibold">HSN-wise Summary</h3></div>
              <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500"><tr><th className="px-5 py-3">HSN</th><th className="px-5 py-3">Description</th><th className="px-5 py-3 text-right">Qty</th><th className="px-5 py-3 text-right">Rate</th><th className="px-5 py-3 text-right">Taxable</th><th className="px-5 py-3 text-right">Tax</th></tr></thead>
                <tbody className="divide-y divide-gray-100">{gstr1.hsn_summary.map((h, i) => (<tr key={i} className="hover:bg-gray-50"><td className="px-5 py-2.5 font-mono text-xs">{h.hsn_code}</td><td className="px-5 py-2.5">{h.description}</td><td className="px-5 py-2.5 text-right">{h.total_qty}</td><td className="px-5 py-2.5 text-right">{h.gst_rate}%</td><td className="px-5 py-2.5 text-right tabular-nums">{fmt(h.taxable_value)}</td><td className="px-5 py-2.5 text-right tabular-nums">{fmt(h.total_tax)}</td></tr>))}</tbody></table></div>
            </div>
          )}
        </div>
      )}

      {/* GSTR-3B */}
      {tab === 'gstr3b' && gstr3b && (
        <div className="mx-auto max-w-2xl rounded-xl bg-white p-8 shadow-sm">
          <h2 className="mb-6 text-lg font-bold text-gray-900">GSTR-3B Summary</h2>
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b-2"><td className="py-3 font-bold" colSpan="4">3.1 Outward Supplies ({gstr3b.outward_supplies.invoice_count} invoices)</td></tr>
              <tr><td className="py-2 pl-4 text-gray-600">Taxable Value</td><td className="text-right">{fmt(gstr3b.outward_supplies.taxable_value)}</td></tr>
              <tr><td className="py-2 pl-4 text-gray-600">CGST</td><td className="text-right">{fmt(gstr3b.outward_supplies.cgst)}</td></tr>
              <tr className="border-b"><td className="py-2 pl-4 text-gray-600">SGST</td><td className="text-right">{fmt(gstr3b.outward_supplies.sgst)}</td></tr>

              <tr className="border-b-2"><td className="py-3 font-bold" colSpan="4">4. Input Tax Credit ({gstr3b.inward_supplies.invoice_count} invoices)</td></tr>
              <tr><td className="py-2 pl-4 text-gray-600">Taxable Value</td><td className="text-right">{fmt(gstr3b.inward_supplies.taxable_value)}</td></tr>
              <tr><td className="py-2 pl-4 text-gray-600">CGST</td><td className="text-right">{fmt(gstr3b.inward_supplies.cgst)}</td></tr>
              <tr className="border-b"><td className="py-2 pl-4 text-gray-600">SGST</td><td className="text-right">{fmt(gstr3b.inward_supplies.sgst)}</td></tr>

              <tr className="bg-gray-900 text-white"><td className="py-3 pl-4 font-bold">6.1 Net Tax Payable</td><td className="text-right font-bold">{fmt(gstr3b.net_tax_payable.total)}</td></tr>
              <tr><td className="py-2 pl-4 text-gray-600">CGST</td><td className="text-right">{fmt(gstr3b.net_tax_payable.cgst)}</td></tr>
              <tr><td className="py-2 pl-4 text-gray-600">SGST</td><td className="text-right">{fmt(gstr3b.net_tax_payable.sgst)}</td></tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
