import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { getQuotationApi, updateQuotationStatusApi, convertQuotationApi } from '../../api/quotations.api';
import { getCompanyApi } from '../../api/company.api';
import { useAuth } from '../../contexts/AuthContext';
import ShareMenu from '../../components/common/ShareMenu';
import toast from 'react-hot-toast';
import { HiOutlineArrowLeft, HiOutlinePrinter } from 'react-icons/hi';

export default function QuotationViewPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin, isManager } = useAuth();
  const canManage = isAdmin || isManager;
  const [quo, setQuo] = useState(null);
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.allSettled([getQuotationApi(id), getCompanyApi()]).then(([qr, cr]) => {
      if (qr.status === 'fulfilled') setQuo(qr.value.data.data.quotation);
      if (cr.status === 'fulfilled') setCompany(cr.value.data.data.company);
      setLoading(false);
    });
  }, [id]);

  async function changeStatus(status) {
    try { await updateQuotationStatusApi(id, status); const r = await getQuotationApi(id); setQuo(r.data.data.quotation); toast.success(`Status: ${status}`); } catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
  }

  async function convert() {
    if (!confirm('Convert to sale? Stock will be deducted.')) return;
    try { const r = await convertQuotationApi(id, { paid_amount: 0 }); toast.success('Converted'); navigate(`/sales/${r.data.data.sale.id}`); } catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
  }

  if (loading) return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" /></div>;
  if (!quo) return <p className="text-center text-gray-400">Not found</p>;

  const badge = { DRAFT: 'bg-gray-100 text-gray-700', SENT: 'bg-blue-50 text-blue-700', ACCEPTED: 'bg-green-50 text-green-700', REJECTED: 'bg-red-50 text-red-700', CONVERTED: 'bg-purple-50 text-purple-700' };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between print:hidden" data-print-hide>
        <Link to="/quotations" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"><HiOutlineArrowLeft className="h-4 w-4" /> Back</Link>
        <div className="flex gap-2">
          {canManage && quo.status !== 'CONVERTED' && quo.status !== 'REJECTED' && (
            <>
              {quo.status === 'DRAFT' && <button onClick={() => changeStatus('SENT')} className="rounded-lg border px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50">Mark Sent</button>}
              {(quo.status === 'SENT' || quo.status === 'DRAFT') && <button onClick={() => changeStatus('ACCEPTED')} className="rounded-lg border px-3 py-1.5 text-sm font-medium text-green-600 hover:bg-green-50">Accept</button>}
              {quo.status !== 'CONVERTED' && <button onClick={() => changeStatus('REJECTED')} className="rounded-lg border px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50">Reject</button>}
              <button onClick={convert} className="rounded-lg bg-primary-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-primary-700">Convert to Sale</button>
            </>
          )}
          <button onClick={() => window.print()} className="flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"><HiOutlinePrinter className="h-4 w-4" /> Print</button>
          <ShareMenu docType="Quotation" docNumber={quo.quotation_number} customerName={quo.customer?.name} amount={Number(quo.final_amount).toLocaleString('en-IN')} companyName={company?.name} />
        </div>
      </div>

      <div id="printable-area" className="mx-auto max-w-3xl rounded-xl bg-white p-8 shadow-sm">
        <div className="mb-6 flex justify-between">
          <div><h1 className="text-2xl font-bold text-gray-900">{company?.name || 'ERP System'}</h1>{company && <p className="mt-1 text-xs text-gray-500">{company.address_line1}, {company.city} {company.pincode}</p>}</div>
          <div className="text-right"><h2 className="text-xl font-bold text-primary-600">QUOTATION</h2><p className="mt-1 text-sm font-medium">{quo.quotation_number}</p><p className="text-xs text-gray-500">{quo.createdAt ? new Date(quo.createdAt).toLocaleDateString('en-IN', { dateStyle: 'long' }) : '-'}</p><span className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${badge[quo.status]}`}>{quo.status}</span></div>
        </div>

        {quo.customer && <div className="mb-6 rounded-lg bg-gray-50 p-4"><p className="text-xs font-semibold uppercase text-gray-500">Customer</p><p className="mt-1 text-sm font-medium">{quo.customer.name}</p>{quo.customer.phone && <p className="text-xs text-gray-500">{quo.customer.phone}</p>}</div>}
        {quo.valid_until && <p className="mb-4 text-sm text-gray-500">Valid until: <strong>{quo.valid_until}</strong></p>}

        <table className="mb-6 w-full text-sm">
          <thead className="border-b-2 border-gray-200 text-left text-xs font-semibold uppercase text-gray-500"><tr><th className="py-2">#</th><th>Item</th><th className="text-right">Price</th><th className="text-right">Qty</th><th className="text-right">Tax</th><th className="text-right">Total</th></tr></thead>
          <tbody className="divide-y divide-gray-100">
            {quo.items?.map((i, idx) => (<tr key={i.id}><td className="py-2 text-gray-400">{idx + 1}</td><td><span className="font-medium">{i.product_name}</span> <span className="text-xs text-gray-400">{i.product_sku}</span></td><td className="text-right tabular-nums">₹{Number(i.unit_price).toLocaleString('en-IN')}</td><td className="text-right">{i.quantity}</td><td className="text-right text-xs text-gray-500">{i.tax_rate}% (₹{Number(i.tax_amount).toFixed(2)})</td><td className="text-right font-semibold tabular-nums">₹{Number(i.total).toFixed(2)}</td></tr>))}
          </tbody>
        </table>

        <div className="flex justify-end">
          <div className="w-64 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>₹{Number(quo.total_amount).toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Tax</span><span>₹{Number(quo.tax_amount).toFixed(2)}</span></div>
            {parseFloat(quo.discount_amount) > 0 && <div className="flex justify-between text-green-600"><span>Discount</span><span>-₹{Number(quo.discount_amount).toFixed(2)}</span></div>}
            <div className="flex justify-between border-t pt-1.5 text-base font-bold"><span>Total</span><span>₹{Number(quo.final_amount).toFixed(2)}</span></div>
          </div>
        </div>

        {quo.converted_sale_id && <div className="mt-6 border-t pt-4"><p className="text-sm text-gray-500">Converted to: <Link to={`/sales/${quo.converted_sale_id}`} className="font-medium text-primary-600 hover:underline">View Invoice</Link></p></div>}
        <div className="mt-4 text-xs text-gray-400">Created by: {quo.createdBy?.first_name} {quo.createdBy?.last_name}</div>
      </div>
    </div>
  );
}
