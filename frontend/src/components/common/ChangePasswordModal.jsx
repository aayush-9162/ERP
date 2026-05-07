import { useState } from 'react';
import toast from 'react-hot-toast';
import { changePasswordApi } from '../../api/auth.api';
import { useAuth } from '../../contexts/AuthContext';

export default function ChangePasswordModal({ forced = false, onClose }) {
  const { refreshProfile } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const rules = [
    { ok: newPassword.length >= 8, label: 'At least 8 characters' },
    { ok: /[A-Z]/.test(newPassword), label: 'One uppercase letter' },
    { ok: /[0-9]/.test(newPassword), label: 'One number' },
    { ok: newPassword.length > 0 && newPassword === confirmPassword, label: 'Passwords match' },
  ];
  const allValid = rules.every((r) => r.ok) && currentPassword.length > 0;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!allValid) return;
    setSubmitting(true);
    try {
      await changePasswordApi({ current_password: currentPassword, new_password: newPassword });
      toast.success('Password changed successfully');
      await refreshProfile();
      if (onClose) onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h2 className="mb-1 text-lg font-semibold text-gray-900">
          {forced ? 'Set a New Password' : 'Change Password'}
        </h2>
        <p className="mb-4 text-sm text-gray-500">
          {forced
            ? 'You\'re using a temporary password. Please set a new password to continue.'
            : 'Enter your current password and a new one.'}
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              autoFocus
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Confirm New Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full rounded-lg border px-3 py-2 text-sm outline-none focus:border-primary-500"
            />
          </div>

          <ul className="space-y-1 rounded-lg bg-gray-50 p-3 text-xs">
            {rules.map((r) => (
              <li key={r.label} className={r.ok ? 'text-green-700' : 'text-gray-500'}>
                {r.ok ? '✓' : '○'} {r.label}
              </li>
            ))}
          </ul>

          <div className="flex justify-end gap-3 pt-2">
            {!forced && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            )}
            <button
              type="submit"
              disabled={!allValid || submitting}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Change Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
