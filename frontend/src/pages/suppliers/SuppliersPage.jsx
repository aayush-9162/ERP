import { useState, useEffect, useCallback } from 'react';
import { getSuppliersApi, createSupplierApi, updateSupplierApi } from '../../api/purchases.api';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import { HiOutlinePlus, HiOutlinePencil } from 'react-icons/hi';

const EMPTY = { name: '', phone: '', email: '', address: '', gst_number: '' };

export default function SuppliersPage() {
  const { isAdmin, isManager } = useAuth();
  const canWrite = isAdmin || isManager;

  const [suppliers, setSuppliers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);

  const fetchSuppliers = useCallback(async (page = 1) => {
    try {
      const res = await getSuppliersApi({ page, limit: 10, search });
      setSuppliers(res.data.data);
      setPagination(res.data.pagination);
    } catch { toast.error('Failed to load suppliers'); }
  }, [search]);

  useEffect(() => { fetchSuppliers(); }, [fetchSuppliers]);

  function openCreate() { setEditing(null); setForm(EMPTY); setShowModal(true); }
  function openEdit(s) {
    setEditing(s);
    setForm({ name: s.name, phone: s.phone || '', email: s.email || '', address: s.address || '', gst_number: s.gst_number || '' });
    setShowModal(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editing) { await updateSupplierApi(editing.id, form); toast.success('Supplier updated'); }
      else { await createSupplierApi(form); toast.success('Supplier created'); }
      setShowModal(false);
      fetchSuppliers(pagination.page);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSubmitting(false); }
  }

  function set(f, v) { setForm((p) => ({ ...p, [f]: v })); }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">Suppliers</h1><p className="text-sm text-gray-500">{pagination.total} suppliers</p></div>
        {canWrite && <button onClick={openCreate} className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700"><HiOutlinePlus className="h-4 w-4" /> Add Supplier</button>}
      </div>

      <div className="mb-4">
        <input type="text" placeholder="Search by name, phone, email..." value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-sm rounded-lg border px-4 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100" />
      </div>

      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
            <tr><th className="px-5 py-3">Name</th><th className="px-5 py-3">Phone</th><th className="px-5 py-3">Email</th><th className="px-5 py-3">GST</th><th className="px-5 py-3">Status</th>{canWrite && <th className="px-5 py-3 text-right">Actions</th>}</tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {suppliers.map((s) => (
              <tr key={s.id} className="hover:bg-gray-50">
                <td className="px-5 py-3 font-medium">{s.name}</td>
                <td className="px-5 py-3 text-gray-500">{s.phone || '-'}</td>
                <td className="px-5 py-3 text-gray-500">{s.email || '-'}</td>
                <td className="px-5 py-3 font-mono text-xs text-gray-400">{s.gst_number || '-'}</td>
                <td className="px-5 py-3"><span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${s.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{s.status}</span></td>
                {canWrite && <td className="px-5 py-3 text-right"><button onClick={() => openEdit(s)} className="text-gray-400 hover:text-primary-600"><HiOutlinePencil className="h-4 w-4" /></button></td>}
              </tr>
            ))}
            {suppliers.length === 0 && <tr><td colSpan="6" className="px-5 py-8 text-center text-gray-400">No suppliers found</td></tr>}
          </tbody>
        </table>
      </div>

      {pagination.totalPages > 1 && (
        <div className="mt-4 flex justify-end gap-2">
          {Array.from({ length: pagination.totalPages }, (_, i) => (
            <button key={i} onClick={() => fetchSuppliers(i + 1)} className={`h-8 w-8 rounded-lg text-sm font-medium ${pagination.page === i + 1 ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>{i + 1}</button>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold">{editing ? 'Edit Supplier' : 'Add Supplier'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div><label className="mb-1 block text-sm font-medium text-gray-700">Name *</label><input value={form.name} onChange={(e) => set('name', e.target.value)} required className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary-500" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="mb-1 block text-sm font-medium text-gray-700">Phone</label><input value={form.phone} onChange={(e) => set('phone', e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary-500" /></div>
                <div><label className="mb-1 block text-sm font-medium text-gray-700">Email</label><input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary-500" /></div>
              </div>
              <div><label className="mb-1 block text-sm font-medium text-gray-700">GST Number</label><input value={form.gst_number} onChange={(e) => set('gst_number', e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary-500" /></div>
              <div><label className="mb-1 block text-sm font-medium text-gray-700">Address</label><textarea value={form.address} onChange={(e) => set('address', e.target.value)} rows={2} className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary-500" /></div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={submitting} className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50">{submitting ? 'Saving...' : editing ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
