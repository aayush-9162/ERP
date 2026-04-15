import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getSaleApi, addPaymentApi } from '../../api/sales.api';
import { getCompanyApi } from '../../api/company.api';
import { generateEInvoiceApi } from '../../api/quotations.api';
import { useAuth } from '../../contexts/AuthContext';
import ShareMenu from '../../components/common/ShareMenu';
import toast from 'react-hot-toast';
import { HiOutlineArrowLeft, HiOutlinePrinter, HiOutlineLightningBolt } from 'react-icons/hi';

export default function InvoicePage() {
  const { id } = useParams();
  const { isAdmin, isManager } = useAuth();
  const canPay = isAdmin || isManager;

  const [sale, setSale] = useState(null);
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPayForm, setShowPayForm] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('CASH');
  const [payRef, setPayRef] = useState('');
  const [paySubmitting, setPaySubmitting] = useState(false);
  const [eInvLoading, setEInvLoading] = useState(false);

  useEffect(() => {
    async function load() {
      const [saleRes, compRes] = await Promise.allSettled([getSaleApi(id), getCompanyApi()]);
      if (saleRes.status === 'fulfilled') setSale(saleRes.value.data.data.sale);
      if (compRes.status === 'fulfilled') setCompany(compRes.value.data.data.company);
      setLoading(false);
    }
    load();
  }, [id]);

  async function handleAddPayment(e) {
    e.preventDefault();
    setPaySubmitting(true);
    try {
      await addPaymentApi(id, { amount: parseFloat(payAmount), method: payMethod, reference: payRef || undefined });
      toast.success('Payment recorded');
      const res = await getSaleApi(id);
      setSale(res.data.data.sale);
      setShowPayForm(false); setPayAmount(''); setPayRef('');
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setPaySubmitting(false); }
  }

  async function handleEInvoice() {
    setEInvLoading(true);
    try {
      await generateEInvoiceApi(id);
      toast.success('E-Invoice generated');
      const res = await getSaleApi(id);
      setSale(res.data.data.sale);
    } catch (err) { toast.error(err.response?.data?.message || 'E-Invoice failed'); }
    finally { setEInvLoading(false); }
  }

  if (loading) return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" /></div>;
  if (!sale) return <p className="text-center text-gray-400">Invoice not found</p>;

  const remaining = (parseFloat(sale.final_amount) - parseFloat(sale.paid_amount)).toFixed(2);

  return (
    <div>
      {/* Action bar */}
      <div className="mb-4 flex items-center justify-between print:hidden" data-print-hide>
        <Link to="/sales" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"><HiOutlineArrowLeft className="h-4 w-4" /> Back to Sales</Link>
        <div className="flex items-center gap-2">
          {canPay && sale.customer?.gst_number && sale.e_invoice_status !== 'GENERATED' && (
            <button onClick={handleEInvoice} disabled={eInvLoading} className="flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50">
              <HiOutlineLightningBolt className="h-4 w-4" />{eInvLoading ? 'Generating...' : 'E-Invoice'}
            </button>
          )}
          <button onClick={() => window.print()} className="flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"><HiOutlinePrinter className="h-4 w-4" /> Print</button>
          <ShareMenu docType="Invoice" docNumber={sale.invoice_number} customerName={sale.customer?.name} amount={Number(sale.final_amount).toLocaleString('en-IN')} companyName={company?.name} />
        </div>
      </div>

      {/* Printable area */}
      <div id="printable-area" className="mx-auto max-w-3xl rounded-xl bg-white p-8 shadow-sm">
        <div className="mb-6 flex justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{company?.name || 'ERP System'}</h1>
            {company && <div className="mt-1 text-xs text-gray-500"><p>{company.address_line1}{company.city ? `, ${company.city}` : ''} {company.state} {company.pincode}</p>{company.gst_number && <p>GSTIN: {company.gst_number}</p>}{company.phone && <p>Ph: {company.phone}</p>}</div>}
          </div>
          <div className="text-right">
            <h2 className="text-xl font-bold text-primary-600">INVOICE</h2>
            <p className="mt-1 text-sm font-medium">{sale.invoice_number}</p>
            <p className="text-xs text-gray-500">{new Date(sale.created_at).toLocaleDateString('en-IN', { dateStyle: 'long' })}</p>
            <span className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${sale.payment_status === 'PAID' ? 'bg-green-50 text-green-700' : sale.payment_status === 'PARTIAL' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>{sale.payment_status}</span>
            {sale.e_invoice_status === 'GENERATED' && <p className="mt-1 text-[10px] text-green-600 font-medium">E-Invoice Generated</p>}
          </div>
        </div>

        <div className="mb-6 rounded-lg bg-gray-50 p-4">
          <p className="text-xs font-semibold uppercase text-gray-500">Bill To</p>
          {sale.customer ? <div className="mt-1 text-sm"><p className="font-medium">{sale.customer.name}</p>{sale.customer.phone && <p className="text-gray-500">{sale.customer.phone}</p>}{sale.customer.gst_number && <p className="text-gray-500">GSTIN: {sale.customer.gst_number}</p>}</div> : <p className="mt-1 text-sm text-gray-500">Walk-in Customer</p>}
        </div>

        <table className="mb-6 w-full text-sm">
          <thead className="border-b-2 border-gray-200 text-left text-xs font-semibold uppercase text-gray-500"><tr><th className="py-2">#</th><th className="py-2">Item</th><th className="py-2 text-right">Price</th><th className="py-2 text-right">Qty</th><th className="py-2 text-right">Tax</th><th className="py-2 text-right">Total</th></tr></thead>
          <tbody className="divide-y divide-gray-100">
            {sale.items?.map((item, i) => (
              <tr key={item.id}><td className="py-2 text-gray-400">{i + 1}</td><td className="py-2"><span className="font-medium">{item.product_name}</span> <span className="text-xs text-gray-400">{item.product_sku}</span></td><td className="py-2 text-right tabular-nums">₹{Number(item.unit_price).toLocaleString('en-IN')}</td><td className="py-2 text-right">{item.quantity}</td><td className="py-2 text-right text-xs text-gray-500">{item.tax_rate}% (₹{Number(item.tax_amount).toFixed(2)})</td><td className="py-2 text-right font-semibold tabular-nums">₹{Number(item.total).toFixed(2)}</td></tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end">
          <div className="w-64 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span className="tabular-nums">₹{Number(sale.total_amount).toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Tax</span><span className="tabular-nums">₹{Number(sale.tax_amount).toFixed(2)}</span></div>
            {parseFloat(sale.discount_amount) > 0 && <div className="flex justify-between text-green-600"><span>Discount</span><span className="tabular-nums">-₹{Number(sale.discount_amount).toFixed(2)}</span></div>}
            <div className="flex justify-between border-t border-gray-200 pt-1.5 text-base font-bold"><span>Total</span><span className="tabular-nums">₹{Number(sale.final_amount).toFixed(2)}</span></div>
            <div className="flex justify-between text-gray-500"><span>Paid</span><span className="tabular-nums">₹{Number(sale.paid_amount).toFixed(2)}</span></div>
            {parseFloat(remaining) > 0 && <div className="flex justify-between font-semibold text-red-600"><span>Balance Due</span><span className="tabular-nums">₹{remaining}</span></div>}
          </div>
        </div>

        {sale.payments?.length > 0 && (
          <div className="mt-6 border-t pt-4"><p className="mb-2 text-xs font-semibold uppercase text-gray-500">Payment History</p>
            {sale.payments.map((p) => (<div key={p.id} className="flex items-center justify-between text-sm text-gray-600"><span>{new Date(p.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })} — {p.method}</span><span className="font-medium">₹{Number(p.amount).toFixed(2)}</span></div>))}
          </div>
        )}

        {sale.irn && <div className="mt-4 border-t pt-3"><p className="text-[10px] text-gray-400">IRN: {sale.irn}</p></div>}
        <div className="mt-4 border-t pt-4 text-xs text-gray-400">Created by: {sale.createdBy?.first_name} {sale.createdBy?.last_name}</div>
      </div>

      {/* Payment form */}
      {canPay && sale.payment_status !== 'PAID' && (
        <div className="mx-auto mt-4 max-w-3xl print:hidden" data-print-hide>
          {!showPayForm ? (
            <button onClick={() => { setShowPayForm(true); setPayAmount(remaining); }} className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700">Record Payment</button>
          ) : (
            <form onSubmit={handleAddPayment} className="flex items-end gap-3 rounded-xl bg-white p-4 shadow-sm">
              <div><label className="mb-1 block text-xs text-gray-500">Amount</label><input type="number" step="0.01" min="0.01" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} required className="w-32 rounded border px-3 py-2 text-sm" /></div>
              <div><label className="mb-1 block text-xs text-gray-500">Method</label><select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className="rounded border px-3 py-2 text-sm"><option>CASH</option><option>UPI</option><option>CARD</option></select></div>
              <div><label className="mb-1 block text-xs text-gray-500">Reference</label><input value={payRef} onChange={(e) => setPayRef(e.target.value)} placeholder="Optional" className="w-36 rounded border px-3 py-2 text-sm" /></div>
              <button type="submit" disabled={paySubmitting} className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{paySubmitting ? 'Saving...' : 'Save'}</button>
              <button type="button" onClick={() => setShowPayForm(false)} className="text-sm text-gray-500">Cancel</button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
