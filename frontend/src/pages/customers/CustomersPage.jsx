import { useState, useEffect, useCallback } from 'react';
import { getCustomersApi, createCustomerApi, updateCustomerApi } from '../../api/sales.api';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import { HiOutlinePlus, HiOutlinePencil } from 'react-icons/hi';

const EMPTY = { name: '', phone: '', email: '', address: '', delivery_address: '', gst_number: '' };

export default function CustomersPage() {
  const { isAdmin, isManager } = useAuth();
  const canWrite = isAdmin || isManager;

  const [customers, setCustomers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);

  const fetchCustomers = useCallback(async (page = 1) => {
    try {
      const res = await getCustomersApi({ page, limit: 10, search });
      setCustomers(res.data.data);
      setPagination(res.data.pagination);
    } catch {
      toast.error('Failed to load customers');
    }
  }, [search]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  function openCreate() { setEditing(null); setForm(EMPTY); setShowModal(true); }
  function openEdit(c) {
    setEditing(c);
    setForm({
      name: c.name,
      phone: c.phone || '',
      email: c.email || '',
      address: c.address || '',
      delivery_address: c.delivery_address || '',
      gst_number: c.gst_number || '',
    });
    setShowModal(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editing) {
        await updateCustomerApi(editing.id, form);
        toast.success('Customer updated');
      } else {
        await createCustomerApi(form);
        toast.success('Customer created');
      }
      setShowModal(false);
      fetchCustomers(pagination.page);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally {
      setSubmitting(false);
    }
  }

  function set(field, value) { setForm((p) => ({ ...p, [field]: value })); }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <p className="text-sm text-gray-500">{pagination.total} customers</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700">
          <HiOutlinePlus className="h-4 w-4" /> Add Customer
        </button>
      </div>

      <div className="mb-4">
        <input type="text" placeholder="Search by name, phone, or email..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-sm rounded-lg border border-gray-300 px-4 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100" />
      </div>

      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
            <tr>
              <th className="px-5 py-3">Name</th>
              <th className="px-5 py-3">Phone</th>
              <th className="px-5 py-3">Email</th>
              <th className="px-5 py-3">GST</th>
              <th className="px-5 py-3">Status</th>
              {canWrite && <th className="px-5 py-3 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {customers.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-5 py-3 font-medium">{c.name}</td>
                <td className="px-5 py-3 text-gray-500">{c.phone || '-'}</td>
                <td className="px-5 py-3 text-gray-500">{c.email || '-'}</td>
                <td className="px-5 py-3 font-mono text-xs text-gray-400">{c.gst_number || '-'}</td>
                <td className="px-5 py-3">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${c.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{c.status}</span>
                </td>
                {canWrite && (
                  <td className="px-5 py-3 text-right">
                    <button onClick={() => openEdit(c)} className="text-gray-400 hover:text-primary-600"><HiOutlinePencil className="h-4 w-4" /></button>
                  </td>
                )}
              </tr>
            ))}
            {customers.length === 0 && (
              <tr><td colSpan="6" className="px-5 py-8 text-center text-gray-400">No customers found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {pagination.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-end gap-2">
          {Array.from({ length: pagination.totalPages }, (_, i) => (
            <button key={i} onClick={() => fetchCustomers(i + 1)}
              className={`h-8 w-8 rounded-lg text-sm font-medium ${pagination.page === i + 1 ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>{i + 1}</button>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold">{editing ? 'Edit Customer' : 'Add Customer'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Name *</label>
                <input value={form.name} onChange={(e) => set('name', e.target.value)} required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Phone</label>
                  <input value={form.phone} onChange={(e) => set('phone', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
                  <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">GST Number</label>
                <input value={form.gst_number} onChange={(e) => set('gst_number', e.target.value)} placeholder="e.g. 27AAPFU0939F1ZV" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Billing Address</label>
                <textarea value={form.address} onChange={(e) => set('address', e.target.value)} rows={2} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500" />
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="block text-sm font-medium text-gray-700">Delivery Address</label>
                  <label className="flex items-center gap-1.5 text-xs text-gray-500">
                    <input
                      type="checkbox"
                      checked={!form.delivery_address}
                      onChange={(e) => set('delivery_address', e.target.checked ? '' : (form.address || ' '))}
                      className="h-3.5 w-3.5 rounded"
                    />
                    Same as billing
                  </label>
                </div>
                <textarea
                  value={form.delivery_address}
                  onChange={(e) => set('delivery_address', e.target.value)}
                  placeholder={form.delivery_address ? '' : 'Uses billing address by default'}
                  rows={2}
                  disabled={!form.delivery_address}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 disabled:bg-gray-50 disabled:text-gray-400"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={submitting} className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50">
                  {submitting ? 'Saving...' : editing ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
