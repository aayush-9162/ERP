import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { listTenants, suspendTenant, activateTenant, deleteTenant } from '../../api/admin.api';
import toast from 'react-hot-toast';
import { HiOutlinePlus, HiOutlineSearch, HiOutlineFilter } from 'react-icons/hi';

const STATUS_COLORS = {
  active: 'bg-green-100 text-green-700',
  trial: 'bg-blue-100 text-blue-700',
  suspended: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

const COUNTRY_FLAGS = { IN: 'IN', US: 'US', GB: 'GB', AE: 'AE' };

export default function TenantsListPage() {
  const [tenants, setTenants] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const navigate = useNavigate();

  function load(page = 1) {
    setLoading(true);
    const params = { page, limit: 15 };
    if (search) params.search = search;
    if (statusFilter) params.status = statusFilter;
    if (countryFilter) params.country = countryFilter;

    listTenants(params)
      .then((res) => {
        setTenants(res.data.data);
        setPagination(res.data.pagination);
      })
      .catch(() => toast.error('Failed to load tenants'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [statusFilter, countryFilter]);

  function handleSearch(e) {
    e.preventDefault();
    load(1);
  }

  async function handleAction(id, action) {
    try {
      if (action === 'suspend') {
        await suspendTenant(id);
        toast.success('Tenant suspended');
      } else if (action === 'activate') {
        await activateTenant(id);
        toast.success('Tenant activated');
      } else if (action === 'cancel') {
        if (!window.confirm('Cancel this tenant? All users will be deactivated.')) return;
        await deleteTenant(id);
        toast.success('Tenant cancelled');
      }
      load(pagination.page);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed');
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Tenants</h1>
          <p className="text-sm text-gray-500">Manage all business accounts</p>
        </div>
        <Link
          to="/tenants/new"
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
        >
          <HiOutlinePlus className="w-4 h-4" /> Add Tenant
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm p-4 flex flex-wrap gap-3 items-center">
        <form onSubmit={handleSearch} className="flex items-center gap-2 flex-1 min-w-[200px]">
          <div className="relative flex-1">
            <HiOutlineSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email..."
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          <button type="submit" className="bg-gray-100 px-3 py-2 rounded-lg text-sm hover:bg-gray-200">Search</button>
        </form>

        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="trial">Trial</option>
          <option value="suspended">Suspended</option>
          <option value="cancelled">Cancelled</option>
        </select>

        <select value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
          <option value="">All Countries</option>
          <option value="IN">India</option>
          <option value="US">USA</option>
          <option value="GB">UK</option>
          <option value="AE">UAE</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Business</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Owner</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Country</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Plan</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Created</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan="7" className="text-center py-8 text-gray-400">Loading...</td></tr>
            ) : tenants.length === 0 ? (
              <tr><td colSpan="7" className="text-center py-8 text-gray-400">No tenants found</td></tr>
            ) : tenants.map((t) => (
              <tr key={t.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/tenants/${t.id}`)}>
                <td className="px-4 py-3">
                  <p className="text-sm font-medium text-gray-800">{t.business_name}</p>
                  <p className="text-xs text-gray-400">{t.slug}</p>
                </td>
                <td className="px-4 py-3">
                  <p className="text-sm text-gray-700">{t.owner_name}</p>
                  <p className="text-xs text-gray-400">{t.owner_email}</p>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{t.country} ({t.currency})</td>
                <td className="px-4 py-3">
                  <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded-full font-medium capitalize">{t.plan}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[t.status]}`}>{t.status}</span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">{new Date(t.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                  <div className="flex gap-1 justify-end">
                    {t.status === 'active' && (
                      <button onClick={() => handleAction(t.id, 'suspend')} className="text-xs px-2 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100">Suspend</button>
                    )}
                    {(t.status === 'suspended' || t.status === 'trial') && (
                      <button onClick={() => handleAction(t.id, 'activate')} className="text-xs px-2 py-1 bg-green-50 text-green-600 rounded hover:bg-green-100">Activate</button>
                    )}
                    {t.status !== 'cancelled' && (
                      <button onClick={() => handleAction(t.id, 'cancel')} className="text-xs px-2 py-1 bg-gray-50 text-gray-600 rounded hover:bg-gray-100">Cancel</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex justify-between items-center px-4 py-3 border-t">
            <span className="text-sm text-gray-500">
              Showing {((pagination.page - 1) * 15) + 1}-{Math.min(pagination.page * 15, pagination.total)} of {pagination.total}
            </span>
            <div className="flex gap-1">
              {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => load(p)}
                  className={`px-3 py-1 rounded text-sm ${p === pagination.page ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
