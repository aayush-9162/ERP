import { useState, useEffect } from 'react';
import { getCompanyApi, updateCompanyApi } from '../../api/company.api';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

const FIELDS = [
  { key: 'name', label: 'Company Name', required: true },
  { key: 'gst_number', label: 'GST Number' },
  { key: 'pan_number', label: 'PAN Number' },
  { key: 'email', label: 'Email', type: 'email' },
  { key: 'phone', label: 'Phone' },
  { key: 'website', label: 'Website' },
  { key: 'address_line1', label: 'Address Line 1' },
  { key: 'address_line2', label: 'Address Line 2' },
  { key: 'city', label: 'City' },
  { key: 'state', label: 'State' },
  { key: 'pincode', label: 'Pincode' },
  { key: 'country', label: 'Country' },
];

export default function CompanyPage() {
  const { isAdmin } = useAuth();
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getCompanyApi()
      .then((res) => setForm(res.data.data.company))
      .catch(() => setForm({}))
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await updateCompanyApi(form);
      setForm(res.data.data.company);
      toast.success('Company profile updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" /></div>;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Company Settings</h1>
        <p className="text-sm text-gray-500">
          {isAdmin ? 'Manage your company profile' : 'View company details'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-3xl rounded-xl bg-white p-6 shadow-sm">
        <div className="grid gap-5 sm:grid-cols-2">
          {FIELDS.map(({ key, label, type, required }) => (
            <div key={key} className={key === 'address_line1' || key === 'address_line2' ? 'sm:col-span-2' : ''}>
              <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
              <input
                type={type || 'text'}
                value={form[key] || ''}
                onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
                required={required}
                disabled={!isAdmin}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500 disabled:bg-gray-50 disabled:text-gray-500"
              />
            </div>
          ))}
        </div>

        {isAdmin && (
          <div className="mt-6 flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-primary-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
