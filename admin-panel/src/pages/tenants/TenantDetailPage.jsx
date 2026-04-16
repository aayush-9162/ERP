import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getTenant, getTenantStats, updateTenant, suspendTenant, activateTenant, getTenantUsers, resetUserPassword, toggleUserStatus } from '../../api/admin.api';
import toast from 'react-hot-toast';
import { HiOutlineArrowLeft, HiOutlinePencil, HiOutlineRefresh } from 'react-icons/hi';

const STATUS_COLORS = {
  active: 'bg-green-100 text-green-700 border-green-200',
  trial: 'bg-blue-100 text-blue-700 border-blue-200',
  suspended: 'bg-red-100 text-red-700 border-red-200',
  cancelled: 'bg-gray-100 text-gray-500 border-gray-200',
};

const COUNTRY_NAMES = { IN: 'India', US: 'United States', GB: 'United Kingdom', AE: 'UAE' };

export default function TenantDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tenant, setTenant] = useState(null);
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});

  useEffect(() => {
    Promise.all([
      getTenant(id).then((r) => { setTenant(r.data.data); setEditForm(r.data.data); }),
      getTenantStats(id).then((r) => setStats(r.data.data?.usage)),
      getTenantUsers(id).then((r) => setUsers(r.data.data)),
    ])
      .catch(() => toast.error('Failed to load tenant'))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSave() {
    try {
      await updateTenant(id, {
        business_name: editForm.business_name,
        owner_name: editForm.owner_name,
        owner_phone: editForm.owner_phone,
        country: editForm.country,
        plan: editForm.plan,
        max_users: editForm.max_users,
        max_companies: editForm.max_companies,
        address: editForm.address,
        gst_number: editForm.gst_number,
        notes: editForm.notes,
      });
      toast.success('Tenant updated');
      setEditing(false);
      getTenant(id).then((r) => setTenant(r.data.data));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    }
  }

  async function handleToggleStatus() {
    try {
      if (tenant.status === 'active' || tenant.status === 'trial') {
        await suspendTenant(id);
        toast.success('Tenant suspended');
      } else {
        await activateTenant(id);
        toast.success('Tenant activated');
      }
      getTenant(id).then((r) => setTenant(r.data.data));
      getTenantUsers(id).then((r) => setUsers(r.data.data));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed');
    }
  }

  async function handleResetPassword(userId) {
    try {
      const res = await resetUserPassword(userId);
      toast.success(`Password reset. Temp: ${res.data.data.temp_password}`);
    } catch (err) {
      toast.error('Reset failed');
    }
  }

  async function handleToggleUser(userId) {
    try {
      const res = await toggleUserStatus(userId);
      toast.success(`User ${res.data.data.status}`);
      getTenantUsers(id).then((r) => setUsers(r.data.data));
    } catch (err) {
      toast.error('Action failed');
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" /></div>;
  if (!tenant) return <p className="text-gray-500">Tenant not found.</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/tenants')} className="text-gray-400 hover:text-gray-600"><HiOutlineArrowLeft className="w-5 h-5" /></button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{tenant.business_name}</h1>
            <p className="text-sm text-gray-500">{tenant.slug} - {COUNTRY_NAMES[tenant.country] || tenant.country}</p>
          </div>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${STATUS_COLORS[tenant.status]}`}>{tenant.status}</span>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setEditing(!editing)} className="flex items-center gap-1 text-sm px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200">
            <HiOutlinePencil className="w-4 h-4" /> {editing ? 'Cancel' : 'Edit'}
          </button>
          <button
            onClick={handleToggleStatus}
            className={`text-sm px-3 py-2 rounded-lg font-medium ${
              tenant.status === 'active' || tenant.status === 'trial'
                ? 'bg-red-50 text-red-600 hover:bg-red-100'
                : 'bg-green-50 text-green-600 hover:bg-green-100'
            }`}
          >
            {tenant.status === 'active' || tenant.status === 'trial' ? 'Suspend' : 'Activate'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Tenant Details */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Tenant Details</h2>
            {editing ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Business Name</label>
                    <input value={editForm.business_name || ''} onChange={(e) => setEditForm({ ...editForm, business_name: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Owner Name</label>
                    <input value={editForm.owner_name || ''} onChange={(e) => setEditForm({ ...editForm, owner_name: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                    <select value={editForm.country || 'IN'} onChange={(e) => setEditForm({ ...editForm, country: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm">
                      <option value="IN">India</option><option value="US">USA</option><option value="GB">UK</option><option value="AE">UAE</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Plan</label>
                    <select value={editForm.plan || 'trial'} onChange={(e) => setEditForm({ ...editForm, plan: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm">
                      <option value="trial">Trial</option><option value="basic">Basic</option><option value="professional">Professional</option><option value="enterprise">Enterprise</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Max Users</label>
                    <input type="number" value={editForm.max_users || ''} onChange={(e) => setEditForm({ ...editForm, max_users: parseInt(e.target.value) })} className="w-full border rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Max Companies</label>
                    <input type="number" value={editForm.max_companies || ''} onChange={(e) => setEditForm({ ...editForm, max_companies: parseInt(e.target.value) })} className="w-full border rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tax ID</label>
                    <input value={editForm.gst_number || ''} onChange={(e) => setEditForm({ ...editForm, gst_number: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                    <input value={editForm.owner_phone || ''} onChange={(e) => setEditForm({ ...editForm, owner_phone: e.target.value })} className="w-full border rounded-lg px-3 py-2 text-sm" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea value={editForm.notes || ''} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} rows="2" className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
                <button onClick={handleSave} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-indigo-700">Save Changes</button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-y-3 text-sm">
                <p className="text-gray-500">Owner</p><p className="font-medium">{tenant.owner_name}</p>
                <p className="text-gray-500">Email</p><p className="font-medium">{tenant.owner_email}</p>
                <p className="text-gray-500">Phone</p><p className="font-medium">{tenant.owner_phone || '-'}</p>
                <p className="text-gray-500">Country</p><p className="font-medium">{COUNTRY_NAMES[tenant.country]} ({tenant.currency})</p>
                <p className="text-gray-500">Plan</p><p className="font-medium capitalize">{tenant.plan}</p>
                <p className="text-gray-500">Limits</p><p className="font-medium">{tenant.max_users} users, {tenant.max_companies} companies</p>
                <p className="text-gray-500">Tax ID</p><p className="font-medium">{tenant.gst_number || '-'}</p>
                <p className="text-gray-500">Created</p><p className="font-medium">{new Date(tenant.createdAt).toLocaleDateString()}</p>
                {tenant.trial_ends_at && <><p className="text-gray-500">Trial Ends</p><p className="font-medium">{new Date(tenant.trial_ends_at).toLocaleDateString()}</p></>}
                {tenant.notes && <><p className="text-gray-500">Notes</p><p className="font-medium">{tenant.notes}</p></>}
              </div>
            )}
          </div>

          {/* Users */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Users ({users.length})</h2>
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-gray-500">Name</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-500">Email</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-500">Role</th>
                  <th className="text-left px-3 py-2 font-medium text-gray-500">Status</th>
                  <th className="text-right px-3 py-2 font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="px-3 py-2">{u.first_name} {u.last_name}</td>
                    <td className="px-3 py-2 text-gray-500">{u.email}</td>
                    <td className="px-3 py-2 capitalize">{u.role?.name || '-'}</td>
                    <td className="px-3 py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${u.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{u.status}</span>
                    </td>
                    <td className="px-3 py-2 text-right space-x-1">
                      <button onClick={() => handleResetPassword(u.id)} className="text-xs px-2 py-1 bg-amber-50 text-amber-600 rounded hover:bg-amber-100">Reset Pwd</button>
                      <button onClick={() => handleToggleUser(u.id)} className={`text-xs px-2 py-1 rounded ${u.status === 'active' ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}>
                        {u.status === 'active' ? 'Disable' : 'Enable'}
                      </button>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && <tr><td colSpan="5" className="text-center py-4 text-gray-400">No users</td></tr>}
              </tbody>
            </table>
          </div>

          {/* Companies */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Companies ({tenant.companies?.length || 0})</h2>
            <div className="space-y-2">
              {tenant.companies?.map((c) => (
                <div key={c.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium">{c.name}</p>
                    <p className="text-xs text-gray-400">{c.city ? `${c.city}, ` : ''}{c.state || ''} - {c.country}</p>
                  </div>
                  <span className="text-xs text-gray-500">{c.currency}</span>
                </div>
              ))}
              {(!tenant.companies || tenant.companies.length === 0) && <p className="text-sm text-gray-400">No companies</p>}
            </div>
          </div>
        </div>

        {/* Right: Usage Stats */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Usage</h2>
            {stats ? (
              <div className="space-y-4">
                <UsageBar label="Users" used={stats.users} max={stats.max_users} />
                <UsageBar label="Companies" used={stats.companies} max={stats.max_companies} />
                <div className="border-t pt-3 space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Products</span><span className="font-medium">{stats.products}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Sales</span><span className="font-medium">{stats.sales?.count} ({Number(stats.sales?.total).toLocaleString()})</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Purchases</span><span className="font-medium">{Number(stats.purchases?.total).toLocaleString()}</span></div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400">Loading stats...</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function UsageBar({ label, used, max }) {
  const pct = max > 0 ? Math.round((used / max) * 100) : 0;
  const color = pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-amber-500' : 'bg-indigo-500';
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-600">{label}</span>
        <span className="font-medium">{used} / {max}</span>
      </div>
      <div className="bg-gray-100 rounded-full h-2">
        <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
    </div>
  );
}
