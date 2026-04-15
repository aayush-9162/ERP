import { useState } from 'react';
import { createProductApi, updateProductApi } from '../../api/inventory.api';
import toast from 'react-hot-toast';

const UNITS = ['pcs', 'kg', 'g', 'ltr', 'ml', 'box', 'pack', 'set', 'pair', 'meter'];

const EMPTY = {
  name: '', sku: '', barcode: '', category_id: '', brand_id: '',
  purchase_price: '', selling_price: '', tax_rate: '18', unit: 'pcs', min_stock_alert: '10',
};

export default function ProductFormModal({ product, categories, brands, onClose, onSaved }) {
  const isEdit = !!product;
  const [form, setForm] = useState(
    isEdit
      ? {
          name: product.name, sku: product.sku, barcode: product.barcode || '',
          category_id: product.category_id || '', brand_id: product.brand_id || '',
          purchase_price: product.purchase_price, selling_price: product.selling_price,
          tax_rate: product.tax_rate, unit: product.unit, min_stock_alert: product.min_stock_alert,
        }
      : EMPTY
  );
  const [submitting, setSubmitting] = useState(false);

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const data = { ...form };
      // Convert numeric fields
      data.purchase_price = parseFloat(data.purchase_price);
      data.selling_price = parseFloat(data.selling_price);
      data.tax_rate = parseFloat(data.tax_rate);
      data.min_stock_alert = parseInt(data.min_stock_alert, 10);
      if (data.category_id) data.category_id = parseInt(data.category_id, 10);
      else delete data.category_id;
      if (data.brand_id) data.brand_id = parseInt(data.brand_id, 10);
      else delete data.brand_id;
      if (!data.sku) delete data.sku; // let backend auto-generate
      if (!data.barcode) delete data.barcode;

      if (isEdit) {
        await updateProductApi(product.id, data);
        toast.success('Product updated');
      } else {
        await createProductApi(data);
        toast.success('Product created');
      }
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
        <h2 className="mb-5 text-lg font-semibold">{isEdit ? 'Edit Product' : 'Add Product'}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Row 1: Name */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Product Name *</label>
            <input value={form.name} onChange={(e) => set('name', e.target.value)} required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500" />
          </div>

          {/* Row 2: SKU + Barcode */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">SKU <span className="text-gray-400">(auto if blank)</span></label>
              <input value={form.sku} onChange={(e) => set('sku', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Barcode</label>
              <input value={form.barcode} onChange={(e) => set('barcode', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500" />
            </div>
          </div>

          {/* Row 3: Category + Brand */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Category</label>
              <select value={form.category_id} onChange={(e) => set('category_id', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500">
                <option value="">None</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Brand</label>
              <select value={form.brand_id} onChange={(e) => set('brand_id', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500">
                <option value="">None</option>
                {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          </div>

          {/* Row 4: Prices + Tax */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Purchase Price *</label>
              <input type="number" step="0.01" min="0" value={form.purchase_price} onChange={(e) => set('purchase_price', e.target.value)} required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Selling Price *</label>
              <input type="number" step="0.01" min="0" value={form.selling_price} onChange={(e) => set('selling_price', e.target.value)} required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">GST %</label>
              <input type="number" step="0.01" min="0" max="100" value={form.tax_rate} onChange={(e) => set('tax_rate', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500" />
            </div>
          </div>

          {/* Row 5: Unit + Min Stock */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Unit</label>
              <select value={form.unit} onChange={(e) => set('unit', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500">
                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Min Stock Alert</label>
              <input type="number" min="0" value={form.min_stock_alert} onChange={(e) => set('min_stock_alert', e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500" />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-3">
            <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={submitting} className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50">
              {submitting ? 'Saving...' : isEdit ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
