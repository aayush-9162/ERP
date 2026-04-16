import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { createTenant, getOptions } from '../../api/admin.api';
import toast from 'react-hot-toast';
import { HiOutlineArrowLeft } from 'react-icons/hi';

export default function TenantCreatePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState({ countries: [], plans: [] });
  const [createdInfo, setCreatedInfo] = useState(null);
  const [form, setForm] = useState({
    business_name: '',
    owner_name: '',
    owner_email: '',
    owner_phone: '',
    country: 'IN',
    plan: 'trial',
    address: '',
    gst_number: '',
    notes: '',
  });

  useEffect(() => {
    getOptions().then((res) => setOptions(res.data.data)).catch(() => {});
  }, []);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await createTenant(form);
      const data = res.data.data;
      setCreatedInfo(data);
      toast.success('Tenant created!');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create tenant');
    } finally {
      setLoading(false);
    }
  }

  if (createdInfo) {
    return (
      <div className="max-w-xl mx-auto space-y-6">
        <div className="bg-green-50 border border-green-200 rounded-xl p-6 space-y-4">
          <h2 className="text-xl font-bold text-green-800">Tenant Created Successfully!</h2>
          <div className="space-y-2 text-sm">
            <p><span className="font-medium">Business:</span> {createdInfo.tenant?.business_name}</p>
            <p><span className="font-medium">Tenant ID:</span> {createdInfo.tenant?.id}</p>
            <p><span className="font-medium">Country:</span> {createdInfo.tenant?.country} ({createdInfo.tenant?.currency})</p>
            <p><span className="font-medium">Plan:</span> {createdInfo.tenant?.plan}</p>
          </div>

          <div className="bg-white border border-green-300 rounded-lg p-4 space-y-2">
            <h3 className="font-semibold text-green-700">Owner Login Credentials</h3>
            <p className="text-sm"><span className="font-medium">Email:</span> {createdInfo.owner?.email}</p>
            <p className="text-sm"><span className="font-medium">Temporary Password:</span>{' '}
              <code className="bg-gray-100 px-2 py-0.5 rounded font-mono">{createdInfo.owner?.temp_password}</code>
            </p>
            <p className="text-xs text-gray-500 mt-2">Share these credentials with the tenant owner. They can login to the ERP at the main app URL.</p>
          </div>

          <div className="bg-white border border-green-300 rounded-lg p-4 space-y-1">
            <h3 className="font-semibold text-green-700">Default Company</h3>
            <p className="text-sm">{createdInfo.company?.name} (ID: {createdInfo.company?.id})</p>
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={() => navigate('/tenants')} className="bg-gray-100 px-4 py-2 rounded-lg text-sm hover:bg-gray-200">
            Back to Tenants
          </button>
          <button onClick={() => navigate(`/tenants/${createdInfo.tenant?.id}`)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700">
            View Tenant
          </button>
          <button onClick={() => { setCreatedInfo(null); setForm({ business_name: '', owner_name: '', owner_email: '', owner_phone: '', country: 'IN', plan: 'trial', address: '', gst_number: '', notes: '' }); }} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700">
            Create Another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <button onClick={() => navigate('/tenants')} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <HiOutlineArrowLeft className="w-4 h-4" /> Back to Tenants
      </button>

      <div className="bg-white rounded-xl shadow-sm p-6">
        <h1 className="text-xl font-bold text-gray-800 mb-6">Add New Tenant</h1>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Business Info */}
          <div className="border-b pb-4">
            <h3 className="text-sm font-semibold text-gray-600 uppercase mb-3">Business Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Business Name *</label>
                <input name="business_name" value={form.business_name} onChange={handleChange} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="e.g. Acme Corp" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Country *</label>
                <select name="country" value={form.country} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
                  {options.countries.map((c) => (
                    <option key={c.code} value={c.code}>{c.name} ({c.currency}) - {c.taxSystem}</option>
                  ))}
                  {options.countries.length === 0 && <>
                    <option value="IN">India (INR)</option>
                    <option value="US">USA (USD)</option>
                    <option value="GB">UK (GBP)</option>
                    <option value="AE">UAE (AED)</option>
                  </>}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Plan *</label>
                <select name="plan" value={form.plan} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none">
                  {options.plans.map((p) => (
                    <option key={p.value} value={p.value}>{p.label} ({p.users} users, {p.companies} companies)</option>
                  ))}
                  {options.plans.length === 0 && <>
                    <option value="trial">Trial (14 days)</option>
                    <option value="basic">Basic</option>
                    <option value="professional">Professional</option>
                    <option value="enterprise">Enterprise</option>
                  </>}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tax ID / GST Number</label>
                <input name="gst_number" value={form.gst_number} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Optional" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <input name="address" value={form.address} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Optional" />
              </div>
            </div>
          </div>

          {/* Owner Info */}
          <div className="border-b pb-4">
            <h3 className="text-sm font-semibold text-gray-600 uppercase mb-3">Owner Information</h3>
            <p className="text-xs text-gray-400 mb-3">A user account will be auto-created for the owner with temporary password <code className="bg-gray-100 px-1 rounded">Welcome@123</code></p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Owner Name *</label>
                <input name="owner_name" value={form.owner_name} onChange={handleChange} required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Full name" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Owner Email *</label>
                <input name="owner_email" value={form.owner_email} onChange={handleChange} required type="email" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="owner@business.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Owner Phone</label>
                <input name="owner_phone" value={form.owner_phone} onChange={handleChange} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Optional" />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Internal Notes</label>
            <textarea name="notes" value={form.notes} onChange={handleChange} rows="2" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Private notes (only visible to super admin)" />
          </div>

          <button type="submit" disabled={loading} className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors">
            {loading ? 'Creating...' : 'Create Tenant'}
          </button>
        </form>
      </div>
    </div>
  );
}
