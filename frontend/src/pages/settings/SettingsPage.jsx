import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../../contexts/AuthContext';
import { updateProfileApi } from '../../api/auth.api';
import ChangePasswordModal from '../../components/common/ChangePasswordModal';
import { HiOutlineUser, HiOutlineMail, HiOutlinePhone, HiOutlineBriefcase, HiOutlineKey, HiOutlineLogout } from 'react-icons/hi';

export default function SettingsPage() {
  const { user, refreshProfile, logout } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);

  useEffect(() => {
    if (user) {
      setFirstName(user.first_name || '');
      setLastName(user.last_name || '');
      setPhone(user.phone || '');
    }
  }, [user]);

  const dirty =
    firstName !== (user?.first_name || '') ||
    lastName !== (user?.last_name || '') ||
    phone !== (user?.phone || '');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!dirty) return;
    setSubmitting(true);
    try {
      await updateProfileApi({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.trim() || null,
      });
      await refreshProfile();
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    } finally {
      setSubmitting(false);
    }
  }

  if (!user) return null;

  const initials = `${user.first_name?.[0] || ''}${user.last_name?.[0] || ''}`.toUpperCase();

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Settings</h1>

      {/* Profile */}
      <div className="mb-6 rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Profile</h2>

        <div className="mb-6 flex items-center gap-4 border-b pb-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-600 text-xl font-semibold text-white">
            {initials || <HiOutlineUser className="h-8 w-8" />}
          </div>
          <div>
            <p className="text-lg font-semibold text-gray-900">{user.first_name} {user.last_name}</p>
            <p className="text-sm text-gray-500 capitalize">{user.role?.name || 'User'}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">First Name</label>
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Last Name</label>
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary-500"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              <HiOutlineMail className="mr-1 inline h-4 w-4" /> Email
            </label>
            <input
              value={user.email}
              disabled
              className="w-full cursor-not-allowed rounded-lg border bg-gray-50 px-3 py-2 text-sm text-gray-500"
            />
            <p className="mt-1 text-xs text-gray-400">Email is used for login and cannot be changed.</p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              <HiOutlinePhone className="mr-1 inline h-4 w-4" /> Phone
            </label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Optional"
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              <HiOutlineBriefcase className="mr-1 inline h-4 w-4" /> Role
            </label>
            <input
              value={user.role?.name || ''}
              disabled
              className="w-full cursor-not-allowed rounded-lg border bg-gray-50 px-3 py-2 text-sm text-gray-500 capitalize"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={!dirty || submitting}
              className="rounded-lg bg-primary-600 px-5 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>

      {/* Security */}
      <div className="mb-6 rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Security</h2>
        <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
          <div>
            <p className="text-sm font-medium text-gray-900">Password</p>
            <p className="text-xs text-gray-500">Change your account password</p>
          </div>
          <button
            onClick={() => setShowChangePassword(true)}
            className="flex items-center gap-2 rounded-lg border border-primary-600 px-4 py-2 text-sm font-medium text-primary-700 hover:bg-primary-50"
          >
            <HiOutlineKey className="h-4 w-4" /> Change Password
          </button>
        </div>
      </div>

      {/* Session */}
      <div className="rounded-xl bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Session</h2>
        <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
          <div>
            <p className="text-sm font-medium text-gray-900">Sign out</p>
            <p className="text-xs text-gray-500">End your session on this device</p>
          </div>
          <button
            onClick={() => { if (confirm('Log out now?')) logout(); }}
            className="flex items-center gap-2 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            <HiOutlineLogout className="h-4 w-4" /> Logout
          </button>
        </div>
      </div>

      {showChangePassword && <ChangePasswordModal onClose={() => setShowChangePassword(false)} />}
    </div>
  );
}
