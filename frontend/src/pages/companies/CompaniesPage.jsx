import { useState, useEffect } from 'react';
import { getMyCompaniesApi, createCompanyApi } from '../../api/companies.api';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import { HiOutlinePlus, HiOutlineSwitchHorizontal } from 'react-icons/hi';

export default function CompaniesPage() {
  const { switchCompany, activeCompany } = useAuth();
  const [companies, setCompanies] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', gst_number: '', city: '', state: '', country: 'India', currency: 'INR' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { getMyCompaniesApi().then((r) => setCompanies(r.data.data.companies)).catch(() => {}); }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createCompanyApi(form);
      toast.success('Company created');
      setShowCreate(false);
      setForm({ name: '', gst_number: '', city: '', state: '', country: 'India', currency: 'INR' });
      const r = await getMyCompaniesApi();
      setCompanies(r.data.data.companies);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setSubmitting(false); }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-900">My Companies</h1><p className="text-sm text-gray-500">{companies.length} companies</p></div>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700"><HiOutlinePlus className="h-4 w-4" /> New Company</button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {companies.map((c) => (
          <div key={c.id} className={`rounded-xl bg-white p-5 shadow-sm ${activeCompany?.id === c.id ? 'ring-2 ring-primary-500' : ''}`}>
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">{c.name}</h3>
                <p className="mt-0.5 text-xs text-gray-500">{c.city}{c.state ? `, ${c.state}` : ''} ({c.currency})</p>
                {c.gst_number && <p className="mt-1 text-xs font-mono text-gray-400">GSTIN: {c.gst_number}</p>}
              </div>
              <span className="rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700 capitalize">{c.role?.name || c.role}</span>
            </div>
            <div className="mt-4">
              {activeCompany?.id === c.id ? (
                <span className="text-xs font-medium text-green-600">Currently Active</span>
              ) : (
                <button onClick={() => switchCompany(c)} className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:underline"><HiOutlineSwitchHorizontal className="h-3.5 w-3.5" /> Switch to this company</button>
              )}
            </div>
          </div>
        ))}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold">Create Company</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div><label className="mb-1 block text-sm font-medium text-gray-700">Company Name *</label><input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary-500" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="mb-1 block text-sm font-medium text-gray-700">GST Number</label><input value={form.gst_number} onChange={(e) => setForm((p) => ({ ...p, gst_number: e.target.value }))} className="w-full rounded-lg border px-3 py-2 text-sm" /></div>
                <div><label className="mb-1 block text-sm font-medium text-gray-700">Currency</label><select value={form.currency} onChange={(e) => setForm((p) => ({ ...p, currency: e.target.value }))} className="w-full rounded-lg border px-3 py-2 text-sm"><option>INR</option><option>USD</option><option>EUR</option><option>GBP</option></select></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="mb-1 block text-sm font-medium text-gray-700">City</label><input value={form.city} onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))} className="w-full rounded-lg border px-3 py-2 text-sm" /></div>
                <div><label className="mb-1 block text-sm font-medium text-gray-700">State</label><input value={form.state} onChange={(e) => setForm((p) => ({ ...p, state: e.target.value }))} className="w-full rounded-lg border px-3 py-2 text-sm" /></div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)} className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={submitting} className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50">{submitting ? 'Creating...' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
