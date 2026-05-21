import { useState, useEffect, useRef, useCallback } from 'react';
import { getProductsApi } from '../../api/inventory.api';
import { searchCustomersApi, createCustomerApi, createSaleApi } from '../../api/sales.api';
import { scanBarcodeApi } from '../../api/quotations.api';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { HiOutlineSearch, HiOutlinePlus, HiOutlineMinus, HiOutlineTrash, HiOutlineX, HiOutlineCash, HiOutlineDeviceMobile, HiOutlineCreditCard } from 'react-icons/hi';

const PAYMENT_METHODS = [
  { key: 'CASH', label: 'Cash', icon: HiOutlineCash },
  { key: 'UPI', label: 'UPI', icon: HiOutlineDeviceMobile },
  { key: 'CARD', label: 'Card', icon: HiOutlineCreditCard },
];

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
  const [discountType, setDiscountType] = useState('FLAT'); // 'FLAT' (₹) or 'PCT' (%)

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
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', email: '', address: '', delivery_address: '' });
  // Per-sale address overrides (do not change the customer record)
  const [billingOverride, setBillingOverride] = useState('');
  const [deliveryOverride, setDeliveryOverride] = useState('');
  const [editingAddresses, setEditingAddresses] = useState(false);

  // Reset overrides when the selected customer changes
  useEffect(() => {
    setBillingOverride(selectedCustomer?.address || '');
    setDeliveryOverride(selectedCustomer?.delivery_address || '');
    setEditingAddresses(false);
  }, [selectedCustomer]);

  // Checkout — per-method amounts (any combination of cash/UPI/card)
  const [payments, setPayments] = useState({ CASH: '', UPI: '', CARD: '' });
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
        original_price: parseFloat(product.selling_price),
        tax_rate: parseFloat(product.tax_rate),
        quantity: 1,
        stock: product.total_stock,
        discount: 0, // per-line flat discount in ₹
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

  function updateUnitPrice(productId, value) {
    setCart((prev) => prev.map((c) =>
      c.product_id === productId ? { ...c, unit_price: parseFloat(value) || 0 } : c
    ));
  }

  function updateLineDiscount(productId, value) {
    setCart((prev) => prev.map((c) =>
      c.product_id === productId ? { ...c, discount: parseFloat(value) || 0 } : c
    ));
  }

  function removeFromCart(productId) {
    setCart((prev) => prev.filter((c) => c.product_id !== productId));
  }

  // Per-line helpers — line discount is capped at the line's gross subtotal
  function lineGross(c) { return c.unit_price * c.quantity; }
  function lineDisc(c)  { return Math.min(c.discount || 0, lineGross(c)); }
  function lineNet(c)   { return lineGross(c) - lineDisc(c); }
  function lineTax(c)   { return Math.round(lineNet(c) * c.tax_rate) / 100; }

  // Totals — GST calculated per line item then summed (matches backend exactly)
  const grossSubtotal     = cart.reduce((s, c) => s + lineGross(c), 0);
  const itemDiscountTotal = cart.reduce((s, c) => s + lineDisc(c),  0);
  const subtotal          = grossSubtotal - itemDiscountTotal; // discounted subtotal
  const taxTotal          = cart.reduce((s, c) => s + lineTax(c),   0);
  // Cart-level discount: FLAT (₹) or PCT (% of subtotal + tax)
  const rawDiscount = discountType === 'PCT'
    ? (subtotal + taxTotal) * (Math.min(discount, 100) / 100)
    : discount;
  const effectiveDiscount = Math.round(Math.min(rawDiscount, subtotal + taxTotal) * 100) / 100;
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
        delivery_address: newCustomer.delivery_address.trim() || undefined,
      };
      const res = await createCustomerApi(payload);
      setSelectedCustomer(res.data.data.customer);
      setShowNewCustomer(false);
      setNewCustomer({ name: '', phone: '', email: '', address: '', delivery_address: '' });
      toast.success('Customer created');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  }

  // Sum of all per-method amounts entered
  const paymentSplits = PAYMENT_METHODS
    .map((m) => ({ method: m.key, amount: parseFloat(payments[m.key]) || 0 }))
    .filter((p) => p.amount > 0);
  const totalReceived = paymentSplits.reduce((s, p) => s + p.amount, 0);
  const balance = Math.max(0, finalAmount - totalReceived);
  const change = Math.max(0, totalReceived - finalAmount);

  // Submit sale
  async function handleCheckout() {
    if (cart.length === 0) return toast.error('Cart is empty');
    setSubmitting(true);

    try {
      // Cap effective paid at finalAmount so overpayment becomes "change", not "credit"
      const effectivePaid = Math.min(totalReceived, finalAmount);
      // If exactly one method was used, send it as payment_method; otherwise MIXED
      const methodLabel = paymentSplits.length === 1 ? paymentSplits[0].method : (paymentSplits.length > 1 ? 'MIXED' : undefined);

      const payload = {
        items: cart.map((c) => {
          // Fold the per-line discount into the effective unit price.
          // (Backend has no per-item discount column, so we lower the price instead — tax is calculated on this net amount.)
          const netPerUnit = c.quantity > 0
            ? Math.round((lineNet(c) / c.quantity) * 100) / 100
            : c.unit_price;
          return { product_id: c.product_id, quantity: c.quantity, unit_price: netPerUnit };
        }),
        customer_id: selectedCustomer?.id || null,
        discount_amount: effectiveDiscount,
        payment_method: methodLabel,
        paid_amount: effectivePaid,
        // Per-sale address snapshot — backend stores these on the sale row, doesn't touch the customer
        billing_address: selectedCustomer ? (billingOverride.trim() || null) : undefined,
        delivery_address: selectedCustomer ? (deliveryOverride.trim() || null) : undefined,
      };
      if (paymentSplits.length > 0) {
        // Cap each split proportionally if user overpaid, so payment rows still match invoice total
        const scale = totalReceived > finalAmount && totalReceived > 0 ? finalAmount / totalReceived : 1;
        payload.payments = paymentSplits.map((p) => ({
          amount: Math.round(p.amount * scale * 100) / 100,
          method: p.method,
        }));
      }

      const res = await createSaleApi(payload);
      toast.success(`Invoice ${res.data.data.sale.invoice_number} created`);
      navigate(`/sales/${res.data.data.sale.id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Sale failed');
    } finally {
      setSubmitting(false);
    }
  }

  function setPaymentAmount(method, value) {
    setPayments((p) => ({ ...p, [method]: value }));
  }

  // Fill the named method with the remaining balance (after existing entries)
  function fillRemaining(method) {
    const otherTotal = PAYMENT_METHODS
      .filter((m) => m.key !== method)
      .reduce((s, m) => s + (parseFloat(payments[m.key]) || 0), 0);
    const remaining = Math.max(0, finalAmount - otherTotal);
    setPaymentAmount(method, remaining ? remaining.toFixed(2) : '');
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
                    <span className="ml-2 text-xs text-gray-400"><span className="font-mono">#{p.id}</span> · {p.sku}</span>
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
                <th className="px-4 py-3 text-right">Disc</th>
                <th className="px-4 py-3 text-center">Qty</th>
                <th className="px-4 py-3 text-right">Tax</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {cart.map((c) => {
                const tax  = lineTax(c);
                const total = lineNet(c) + tax;
                const priceChanged = c.unit_price !== c.original_price;
                return (
                  <tr key={c.product_id}>
                    <td className="px-4 py-3">
                      <div className="font-medium">{c.name}</div>
                      <div className="text-xs text-gray-400"><span className="font-mono">#{c.product_id}</span> · {c.sku}</div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={c.unit_price}
                        onChange={(e) => updateUnitPrice(c.product_id, e.target.value)}
                        className="w-24 rounded border border-gray-200 px-2 py-1 text-right text-sm outline-none focus:border-primary-500"
                      />
                      {priceChanged && (
                        <div className="mt-0.5 text-[10px] text-gray-400">was ₹{c.original_price.toLocaleString('en-IN')}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={c.discount || ''}
                        onChange={(e) => updateLineDiscount(c.product_id, e.target.value)}
                        placeholder="0"
                        className="w-20 rounded border border-gray-200 px-2 py-1 text-right text-sm outline-none focus:border-primary-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => updateQuantity(c.product_id, -1)} className="rounded p-1 hover:bg-gray-100"><HiOutlineMinus className="h-3.5 w-3.5" /></button>
                        <span className="w-8 text-center font-semibold">{c.quantity}</span>
                        <button onClick={() => updateQuantity(c.product_id, 1)} className="rounded p-1 hover:bg-gray-100"><HiOutlinePlus className="h-3.5 w-3.5" /></button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-gray-500">{c.tax_rate}% = ₹{tax.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums">₹{total.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => removeFromCart(c.product_id)} className="text-gray-400 hover:text-red-500"><HiOutlineTrash className="h-4 w-4" /></button>
                    </td>
                  </tr>
                );
              })}
              {cart.length === 0 && (
                <tr><td colSpan="7" className="px-4 py-12 text-center text-gray-400">Search and add products to start a sale</td></tr>
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
            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2">
                <div>
                  <p className="text-sm font-medium">{selectedCustomer.name}</p>
                  <p className="text-xs text-gray-400">{selectedCustomer.phone}</p>
                </div>
                <button onClick={() => { setSelectedCustomer(null); setCustomerSearch(''); }} className="text-gray-400 hover:text-red-500"><HiOutlineX className="h-4 w-4" /></button>
              </div>
              {!editingAddresses ? (
                <button
                  type="button"
                  onClick={() => setEditingAddresses(true)}
                  className="text-[11px] text-primary-600 hover:underline"
                >
                  Edit billing / delivery address for this sale
                </button>
              ) : (
                <div className="rounded-lg border border-gray-200 p-2 space-y-2">
                  <div>
                    <label className="mb-0.5 block text-[10px] font-medium uppercase text-gray-500">Billing address</label>
                    <textarea
                      value={billingOverride}
                      onChange={(e) => setBillingOverride(e.target.value)}
                      rows={2}
                      className="w-full rounded border border-gray-200 px-2 py-1 text-xs outline-none focus:border-primary-500 resize-none"
                    />
                  </div>
                  <div>
                    <label className="mb-0.5 block text-[10px] font-medium uppercase text-gray-500">Delivery address</label>
                    <textarea
                      value={deliveryOverride}
                      onChange={(e) => setDeliveryOverride(e.target.value)}
                      placeholder="Leave blank if same as billing"
                      rows={2}
                      className="w-full rounded border border-gray-200 px-2 py-1 text-xs outline-none focus:border-primary-500 resize-none"
                    />
                  </div>
                  <p className="text-[10px] text-gray-400">Changes apply only to this sale. Customer profile is not modified.</p>
                </div>
              )}
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
            <textarea value={newCustomer.address} onChange={(e) => setNewCustomer((p) => ({ ...p, address: e.target.value }))} placeholder="Billing address" rows={2} className="w-full rounded border px-2 py-1.5 text-sm resize-none" />
            <div className="flex items-center justify-between">
              <label className="text-[11px] text-gray-600">Delivery address</label>
              <label className="flex items-center gap-1 text-[10px] text-gray-500">
                <input
                  type="checkbox"
                  checked={!newCustomer.delivery_address}
                  onChange={(e) => setNewCustomer((p) => ({ ...p, delivery_address: e.target.checked ? '' : (p.address || ' ') }))}
                  className="h-3 w-3"
                />
                Same as billing
              </label>
            </div>
            <textarea
              value={newCustomer.delivery_address}
              onChange={(e) => setNewCustomer((p) => ({ ...p, delivery_address: e.target.value }))}
              placeholder={newCustomer.delivery_address ? '' : 'Uses billing address by default'}
              rows={2}
              disabled={!newCustomer.delivery_address}
              className="w-full rounded border px-2 py-1.5 text-sm resize-none disabled:bg-gray-100 disabled:text-gray-400"
            />
            <div className="flex gap-2">
              <button onClick={handleCreateCustomer} className="rounded bg-primary-600 px-3 py-1 text-xs text-white hover:bg-primary-700">Save</button>
              <button onClick={() => { setShowNewCustomer(false); setNewCustomer({ name: '', phone: '', email: '', address: '', delivery_address: '' }); }} className="text-xs text-gray-500">Cancel</button>
            </div>
          </div>
        )}

        {/* Discount */}
        <div className="mb-4">
          <label className="mb-1 block text-xs font-medium text-gray-500 uppercase">Discount</label>
          <div className="flex items-stretch overflow-hidden rounded-lg border border-gray-300 focus-within:border-primary-500">
            <input
              type="number"
              min="0"
              step={discountType === 'PCT' ? '0.1' : '1'}
              max={discountType === 'PCT' ? '100' : undefined}
              value={discount || ''}
              onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
              placeholder="0"
              className="flex-1 px-3 py-2 text-sm outline-none"
            />
            <button
              type="button"
              onClick={() => setDiscountType('FLAT')}
              className={`px-3 text-sm font-semibold border-l border-gray-300 ${discountType === 'FLAT' ? 'bg-primary-50 text-primary-700' : 'text-gray-400 hover:bg-gray-50'}`}
            >
              ₹
            </button>
            <button
              type="button"
              onClick={() => setDiscountType('PCT')}
              className={`px-3 text-sm font-semibold border-l border-gray-300 ${discountType === 'PCT' ? 'bg-primary-50 text-primary-700' : 'text-gray-400 hover:bg-gray-50'}`}
            >
              %
            </button>
          </div>
          {discountType === 'PCT' && discount > 0 && (
            <p className="mt-1 text-[10px] text-gray-500">
              = ₹{effectiveDiscount.toFixed(2)} off ₹{(subtotal + taxTotal).toFixed(2)}
            </p>
          )}
        </div>

        {/* Payment methods — split across cash / UPI / card */}
        <div className="mb-4">
          <label className="mb-1 block text-xs font-medium text-gray-500 uppercase">Payment</label>
          <div className="space-y-2">
            {PAYMENT_METHODS.map((m) => (
              <div key={m.key} className="flex items-center gap-2">
                <div className="flex w-16 items-center gap-1.5 text-xs font-medium text-gray-600">
                  <m.icon className="h-4 w-4 text-gray-400" /> {m.label}
                </div>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={payments[m.key]}
                  onChange={(e) => setPaymentAmount(m.key, e.target.value)}
                  placeholder="0.00"
                  className="flex-1 rounded-lg border border-gray-300 px-2.5 py-1.5 text-sm outline-none focus:border-primary-500"
                />
                <button
                  type="button"
                  onClick={() => fillRemaining(m.key)}
                  className="text-[10px] font-medium text-primary-600 hover:underline"
                  title="Fill with remaining balance"
                >
                  fill
                </button>
              </div>
            ))}
          </div>
          {paymentSplits.length > 1 && (
            <p className="mt-1.5 text-[10px] text-gray-400">Split payment — {paymentSplits.length} methods</p>
          )}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Totals */}
        <div className="border-t border-gray-200 pt-4 space-y-1.5 text-sm">
          <div className="flex justify-between text-gray-500">
            <span>Subtotal</span>
            <span className="tabular-nums">₹{grossSubtotal.toFixed(2)}</span>
          </div>
          {itemDiscountTotal > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Item Discounts</span>
              <span className="tabular-nums">-₹{itemDiscountTotal.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-gray-500">
            <span>Tax (GST)</span>
            <span className="tabular-nums">₹{taxTotal.toFixed(2)}</span>
          </div>
          {effectiveDiscount > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Discount{discountType === 'PCT' ? ` (${Math.min(discount, 100)}%)` : ''}{effectiveDiscount < rawDiscount ? ' (capped)' : ''}</span>
              <span className="tabular-nums">-₹{effectiveDiscount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-gray-200 pt-2 text-lg font-bold text-gray-900">
            <span>Total</span>
            <span className="tabular-nums">₹{finalAmount.toFixed(2)}</span>
          </div>
          {totalReceived > 0 && (
            <div className="flex justify-between text-sm text-gray-500 pt-1">
              <span>Received</span>
              <span className="tabular-nums">₹{totalReceived.toFixed(2)}</span>
            </div>
          )}
          {balance > 0 && (
            <div className="flex justify-between text-sm font-semibold text-red-600">
              <span>Balance Due</span>
              <span className="tabular-nums">₹{balance.toFixed(2)}</span>
            </div>
          )}
          {change > 0 && (
            <div className="flex justify-between text-sm font-semibold text-green-600">
              <span>Change</span>
              <span className="tabular-nums">₹{change.toFixed(2)}</span>
            </div>
          )}
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
