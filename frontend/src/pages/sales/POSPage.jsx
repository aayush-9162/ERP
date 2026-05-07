import { useState, useEffect, useRef, useCallback } from 'react';
import { getProductsApi } from '../../api/inventory.api';
import { searchCustomersApi, createCustomerApi, createSaleApi } from '../../api/sales.api';
import { scanBarcodeApi } from '../../api/quotations.api';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { HiOutlineSearch, HiOutlinePlus, HiOutlineMinus, HiOutlineTrash, HiOutlineX } from 'react-icons/hi';

export default function POSPage() {
  const navigate = useNavigate();
  const barcodeBuffer = useRef('');
  const barcodeTimer = useRef(null);

  // USB barcode scanner detection:
  // Scanners fire rapid keystrokes (< 50ms apart) ending with Enter.
  // Buffer collects chars; if Enter arrives while buffer has 8+ chars → barcode scan.
  // Buffer auto-clears after 200ms of inactivity (human typing is slower).
  useEffect(() => {
    function handleKeydown(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;

      if (e.key === 'Enter' && barcodeBuffer.current.length >= 8) {
        e.preventDefault();
        const barcode = barcodeBuffer.current.trim();
        barcodeBuffer.current = '';
        if (/^[0-9A-Za-z\-]+$/.test(barcode)) {
          scanBarcodeApi(barcode)
            .then((res) => { addToCart(res.data.data.product); toast.success(`Scanned: ${res.data.data.product.name}`); })
            .catch(() => toast.error(`No product for barcode: ${barcode}`));
        }
        return;
      }

      if (e.key.length === 1 && /[0-9A-Za-z\-]/.test(e.key)) {
        barcodeBuffer.current += e.key;
        clearTimeout(barcodeTimer.current);
        barcodeTimer.current = setTimeout(() => { barcodeBuffer.current = ''; }, 200);
      }
    }
    window.addEventListener('keydown', handleKeydown);
    return () => { window.removeEventListener('keydown', handleKeydown); clearTimeout(barcodeTimer.current); };
  }, []);

  // Cart state
  const [cart, setCart] = useState([]);
  const [discount, setDiscount] = useState(0);

  // Product search
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState([]);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const searchTimeout = useRef(null);

  // Customer
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', email: '', address: '' });

  // Checkout
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [paidAmount, setPaidAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Debounced product search
  const searchProducts = useCallback((q) => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!q.trim()) { setProductResults([]); setShowProductDropdown(false); return; }
    searchTimeout.current = setTimeout(async () => {
      try {
        const res = await getProductsApi({ search: q, limit: 8, status: 'active' });
        setProductResults(res.data.data);
        setShowProductDropdown(true);
      } catch { /* ignore */ }
    }, 300);
  }, []);

  useEffect(() => { searchProducts(productSearch); }, [productSearch, searchProducts]);

  // Customer search
  useEffect(() => {
    if (!customerSearch.trim()) { setCustomerResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await searchCustomersApi(customerSearch);
        setCustomerResults(res.data.data.customers);
        setShowCustomerDropdown(true);
      } catch { /* ignore */ }
    }, 300);
    return () => clearTimeout(t);
  }, [customerSearch]);

  // Add product to cart
  function addToCart(product) {
    setCart((prev) => {
      const existing = prev.find((c) => c.product_id === product.id);
      if (existing) {
        return prev.map((c) =>
          c.product_id === product.id ? { ...c, quantity: c.quantity + 1 } : c
        );
      }
      return [...prev, {
        product_id: product.id,
        name: product.name,
        sku: product.sku,
        unit_price: parseFloat(product.selling_price),
        tax_rate: parseFloat(product.tax_rate),
        quantity: 1,
        stock: product.total_stock,
      }];
    });
    setProductSearch('');
    setShowProductDropdown(false);
  }

  function updateQuantity(productId, delta) {
    setCart((prev) => prev.map((c) => {
      if (c.product_id !== productId) return c;
      const newQty = Math.max(1, Math.min(c.quantity + delta, c.stock));
      return { ...c, quantity: newQty };
    }));
  }

  function removeFromCart(productId) {
    setCart((prev) => prev.filter((c) => c.product_id !== productId));
  }

  // Totals — GST calculated per line item then summed (matches backend exactly)
  const subtotal = cart.reduce((s, c) => s + c.unit_price * c.quantity, 0);
  const taxTotal = cart.reduce((s, c) => s + Math.round(c.unit_price * c.quantity * c.tax_rate) / 100, 0);
  // Cap discount so final never goes negative
  const effectiveDiscount = Math.min(discount, subtotal + taxTotal);
  const finalAmount = Math.max(0, Math.round((subtotal + taxTotal - effectiveDiscount) * 100) / 100);

  // Quick-create customer
  async function handleCreateCustomer() {
    if (!newCustomer.name.trim()) return;
    try {
      const payload = {
        name: newCustomer.name.trim(),
        phone: newCustomer.phone.trim() || undefined,
        email: newCustomer.email.trim() || undefined,
        address: newCustomer.address.trim() || undefined,
      };
      const res = await createCustomerApi(payload);
      setSelectedCustomer(res.data.data.customer);
      setShowNewCustomer(false);
      setNewCustomer({ name: '', phone: '', email: '', address: '' });
      toast.success('Customer created');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  }

  // Submit sale
  async function handleCheckout() {
    if (cart.length === 0) return toast.error('Cart is empty');
    setSubmitting(true);

    try {
      const paid = parseFloat(paidAmount) || 0;
      const res = await createSaleApi({
        items: cart.map((c) => ({ product_id: c.product_id, quantity: c.quantity, unit_price: c.unit_price })),
        customer_id: selectedCustomer?.id || null,
        discount_amount: effectiveDiscount,
        payment_method: paymentMethod,
        paid_amount: paid > 0 ? paid : finalAmount,
      });

      toast.success(`Invoice ${res.data.data.sale.invoice_number} created`);
      navigate(`/sales/${res.data.data.sale.id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Sale failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-3rem)] gap-4">
      {/* LEFT: Product search + cart */}
      <div className="flex flex-1 flex-col">
        <h1 className="mb-4 text-2xl font-bold text-gray-900">Point of Sale</h1>

        {/* Product search */}
        <div className="relative mb-4">
          <HiOutlineSearch className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={productSearch}
            onChange={(e) => setProductSearch(e.target.value)}
            onFocus={() => productResults.length > 0 && setShowProductDropdown(true)}
            onBlur={() => setTimeout(() => setShowProductDropdown(false), 200)}
            placeholder="Search products by name, SKU, or barcode..."
            className="w-full rounded-lg border border-gray-300 py-3 pl-10 pr-4 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
          />
          {showProductDropdown && productResults.length > 0 && (
            <div className="absolute z-30 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg">
              {productResults.map((p) => (
                <button
                  key={p.id}
                  onMouseDown={() => addToCart(p)}
                  className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-primary-50"
                >
                  <div>
                    <span className="font-medium">{p.name}</span>
                    <span className="ml-2 text-xs text-gray-400">{p.sku}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-semibold">₹{Number(p.selling_price).toLocaleString('en-IN')}</span>
                    <span className="ml-2 text-xs text-gray-400">Stock: {p.total_stock}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Cart table */}
        <div className="flex-1 overflow-y-auto rounded-xl bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3 text-right">Price</th>
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
                    <td className="px-4 py-3">
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-gray-400">{c.sku}</div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">₹{c.unit_price.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => updateQuantity(c.product_id, -1)} className="rounded p-1 hover:bg-gray-100"><HiOutlineMinus className="h-3.5 w-3.5" /></button>
                        <span className="w-8 text-center font-semibold">{c.quantity}</span>
                        <button onClick={() => updateQuantity(c.product_id, 1)} className="rounded p-1 hover:bg-gray-100"><HiOutlinePlus className="h-3.5 w-3.5" /></button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-gray-500">{c.tax_rate}% = ₹{lineTax.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">₹{(lineSub + lineTax).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => removeFromCart(c.product_id)} className="text-gray-400 hover:text-red-500"><HiOutlineTrash className="h-4 w-4" /></button>
                    </td>
                  </tr>
                );
              })}
              {cart.length === 0 && (
                <tr><td colSpan="6" className="px-4 py-12 text-center text-gray-400">Search and add products to start a sale</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* RIGHT: Checkout panel */}
      <div className="w-80 flex-shrink-0 rounded-xl bg-white p-5 shadow-sm flex flex-col">
        <h3 className="mb-4 font-semibold text-gray-900">Checkout</h3>

        {/* Customer */}
        <div className="mb-4">
          <label className="mb-1 block text-xs font-medium text-gray-500 uppercase">Customer</label>
          {selectedCustomer ? (
            <div className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2">
              <div>
                <p className="text-sm font-medium">{selectedCustomer.name}</p>
                <p className="text-xs text-gray-400">{selectedCustomer.phone}</p>
              </div>
              <button onClick={() => { setSelectedCustomer(null); setCustomerSearch(''); }} className="text-gray-400 hover:text-red-500"><HiOutlineX className="h-4 w-4" /></button>
            </div>
          ) : (
            <div className="relative">
              <input
                type="text"
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                onFocus={() => customerResults.length > 0 && setShowCustomerDropdown(true)}
                onBlur={() => setTimeout(() => setShowCustomerDropdown(false), 200)}
                placeholder="Search by name, phone, email, address..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500"
              />
              {showCustomerDropdown && customerResults.length > 0 && (
                <div className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border bg-white shadow-lg">
                  {customerResults.map((c) => (
                    <button key={c.id} onMouseDown={() => { setSelectedCustomer(c); setShowCustomerDropdown(false); setCustomerSearch(''); }}
                      className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-primary-50">
                      <div className="flex w-full items-center justify-between gap-2">
                        <span className="truncate font-medium">{c.name}</span>
                        {c.phone && <span className="flex-shrink-0 text-xs text-gray-400">{c.phone}</span>}
                      </div>
                      {(c.email || c.address) && (
                        <span className="truncate text-xs text-gray-400">
                          {[c.email, c.address].filter(Boolean).join(' • ')}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
              <button onClick={() => setShowNewCustomer(true)} className="mt-1 text-xs text-primary-600 hover:underline">+ New customer</button>
            </div>
          )}
        </div>

        {/* New customer mini-form */}
        {showNewCustomer && (
          <div className="mb-4 rounded-lg border border-primary-200 bg-primary-50 p-3 space-y-2">
            <input value={newCustomer.name} onChange={(e) => setNewCustomer((p) => ({ ...p, name: e.target.value }))} placeholder="Customer name *" className="w-full rounded border px-2 py-1.5 text-sm" />
            <input value={newCustomer.phone} onChange={(e) => setNewCustomer((p) => ({ ...p, phone: e.target.value }))} placeholder="Phone" className="w-full rounded border px-2 py-1.5 text-sm" />
            <input type="email" value={newCustomer.email} onChange={(e) => setNewCustomer((p) => ({ ...p, email: e.target.value }))} placeholder="Email" className="w-full rounded border px-2 py-1.5 text-sm" />
            <textarea value={newCustomer.address} onChange={(e) => setNewCustomer((p) => ({ ...p, address: e.target.value }))} placeholder="Address" rows={2} className="w-full rounded border px-2 py-1.5 text-sm resize-none" />
            <div className="flex gap-2">
              <button onClick={handleCreateCustomer} className="rounded bg-primary-600 px-3 py-1 text-xs text-white hover:bg-primary-700">Save</button>
              <button onClick={() => { setShowNewCustomer(false); setNewCustomer({ name: '', phone: '', email: '', address: '' }); }} className="text-xs text-gray-500">Cancel</button>
            </div>
          </div>
        )}

        {/* Payment method */}
        <div className="mb-4">
          <label className="mb-1 block text-xs font-medium text-gray-500 uppercase">Payment Method</label>
          <div className="grid grid-cols-3 gap-2">
            {['CASH', 'UPI', 'CARD'].map((m) => (
              <button key={m} onClick={() => setPaymentMethod(m)}
                className={`rounded-lg border py-2 text-xs font-medium transition-colors ${paymentMethod === m ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Discount */}
        <div className="mb-4">
          <label className="mb-1 block text-xs font-medium text-gray-500 uppercase">Discount (₹)</label>
          <input type="number" min="0" step="1" value={discount || ''} onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500" />
        </div>

        {/* Paid amount */}
        <div className="mb-4">
          <label className="mb-1 block text-xs font-medium text-gray-500 uppercase">Amount Received (₹)</label>
          <input type="number" min="0" step="0.01" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)}
            placeholder={finalAmount.toFixed(2)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500" />
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Totals */}
        <div className="border-t border-gray-200 pt-4 space-y-1.5 text-sm">
          <div className="flex justify-between text-gray-500">
            <span>Subtotal</span>
            <span className="tabular-nums">₹{subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-gray-500">
            <span>Tax (GST)</span>
            <span className="tabular-nums">₹{taxTotal.toFixed(2)}</span>
          </div>
          {effectiveDiscount > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Discount{effectiveDiscount < discount ? ' (capped)' : ''}</span>
              <span className="tabular-nums">-₹{effectiveDiscount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-gray-200 pt-2 text-lg font-bold text-gray-900">
            <span>Total</span>
            <span className="tabular-nums">₹{finalAmount.toFixed(2)}</span>
          </div>
        </div>

        <button
          onClick={handleCheckout}
          disabled={submitting || cart.length === 0}
          className="mt-4 w-full rounded-lg bg-primary-600 py-3 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
        >
          {submitting ? 'Processing...' : `Confirm Sale — ₹${finalAmount.toFixed(2)}`}
        </button>
      </div>
    </div>
  );
}
