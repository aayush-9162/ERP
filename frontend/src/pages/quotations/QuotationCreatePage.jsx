import { useState, useEffect, useRef, useCallback } from 'react';
import { getProductsApi } from '../../api/inventory.api';
import { searchCustomersApi, createCustomerApi } from '../../api/sales.api';
import { createQuotationApi } from '../../api/quotations.api';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { HiOutlineSearch, HiOutlinePlus, HiOutlineMinus, HiOutlineTrash, HiOutlineX } from 'react-icons/hi';

export default function QuotationCreatePage() {
  const navigate = useNavigate();
  const [cart, setCart] = useState([]);
  const [discount, setDiscount] = useState(0);
  const [validUntil, setValidUntil] = useState('');

  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState([]);
  const [showProdDD, setShowProdDD] = useState(false);
  const searchRef = useRef(null);

  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showCustDD, setShowCustDD] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const search = useCallback((q) => {
    if (searchRef.current) clearTimeout(searchRef.current);
    if (!q.trim()) { setProductResults([]); setShowProdDD(false); return; }
    searchRef.current = setTimeout(async () => {
      try { const r = await getProductsApi({ search: q, limit: 8, status: 'active' }); setProductResults(r.data.data); setShowProdDD(true); } catch {}
    }, 300);
  }, []);
  useEffect(() => { search(productSearch); return () => { if (searchRef.current) clearTimeout(searchRef.current); }; }, [productSearch, search]);

  useEffect(() => {
    if (!customerSearch.trim()) { setCustomerResults([]); return; }
    const t = setTimeout(async () => { try { const r = await searchCustomersApi(customerSearch); setCustomerResults(r.data.data.customers); setShowCustDD(true); } catch {} }, 300);
    return () => clearTimeout(t);
  }, [customerSearch]);

  function addToCart(p) {
    setCart((prev) => {
      const existing = prev.find((c) => c.product_id === p.id);
      if (existing) return prev.map((c) => c.product_id === p.id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { product_id: p.id, name: p.name, sku: p.sku, unit_price: parseFloat(p.selling_price), tax_rate: parseFloat(p.tax_rate), quantity: 1 }];
    });
    setProductSearch(''); setShowProdDD(false);
  }

  const subtotal = cart.reduce((s, c) => s + c.unit_price * c.quantity, 0);
  const taxTotal = cart.reduce((s, c) => s + Math.round(c.unit_price * c.quantity * c.tax_rate) / 100, 0);
  const effDisc = Math.min(discount, subtotal + taxTotal);
  const finalAmount = Math.max(0, Math.round((subtotal + taxTotal - effDisc) * 100) / 100);

  async function handleSubmit() {
    if (cart.length === 0) return toast.error('Add items');
    setSubmitting(true);
    try {
      const res = await createQuotationApi({
        customer_id: selectedCustomer?.id || null,
        items: cart.map((c) => ({ product_id: c.product_id, quantity: c.quantity, unit_price: c.unit_price })),
        discount_amount: effDisc, valid_until: validUntil || undefined,
      });
      toast.success(`Quotation ${res.data.data.quotation.quotation_number} created`);
      navigate(`/quotations/${res.data.data.quotation.id}`);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="flex h-[calc(100vh-3rem)] gap-4">
      <div className="flex flex-1 flex-col">
        <h1 className="mb-4 text-2xl font-bold text-gray-900">New Quotation</h1>
        <div className="relative mb-4">
          <HiOutlineSearch className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input value={productSearch} onChange={(e) => setProductSearch(e.target.value)} onFocus={() => productResults.length > 0 && setShowProdDD(true)} onBlur={() => setTimeout(() => setShowProdDD(false), 200)} placeholder="Search products..." className="w-full rounded-lg border py-3 pl-10 pr-4 text-sm outline-none focus:border-primary-500" />
          {showProdDD && productResults.length > 0 && (
            <div className="absolute z-30 mt-1 w-full rounded-lg border bg-white shadow-lg">
              {productResults.map((p) => (<button key={p.id} onMouseDown={() => addToCart(p)} className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-primary-50"><div><span className="font-medium">{p.name}</span> <span className="text-xs text-gray-400">{p.sku}</span></div><span className="font-semibold">₹{Number(p.selling_price).toLocaleString('en-IN')}</span></button>))}
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto rounded-xl bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500"><tr><th className="px-4 py-3">Product</th><th className="px-4 py-3 text-right">Price</th><th className="px-4 py-3 text-center">Qty</th><th className="px-4 py-3 text-right">Tax</th><th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3"></th></tr></thead>
            <tbody className="divide-y divide-gray-100">
              {cart.map((c) => { const ls = c.unit_price * c.quantity; const lt = Math.round(ls * c.tax_rate) / 100; return (
                <tr key={c.product_id}><td className="px-4 py-3"><div className="font-medium">{c.name}</div><div className="text-xs text-gray-400">{c.sku}</div></td><td className="px-4 py-3 text-right tabular-nums">₹{c.unit_price.toLocaleString('en-IN')}</td><td className="px-4 py-3"><div className="flex items-center justify-center gap-1"><button onClick={() => setCart((p) => p.map((x) => x.product_id === c.product_id ? { ...x, quantity: Math.max(1, x.quantity - 1) } : x))} className="rounded p-1 hover:bg-gray-100"><HiOutlineMinus className="h-3.5 w-3.5" /></button><span className="w-8 text-center font-semibold">{c.quantity}</span><button onClick={() => setCart((p) => p.map((x) => x.product_id === c.product_id ? { ...x, quantity: x.quantity + 1 } : x))} className="rounded p-1 hover:bg-gray-100"><HiOutlinePlus className="h-3.5 w-3.5" /></button></div></td><td className="px-4 py-3 text-right text-xs text-gray-500">{c.tax_rate}% = ₹{lt.toFixed(2)}</td><td className="px-4 py-3 text-right font-semibold tabular-nums">₹{(ls + lt).toFixed(2)}</td><td className="px-4 py-3 text-right"><button onClick={() => setCart((p) => p.filter((x) => x.product_id !== c.product_id))} className="text-gray-400 hover:text-red-500"><HiOutlineTrash className="h-4 w-4" /></button></td></tr>
              ); })}
              {cart.length === 0 && <tr><td colSpan="6" className="px-4 py-12 text-center text-gray-400">Add products to create a quotation</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="w-80 flex-shrink-0 rounded-xl bg-white p-5 shadow-sm flex flex-col">
        <h3 className="mb-4 font-semibold text-gray-900">Quotation Details</h3>
        <div className="mb-4">
          <label className="mb-1 block text-xs font-medium text-gray-500 uppercase">Customer</label>
          {selectedCustomer ? (
            <div className="flex items-center justify-between rounded-lg border px-3 py-2"><div><p className="text-sm font-medium">{selectedCustomer.name}</p></div><button onClick={() => { setSelectedCustomer(null); setCustomerSearch(''); }} className="text-gray-400 hover:text-red-500"><HiOutlineX className="h-4 w-4" /></button></div>
          ) : (
            <div className="relative"><input value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} onFocus={() => customerResults.length > 0 && setShowCustDD(true)} onBlur={() => setTimeout(() => setShowCustDD(false), 200)} placeholder="Search..." className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary-500" />
              {showCustDD && customerResults.length > 0 && (<div className="absolute z-20 mt-1 w-full rounded-lg border bg-white shadow-lg">{customerResults.map((c) => (<button key={c.id} onMouseDown={() => { setSelectedCustomer(c); setShowCustDD(false); setCustomerSearch(''); }} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-primary-50"><span>{c.name}</span></button>))}</div>)}
            </div>
          )}
        </div>
        <div className="mb-4"><label className="mb-1 block text-xs font-medium text-gray-500 uppercase">Valid Until</label><input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary-500" /></div>
        <div className="mb-4"><label className="mb-1 block text-xs font-medium text-gray-500 uppercase">Discount (₹)</label><input type="number" min="0" value={discount || ''} onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)} className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary-500" /></div>
        <div className="flex-1" />
        <div className="border-t pt-4 space-y-1.5 text-sm">
          <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span></div>
          <div className="flex justify-between text-gray-500"><span>Tax (GST)</span><span>₹{taxTotal.toFixed(2)}</span></div>
          {effDisc > 0 && <div className="flex justify-between text-green-600"><span>Discount</span><span>-₹{effDisc.toFixed(2)}</span></div>}
          <div className="flex justify-between border-t pt-2 text-lg font-bold text-gray-900"><span>Total</span><span>₹{finalAmount.toFixed(2)}</span></div>
        </div>
        <button onClick={handleSubmit} disabled={submitting || cart.length === 0} className="mt-4 w-full rounded-lg bg-primary-600 py-3 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">{submitting ? 'Creating...' : 'Create Quotation'}</button>
      </div>
    </div>
  );
}
