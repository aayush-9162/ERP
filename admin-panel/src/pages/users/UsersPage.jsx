import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { listAllUsers, toggleUserStatus, resetUserPassword } from '../../api/admin.api';
import toast from 'react-hot-toast';
import { HiOutlineSearch } from 'react-icons/hi';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [tenantFilter, setTenantFilter] = useState('');

  function load(page = 1) {
    setLoading(true);
    const params = { page, limit: 20 };
    if (search) params.search = search;
    if (statusFilter) params.status = statusFilter;
    if (tenantFilter) params.tenant_id = tenantFilter;

    listAllUsers(params)
      .then((res) => {
        setUsers(res.data.data);
        setPagination(res.data.pagination);
      })
      .catch(() => toast.error('Failed to load users'))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [statusFilter]);

  function handleSearch(e) {
    e.preventDefault();
    load(1);
  }

  async function handleToggle(userId) {
    try {
      const res = await toggleUserStatus(userId);
      toast.success(`User ${res.data.data.status}`);
      load(pagination.page);
    } catch (err) {
      toast.error('Action failed');
    }
  }

  async function handleReset(userId) {
    try {
      const res = await resetUserPassword(userId);
      toast.success(`Password reset to: ${res.data.data.temp_password}`);
    } catch (err) {
      toast.error('Reset failed');
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">All Users</h1>
        <p className="text-sm text-gray-500">Manage users across all tenants</p>
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
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">User</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Email</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Tenant</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Role</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Last Login</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan="7" className="text-center py-8 text-gray-400">Loading...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan="7" className="text-center py-8 text-gray-400">No users found</td></tr>
            ) : users.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <p className="text-sm font-medium text-gray-800">{u.first_name} {u.last_name}</p>
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">{u.email}</td>
                <td className="px-4 py-3">
                  {u.tenant ? (
                    <Link to={`/tenants/${u.tenant.id}`} className="text-sm text-indigo-600 hover:underline">
                      {u.tenant.business_name}
                    </Link>
                  ) : (
                    <span className="text-sm text-gray-400">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm capitalize">{u.role?.name || '-'}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${u.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {u.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {u.last_login ? new Date(u.last_login).toLocaleDateString() : 'Never'}
                </td>
                <td className="px-4 py-3 text-right space-x-1">
                  <button onClick={() => handleReset(u.id)} className="text-xs px-2 py-1 bg-amber-50 text-amber-600 rounded hover:bg-amber-100">Reset Pwd</button>
                  <button
                    onClick={() => handleToggle(u.id)}
                    className={`text-xs px-2 py-1 rounded ${u.status === 'active' ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
                  >
                    {u.status === 'active' ? 'Disable' : 'Enable'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {pagination.totalPages > 1 && (
          <div className="flex justify-between items-center px-4 py-3 border-t">
            <span className="text-sm text-gray-500">
              Showing {((pagination.page - 1) * 20) + 1}-{Math.min(pagination.page * 20, pagination.total)} of {pagination.total}
            </span>
            <div className="flex gap-1">
              {Array.from({ length: Math.min(pagination.totalPages, 10) }, (_, i) => i + 1).map((p) => (
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
