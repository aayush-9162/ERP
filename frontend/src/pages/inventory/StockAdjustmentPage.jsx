import { useState, useEffect, useCallback } from 'react';
import { getProductsApi, createStockMovementApi, getStockMovementsApi } from '../../api/inventory.api';
import toast from 'react-hot-toast';
import { HiOutlinePlus, HiOutlineMinus, HiOutlineAdjustments } from 'react-icons/hi';

export default function StockAdjustmentPage() {
  const [products, setProducts] = useState([]);
  const [movements, setMovements] = useState([]);
  const [movementPagination, setMovementPagination] = useState({ page: 1, totalPages: 1 });

  // Form state
  const [productId, setProductId] = useState('');
  const [type, setType] = useState('IN');
  const [quantity, setQuantity] = useState('');
  const [reference, setReference] = useState('manual');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchProducts = useCallback(async () => {
    try {
      const r = await getProductsApi({ limit: 200, status: 'active' });
      setProducts(r.data.data);
    } catch { /* non-critical */ }
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const fetchMovements = useCallback(async (page = 1) => {
    try {
      const res = await getStockMovementsApi({ page, limit: 15 });
      setMovements(res.data.data);
      setMovementPagination(res.data.pagination);
    } catch { /* non-critical */ }
  }, []);

  useEffect(() => { fetchMovements(); }, [fetchMovements]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!productId || !quantity) return;

    setSubmitting(true);
    try {
      await createStockMovementApi({
        product_id: parseInt(productId, 10),
        type,
        quantity: parseInt(quantity, 10),
        reference,
        notes: notes || undefined,
      });
      toast.success(`Stock ${type === 'IN' ? 'added' : type === 'OUT' ? 'removed' : 'adjusted'} successfully`);
      setQuantity('');
      setNotes('');
      fetchMovements();
      fetchProducts(); // Refresh stock numbers in product dropdown
    } catch (err) {
      toast.error(err.response?.data?.message || 'Stock adjustment failed');
    } finally {
      setSubmitting(false);
    }
  }

  const typeOptions = [
    { value: 'IN', label: 'Stock In', icon: HiOutlinePlus, color: 'bg-green-100 text-green-700 border-green-300' },
    { value: 'OUT', label: 'Stock Out', icon: HiOutlineMinus, color: 'bg-red-100 text-red-700 border-red-300' },
    { value: 'ADJUSTMENT', label: 'Adjustment', icon: HiOutlineAdjustments, color: 'bg-amber-100 text-amber-700 border-amber-300' },
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Stock Adjustment</h1>
        <p className="text-sm text-gray-500">Add or remove stock via the movement ledger</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Form */}
        <div className="lg:col-span-1">
          <form onSubmit={handleSubmit} className="rounded-xl bg-white p-6 shadow-sm">
            <h3 className="mb-4 font-semibold text-gray-900">New Movement</h3>

            {/* Type selector */}
            <div className="mb-4">
              <label className="mb-2 block text-sm font-medium text-gray-700">Movement Type</label>
              <div className="grid grid-cols-3 gap-2">
                {typeOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setType(opt.value)}
                    className={`flex items-center justify-center gap-1 rounded-lg border px-2 py-2 text-xs font-medium transition-colors ${
                      type === opt.value ? opt.color : 'border-gray-200 text-gray-500 hover:border-gray-300'
                    }`}
                  >
                    <opt.icon className="h-3.5 w-3.5" />
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium text-gray-700">Product *</label>
              <select value={productId} onChange={(e) => setProductId(e.target.value)} required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500">
                <option value="">Select product</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} ({p.sku}) — Stock: {p.total_stock}</option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium text-gray-700">Quantity *</label>
              <input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} required
                placeholder="Enter quantity"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500" />
            </div>

            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium text-gray-700">Reference</label>
              <select value={reference} onChange={(e) => setReference(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500">
                <option value="manual">Manual</option>
                <option value="purchase">Purchase</option>
                <option value="sale">Sale</option>
                <option value="return">Return</option>
              </select>
            </div>

            <div className="mb-5">
              <label className="mb-1 block text-sm font-medium text-gray-700">Notes</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
                placeholder="Optional notes..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500" />
            </div>

            <button type="submit" disabled={submitting}
              className="w-full rounded-lg bg-primary-600 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 disabled:opacity-50 transition-colors">
              {submitting ? 'Processing...' : 'Record Movement'}
            </button>
          </form>
        </div>

        {/* Recent movements */}
        <div className="lg:col-span-2">
          <div className="rounded-xl bg-white shadow-sm">
            <div className="border-b border-gray-100 px-5 py-4">
              <h3 className="font-semibold text-gray-900">Recent Stock Movements</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
                  <tr>
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3">Product</th>
                    <th className="px-5 py-3">Type</th>
                    <th className="px-5 py-3 text-right">Qty</th>
                    <th className="px-5 py-3">Reference</th>
                    <th className="px-5 py-3">By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {movements.map((m) => (
                    <tr key={m.id} className="hover:bg-gray-50">
                      <td className="px-5 py-3 text-xs text-gray-500">
                        {new Date(m.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                      <td className="px-5 py-3">
                        <span className="font-medium">{m.product?.name}</span>
                        <span className="ml-1 text-xs text-gray-400">{m.product?.sku}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          m.type === 'IN' ? 'bg-green-50 text-green-700' :
                          m.type === 'OUT' ? 'bg-red-50 text-red-700' :
                          'bg-amber-50 text-amber-700'
                        }`}>{m.type}</span>
                      </td>
                      <td className={`px-5 py-3 text-right font-semibold ${
                        m.quantity > 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {m.quantity > 0 ? '+' : ''}{m.quantity}
                      </td>
                      <td className="px-5 py-3 text-gray-500 capitalize">{m.reference}</td>
                      <td className="px-5 py-3 text-gray-500">
                        {m.createdBy ? `${m.createdBy.first_name} ${m.createdBy.last_name}` : '-'}
                      </td>
                    </tr>
                  ))}
                  {movements.length === 0 && (
                    <tr><td colSpan="6" className="px-5 py-8 text-center text-gray-400">No movements recorded yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            {movementPagination.totalPages > 1 && (
              <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-3">
                {Array.from({ length: movementPagination.totalPages }, (_, i) => (
                  <button
                    key={i}
                    onClick={() => fetchMovements(i + 1)}
                    className={`h-7 w-7 rounded text-xs font-medium ${
                      movementPagination.page === i + 1 ? 'bg-primary-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >{i + 1}</button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
