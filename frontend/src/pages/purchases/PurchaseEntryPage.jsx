import { useState, useEffect, useRef, useCallback } from 'react';
import { getProductsApi } from '../../api/inventory.api';
import { searchSuppliersApi, createSupplierApi, createPurchaseApi } from '../../api/purchases.api';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { HiOutlineSearch, HiOutlinePlus, HiOutlineMinus, HiOutlineTrash, HiOutlineX } from 'react-icons/hi';

export default function PurchaseEntryPage() {
  const navigate = useNavigate();

  const [cart, setCart] = useState([]);
  const [discount, setDiscount] = useState(0);

  // Product search
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState([]);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const searchRef = useRef(null);

  // Supplier
  const [supplierSearch, setSupplierSearch] = useState('');
  const [supplierResults, setSupplierResults] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  const [showNewSupplier, setShowNewSupplier] = useState(false);
  const [newSupplier, setNewSupplier] = useState({ name: '', phone: '', email: '', address: '' });

  // Checkout
  const [paymentMethod, setPaymentMethod] = useState('BANK');
  const [paidAmount, setPaidAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const searchProducts = useCallback((q) => {
    if (searchRef.current) clearTimeout(searchRef.current);
    if (!q.trim()) { setProductResults([]); setShowProductDropdown(false); return; }
    searchRef.current = setTimeout(async () => {
      try {
        const res = await getProductsApi({ search: q, limit: 8, status: 'active' });
        setProductResults(res.data.data);
        setShowProductDropdown(true);
      } catch { /* */ }
    }, 300);
  }, []);

  useEffect(() => {
    searchProducts(productSearch);
    return () => { if (searchRef.current) clearTimeout(searchRef.current); };
  }, [productSearch, searchProducts]);

  useEffect(() => {
    if (!supplierSearch.trim()) { setSupplierResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await searchSuppliersApi(supplierSearch);
        setSupplierResults(res.data.data.suppliers);
        setShowSupplierDropdown(true);
      } catch { /* */ }
    }, 300);
    return () => clearTimeout(t);
  }, [supplierSearch]);

  function addToCart(product) {
    setCart((prev) => {
      const existing = prev.find((c) => c.product_id === product.id);
      if (existing) {
        return prev.map((c) => c.product_id === product.id ? { ...c, quantity: c.quantity + 1 } : c);
      }
      return [...prev, {
        product_id: product.id,
        name: product.name,
        sku: product.sku,
        unit_price: parseFloat(product.purchase_price),
        tax_rate: parseFloat(product.tax_rate),
        quantity: 1,
      }];
    });
    setProductSearch('');
    setShowProductDropdown(false);
  }

  function updateQty(pid, delta) {
    setCart((prev) => prev.map((c) => c.product_id === pid ? { ...c, quantity: Math.max(1, c.quantity + delta) } : c));
  }

  function updatePrice(pid, price) {
    setCart((prev) => prev.map((c) => c.product_id === pid ? { ...c, unit_price: parseFloat(price) || 0 } : c));
  }

  function removeItem(pid) { setCart((prev) => prev.filter((c) => c.product_id !== pid)); }

  const subtotal = cart.reduce((s, c) => s + c.unit_price * c.quantity, 0);
  const taxTotal = cart.reduce((s, c) => s + Math.round(c.unit_price * c.quantity * c.tax_rate) / 100, 0);
  const effectiveDiscount = Math.min(discount, subtotal + taxTotal);
  const finalAmount = Math.max(0, Math.round((subtotal + taxTotal - effectiveDiscount) * 100) / 100);

  async function handleCreateSupplier() {
    if (!newSupplier.name.trim()) return;
    try {
      const payload = {
        name: newSupplier.name.trim(),
        phone: newSupplier.phone.trim() || undefined,
        email: newSupplier.email.trim() || undefined,
        address: newSupplier.address.trim() || undefined,
      };
      const res = await createSupplierApi(payload);
      setSelectedSupplier(res.data.data.supplier);
      setShowNewSupplier(false);
      setNewSupplier({ name: '', phone: '', email: '', address: '' });
      toast.success('Supplier created');
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  }

  async function handleSubmit() {
    if (!selectedSupplier) return toast.error('Select a supplier');
    if (cart.length === 0) return toast.error('Add at least one item');
    setSubmitting(true);
    try {
      // If user left Amount Paid blank → UNPAID (don't auto-fill full amount)
      const paid = paidAmount !== '' ? (parseFloat(paidAmount) || 0) : 0;
      const res = await createPurchaseApi({
        supplier_id: selectedSupplier.id,
        items: cart.map((c) => ({ product_id: c.product_id, quantity: c.quantity, unit_price: c.unit_price })),
        discount_amount: effectiveDiscount,
        payment_method: paid > 0 ? paymentMethod : undefined,
        paid_amount: paid,
      });
      toast.success(`Purchase ${res.data.data.purchase.purchase_number} created`);
      navigate(`/purchases/${res.data.data.purchase.id}`);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="flex h-[calc(100vh-3rem)] gap-4">
      {/* LEFT */}
      <div className="flex flex-1 flex-col">
        <h1 className="mb-4 text-2xl font-bold text-gray-900">New Purchase</h1>

        <div className="relative mb-4">
          <HiOutlineSearch className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input value={productSearch} onChange={(e) => setProductSearch(e.target.value)}
            onFocus={() => productResults.length > 0 && setShowProductDropdown(true)}
            onBlur={() => setTimeout(() => setShowProductDropdown(false), 200)}
            placeholder="Search products to add..."
            className="w-full rounded-lg border border-gray-300 py-3 pl-10 pr-4 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100" />
          {showProductDropdown && productResults.length > 0 && (
            <div className="absolute z-30 mt-1 w-full rounded-lg border bg-white shadow-lg">
              {productResults.map((p) => (
                <button key={p.id} onMouseDown={() => addToCart(p)}
                  className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-primary-50">
                  <div><span className="font-medium">{p.name}</span> <span className="ml-2 text-xs text-gray-400"><span className="font-mono">#{p.id}</span> · {p.sku}</span></div>
                  <span className="font-semibold">₹{Number(p.purchase_price).toLocaleString('en-IN')}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto rounded-xl bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3 text-right">Unit Price</th>
                <th className="px-4 py-3 text-center">Qty</th>
                <th className="px-4 py-3 text-right">Tax</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {cart.map((c) => {
                const lineSub = c.unit_price * c.quantity;
                const lineTax = Math.round(lineSub * c.tax_rate) / 100;
                return (
                  <tr key={c.product_id}>
                    <td className="px-4 py-3"><div className="font-medium">{c.name}</div><div className="text-xs text-gray-400"><span className="font-mono">#{c.product_id}</span> · {c.sku}</div></td>
                    <td className="px-4 py-3 text-right">
                      <input type="number" min="0" step="0.01" value={c.unit_price} onChange={(e) => updatePrice(c.product_id, e.target.value)}
                        className="w-24 rounded border px-2 py-1 text-right text-sm" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => updateQty(c.product_id, -1)} className="rounded p-1 hover:bg-gray-100"><HiOutlineMinus className="h-3.5 w-3.5" /></button>
                        <span className="w-8 text-center font-semibold">{c.quantity}</span>
                        <button onClick={() => updateQty(c.product_id, 1)} className="rounded p-1 hover:bg-gray-100"><HiOutlinePlus className="h-3.5 w-3.5" /></button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-gray-500">{c.tax_rate}% = ₹{lineTax.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">₹{(lineSub + lineTax).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right"><button onClick={() => removeItem(c.product_id)} className="text-gray-400 hover:text-red-500"><HiOutlineTrash className="h-4 w-4" /></button></td>
                  </tr>
                );
              })}
              {cart.length === 0 && <tr><td colSpan="6" className="px-4 py-12 text-center text-gray-400">Search and add products to start a purchase</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* RIGHT */}
      <div className="w-80 flex-shrink-0 rounded-xl bg-white p-5 shadow-sm flex flex-col">
        <h3 className="mb-4 font-semibold text-gray-900">Purchase Details</h3>

        {/* Supplier */}
        <div className="mb-4">
          <label className="mb-1 block text-xs font-medium text-gray-500 uppercase">Supplier *</label>
          {selectedSupplier ? (
            <div className="flex items-center justify-between rounded-lg border px-3 py-2">
              <div><p className="text-sm font-medium">{selectedSupplier.name}</p><p className="text-xs text-gray-400">{selectedSupplier.phone}</p></div>
              <button onClick={() => { setSelectedSupplier(null); setSupplierSearch(''); }} className="text-gray-400 hover:text-red-500"><HiOutlineX className="h-4 w-4" /></button>
            </div>
          ) : (
            <div className="relative">
              <input value={supplierSearch} onChange={(e) => setSupplierSearch(e.target.value)}
                onFocus={() => supplierResults.length > 0 && setShowSupplierDropdown(true)}
                onBlur={() => setTimeout(() => setShowSupplierDropdown(false), 200)}
                placeholder="Search by name, phone, email, address..." className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary-500" />
              {showSupplierDropdown && supplierResults.length > 0 && (
                <div className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border bg-white shadow-lg">
                  {supplierResults.map((s) => (
                    <button key={s.id} onMouseDown={() => { setSelectedSupplier(s); setShowSupplierDropdown(false); setSupplierSearch(''); }}
                      className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-primary-50">
                      <div className="flex w-full items-center justify-between gap-2">
                        <span className="truncate font-medium">{s.name}</span>
                        {s.phone && <span className="flex-shrink-0 text-xs text-gray-400">{s.phone}</span>}
                      </div>
                      {(s.email || s.address) && (
                        <span className="truncate text-xs text-gray-400">
                          {[s.email, s.address].filter(Boolean).join(' • ')}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
              <button onClick={() => setShowNewSupplier(true)} className="mt-1 text-xs text-primary-600 hover:underline">+ New supplier</button>
            </div>
          )}
        </div>

        {showNewSupplier && (
          <div className="mb-4 rounded-lg border border-primary-200 bg-primary-50 p-3 space-y-2">
            <input value={newSupplier.name} onChange={(e) => setNewSupplier((p) => ({ ...p, name: e.target.value }))} placeholder="Supplier name *" className="w-full rounded border px-2 py-1.5 text-sm" />
            <input value={newSupplier.phone} onChange={(e) => setNewSupplier((p) => ({ ...p, phone: e.target.value }))} placeholder="Phone" className="w-full rounded border px-2 py-1.5 text-sm" />
            <input type="email" value={newSupplier.email} onChange={(e) => setNewSupplier((p) => ({ ...p, email: e.target.value }))} placeholder="Email" className="w-full rounded border px-2 py-1.5 text-sm" />
            <textarea value={newSupplier.address} onChange={(e) => setNewSupplier((p) => ({ ...p, address: e.target.value }))} placeholder="Address" rows={2} className="w-full rounded border px-2 py-1.5 text-sm resize-none" />
            <div className="flex gap-2">
              <button onClick={handleCreateSupplier} className="rounded bg-primary-600 px-3 py-1 text-xs text-white hover:bg-primary-700">Save</button>
              <button onClick={() => { setShowNewSupplier(false); setNewSupplier({ name: '', phone: '', email: '', address: '' }); }} className="text-xs text-gray-500">Cancel</button>
            </div>
          </div>
        )}

        <div className="mb-4">
          <label className="mb-1 block text-xs font-medium text-gray-500 uppercase">Payment Method</label>
          <div className="grid grid-cols-3 gap-2">
            {['CASH', 'UPI', 'BANK'].map((m) => (
              <button key={m} onClick={() => setPaymentMethod(m)}
                className={`rounded-lg border py-2 text-xs font-medium transition-colors ${paymentMethod === m ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-500'}`}>{m}</button>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-xs font-medium text-gray-500 uppercase">Discount (₹)</label>
          <input type="number" min="0" value={discount || ''} onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
            className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary-500" />
        </div>

        <div className="mb-4">
          <label className="mb-1 block text-xs font-medium text-gray-500 uppercase">Amount Paid (₹)</label>
          <input type="number" min="0" step="0.01" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)}
            placeholder={finalAmount.toFixed(2)} className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary-500" />
        </div>

        <div className="flex-1" />

        <div className="border-t pt-4 space-y-1.5 text-sm">
          <div className="flex justify-between text-gray-500"><span>Subtotal</span><span className="tabular-nums">₹{subtotal.toFixed(2)}</span></div>
          <div className="flex justify-between text-gray-500"><span>Tax (GST)</span><span className="tabular-nums">₹{taxTotal.toFixed(2)}</span></div>
          {effectiveDiscount > 0 && <div className="flex justify-between text-green-600"><span>Discount</span><span>-₹{effectiveDiscount.toFixed(2)}</span></div>}
          <div className="flex justify-between border-t pt-2 text-lg font-bold text-gray-900"><span>Total</span><span className="tabular-nums">₹{finalAmount.toFixed(2)}</span></div>
        </div>

        <button onClick={handleSubmit} disabled={submitting || cart.length === 0 || !selectedSupplier}
          className="mt-4 w-full rounded-lg bg-primary-600 py-3 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50">
          {submitting ? 'Processing...' : `Record Purchase — ₹${finalAmount.toFixed(2)}`}
        </button>
      </div>
    </div>
  );
}
