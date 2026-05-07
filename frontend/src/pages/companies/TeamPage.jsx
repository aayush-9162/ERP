import { useState, useEffect } from 'react';
import { getTeamApi, inviteUserApi, removeUserApi, resetMemberPasswordApi } from '../../api/companies.api';
import { getRolesApi } from '../../api/roles.api';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import { HiOutlinePlus, HiOutlineTrash, HiOutlinePencil, HiOutlineBan, HiOutlineCheckCircle, HiOutlineKey } from 'react-icons/hi';

export default function TeamPage() {
  const { activeCompany, user: currentUser, isAdmin, isManager } = useAuth();
  const canManage = isAdmin || isManager;
  const [resetResult, setResetResult] = useState(null);

  const [members, setMembers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [showInvite, setShowInvite] = useState(false);
  const [showEditRole, setShowEditRole] = useState(null);
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [roleId, setRoleId] = useState('');
  const [editRoleId, setEditRoleId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [inviteResult, setInviteResult] = useState(null);

  function fetchTeam() {
    if (!activeCompany) return;
    getTeamApi(activeCompany.id).then((r) => setMembers(r.data.data.members)).catch(() => {});
  }

  useEffect(() => {
    fetchTeam();
    getRolesApi().then((r) => setRoles(r.data.data.roles)).catch(() => {});
  }, [activeCompany]);

  async function handleInvite(e) {
    e.preventDefault();
    setSubmitting(true);
    setInviteResult(null);
    try {
      const res = await inviteUserApi(activeCompany.id, {
        email,
        first_name: firstName || undefined,
        last_name: lastName || undefined,
        phone: phone || undefined,
        role_id: parseInt(roleId) || undefined,
      });
      const data = res.data.data;
      if (data.is_new_user) {
        setInviteResult({ email, tempPassword: data.temp_password || 'Welcome@123' });
        toast.success('New user created and added!');
      } else {
        toast.success('User added to company');
        setShowInvite(false);
      }
      setEmail(''); setFirstName(''); setLastName(''); setPhone(''); setRoleId('');
      fetchTeam();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemove(userId) {
    if (!confirm('Remove this user from the company?')) return;
    try {
      await removeUserApi(activeCompany.id, userId);
      toast.success('User removed');
      fetchTeam();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  }

  async function handleChangeRole(membershipUserId) {
    try {
      // Re-invite with new role (the backend handles updating existing membership)
      const member = members.find((m) => m.user?.id === membershipUserId);
      if (!member) return;
      await inviteUserApi(activeCompany.id, { email: member.user.email, role_id: parseInt(editRoleId) });
      toast.success('Role updated');
      setShowEditRole(null);
      fetchTeam();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  }

  async function handleResetPassword(userId, email) {
    if (!confirm(`Reset password for ${email}? They will need the new temporary password to log in.`)) return;
    try {
      const res = await resetMemberPasswordApi(activeCompany.id, userId);
      setResetResult({ email, tempPassword: res.data.data.temp_password });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reset password');
    }
  }

  async function handleReactivate(userId) {
    const member = members.find((m) => m.user?.id === userId);
    if (!member) return;
    try {
      await inviteUserApi(activeCompany.id, { email: member.user.email, role_id: member.role?.id });
      toast.success('User reactivated');
      fetchTeam();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    }
  }

  const statusBadge = (s) => ({
    active: 'bg-green-50 text-green-700',
    invited: 'bg-blue-50 text-blue-700',
    removed: 'bg-red-50 text-red-700',
  }[s] || 'bg-gray-50 text-gray-700');

  const activeMembers = members.filter((m) => m.status === 'active');
  const inactiveMembers = members.filter((m) => m.status !== 'active');

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team</h1>
          <p className="text-sm text-gray-500">
            {activeCompany?.name} — {activeMembers.length} active member{activeMembers.length !== 1 ? 's' : ''}
          </p>
        </div>
        {canManage && (
          <button
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
          >
            <HiOutlinePlus className="h-4 w-4" /> Add Member
          </button>
        )}
      </div>

      {/* Active members */}
      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
            <tr>
              <th className="px-5 py-3">Name</th>
              <th className="px-5 py-3">Email</th>
              <th className="px-5 py-3">Phone</th>
              <th className="px-5 py-3">Role</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Joined</th>
              {canManage && <th className="px-5 py-3 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {members.map((m) => (
              <tr key={m.id} className="hover:bg-gray-50">
                <td className="px-5 py-3 font-medium">
                  {m.user?.first_name} {m.user?.last_name}
                </td>
                <td className="px-5 py-3 text-gray-500">{m.user?.email}</td>
                <td className="px-5 py-3 text-gray-500">{m.user?.phone || '-'}</td>
                <td className="px-5 py-3">
                  {showEditRole === m.user?.id ? (
                    <div className="flex items-center gap-1">
                      <select
                        value={editRoleId}
                        onChange={(e) => setEditRoleId(e.target.value)}
                        className="rounded border px-2 py-1 text-xs"
                      >
                        {roles.map((r) => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleChangeRole(m.user?.id)}
                        className="rounded bg-primary-600 px-2 py-1 text-xs text-white"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setShowEditRole(null)}
                        className="text-xs text-gray-400"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <span
                      className="cursor-pointer rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-medium text-primary-700 capitalize hover:bg-primary-100"
                      onClick={() => {
                        if (!canManage) return;
                        setShowEditRole(m.user?.id);
                        setEditRoleId(m.role?.id);
                      }}
                      title={canManage ? 'Click to change role' : ''}
                    >
                      {m.role?.name}
                      {canManage && <HiOutlinePencil className="ml-1 inline h-3 w-3" />}
                    </span>
                  )}
                </td>
                <td className="px-5 py-3">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge(m.status)}`}>
                    {m.status}
                  </span>
                </td>
                <td className="px-5 py-3 text-xs text-gray-500">
                  {m.createdAt ? new Date(m.createdAt).toLocaleDateString('en-IN') : '-'}
                </td>
                {canManage && (
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {isAdmin && m.status === 'active' && m.user?.id !== currentUser?.id && (
                        <button
                          onClick={() => handleResetPassword(m.user?.id, m.user?.email)}
                          className="text-gray-400 hover:text-primary-600"
                          title="Reset password"
                        >
                          <HiOutlineKey className="h-4 w-4" />
                        </button>
                      )}
                      {m.status === 'active' && (
                        <button
                          onClick={() => handleRemove(m.user?.id)}
                          className="text-gray-400 hover:text-red-600"
                          title="Remove from company"
                        >
                          <HiOutlineBan className="h-4 w-4" />
                        </button>
                      )}
                      {m.status === 'removed' && (
                        <button
                          onClick={() => handleReactivate(m.user?.id)}
                          className="text-gray-400 hover:text-green-600"
                          title="Reactivate"
                        >
                          <HiOutlineCheckCircle className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {members.length === 0 && (
              <tr>
                <td colSpan="7" className="px-5 py-8 text-center text-gray-400">
                  No team members yet. Invite someone to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Password reset result modal */}
      {resetResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h2 className="mb-2 text-lg font-semibold text-green-700">Password Reset</h2>
            <div className="mb-4 rounded-lg bg-green-50 p-4 text-sm">
              <p>Password reset for <strong>{resetResult.email}</strong></p>
              <p className="mt-2">New temporary password: <code className="rounded bg-gray-100 px-2 py-0.5 font-mono text-primary-700">{resetResult.tempPassword}</code></p>
              <p className="mt-2 text-xs text-gray-500">Share this with the user securely. They should change it after logging in.</p>
            </div>
            <button onClick={() => setResetResult(null)} className="w-full rounded-lg bg-primary-600 py-2 text-sm font-medium text-white hover:bg-primary-700">Done</button>
          </div>
        </div>
      )}

      {/* Invite / Add Member modal */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            {inviteResult ? (
              <>
                <h2 className="mb-2 text-lg font-semibold text-green-700">User Created</h2>
                <div className="mb-4 rounded-lg bg-green-50 p-4 text-sm">
                  <p>New account created for <strong>{inviteResult.email}</strong></p>
                  <p className="mt-2">Temporary password: <code className="rounded bg-gray-100 px-2 py-0.5 font-mono text-primary-700">{inviteResult.tempPassword}</code></p>
                  <p className="mt-2 text-xs text-gray-500">Please share these credentials securely. The user should change their password after first login.</p>
                </div>
                <button onClick={() => { setShowInvite(false); setInviteResult(null); }} className="w-full rounded-lg bg-primary-600 py-2 text-sm font-medium text-white hover:bg-primary-700">Done</button>
              </>
            ) : (
              <>
                <h2 className="mb-2 text-lg font-semibold">Add Member</h2>
                <p className="mb-4 text-sm text-gray-500">Enter an email. If the user doesn't exist, a new account will be created.</p>
                <form onSubmit={handleInvite} className="space-y-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Email *</label>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="user@example.com" className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary-500" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">First Name</label>
                      <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Required for new users" className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary-500" />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Last Name</label>
                      <input value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary-500" />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Phone</label>
                    <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optional" className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary-500" />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Role</label>
                    <select value={roleId} onChange={(e) => setRoleId(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary-500">
                      <option value="">Staff (default)</option>
                      {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                    </select>
                  </div>
                  <div className="flex justify-end gap-3 pt-2">
                    <button type="button" onClick={() => { setShowInvite(false); setInviteResult(null); }} className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                    <button type="submit" disabled={submitting} className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50">{submitting ? 'Adding...' : 'Add Member'}</button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
