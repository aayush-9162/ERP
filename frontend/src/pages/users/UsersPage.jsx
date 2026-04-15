import { useState, useEffect, useCallback } from 'react';
import { getUsersApi, createUserApi, updateUserApi, deleteUserApi } from '../../api/users.api';
import { getRolesApi } from '../../api/roles.api';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import { HiOutlinePlus, HiOutlinePencil, HiOutlineBan, HiOutlineCheckCircle } from 'react-icons/hi';

const EMPTY_FORM = { first_name: '', last_name: '', email: '', password: '', phone: '', role_id: '' };

export default function UsersPage() {
  const { isAdmin } = useAuth();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0, totalPages: 1 });
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const fetchUsers = useCallback(async (page = 1) => {
    try {
      const res = await getUsersApi({ page, limit: 10, search });
      setUsers(res.data.data);
      setPagination(res.data.pagination);
    } catch {
      toast.error('Failed to load users');
    }
  }, [search]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  useEffect(() => {
    getRolesApi().then((res) => setRoles(res.data.data.roles)).catch(() => {});
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  }

  function openEdit(user) {
    setEditing(user);
    setForm({
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      password: '',
      phone: user.phone || '',
      role_id: user.role_id,
    });
    setShowModal(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editing) {
        const data = { ...form };
        if (!data.password) delete data.password;
        await updateUserApi(editing.id, data);
        toast.success('User updated');
      } else {
        await createUserApi(form);
        toast.success('User created');
      }
      setShowModal(false);
      fetchUsers(pagination.page);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleStatus(user) {
    try {
      if (user.status === 'active') {
        await deleteUserApi(user.id);
        toast.success('User deactivated');
      } else {
        await updateUserApi(user.id, { status: 'active' });
        toast.success('User activated');
      }
      fetchUsers(pagination.page);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  }

  function setField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-sm text-gray-500">{pagination.total} users total</p>
        </div>
        {isAdmin && (
          <button onClick={openCreate} className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700 transition-colors">
            <HiOutlinePlus className="h-4 w-4" /> Add User
          </button>
        )}
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-sm rounded-lg border border-gray-300 px-4 py-2 text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100"
        />
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
            <tr>
              <th className="px-6 py-3">Name</th>
              <th className="px-6 py-3">Email</th>
              <th className="px-6 py-3">Role</th>
              <th className="px-6 py-3">Status</th>
              {isAdmin && <th className="px-6 py-3 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 font-medium">{u.first_name} {u.last_name}</td>
                <td className="px-6 py-4 text-gray-500">{u.email}</td>
                <td className="px-6 py-4">
                  <span className="rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-medium text-primary-700 capitalize">
                    {u.role?.name}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    u.status === 'active' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                  }`}>
                    {u.status}
                  </span>
                </td>
                {isAdmin && (
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => openEdit(u)} className="mr-2 text-gray-400 hover:text-primary-600" title="Edit">
                      <HiOutlinePencil className="h-4 w-4" />
                    </button>
                    <button onClick={() => toggleStatus(u)} className="text-gray-400 hover:text-red-600" title={u.status === 'active' ? 'Deactivate' : 'Activate'}>
                      {u.status === 'active' ? <HiOutlineBan className="h-4 w-4" /> : <HiOutlineCheckCircle className="h-4 w-4" />}
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {users.length === 0 && (
              <tr><td colSpan="5" className="px-6 py-8 text-center text-gray-400">No users found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-end gap-2">
          {Array.from({ length: pagination.totalPages }, (_, i) => (
            <button
              key={i}
              onClick={() => fetchUsers(i + 1)}
              className={`h-8 w-8 rounded-lg text-sm font-medium ${
                pagination.page === i + 1 ? 'bg-primary-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'
              }`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-lg font-semibold">{editing ? 'Edit User' : 'Create User'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">First Name</label>
                  <input value={form.first_name} onChange={(e) => setField('first_name', e.target.value)} required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Last Name</label>
                  <input value={form.last_name} onChange={(e) => setField('last_name', e.target.value)} required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
                <input type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Password {editing && <span className="text-gray-400">(leave blank to keep current)</span>}
                </label>
                <input type="password" value={form.password} onChange={(e) => setField('password', e.target.value)} {...(!editing && { required: true })} minLength={8} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Phone</label>
                <input value={form.phone} onChange={(e) => setField('phone', e.target.value)} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Role</label>
                <select value={form.role_id} onChange={(e) => setField('role_id', e.target.value)} required className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-primary-500">
                  <option value="">Select role</option>
                  {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
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
