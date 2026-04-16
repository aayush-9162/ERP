import { useState, useEffect } from 'react';
import { getOptions } from '../../api/admin.api';
import { useAuth } from '../../contexts/AuthContext';

export default function SettingsPage() {
  const { user } = useAuth();
  const [options, setOptions] = useState({ countries: [], plans: [] });

  useEffect(() => {
    getOptions().then((res) => setOptions(res.data.data)).catch(() => {});
  }, []);

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Settings</h1>
        <p className="text-sm text-gray-500">Platform configuration</p>
      </div>

      {/* Admin Profile */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Super Admin Profile</h2>
        <div className="grid grid-cols-2 gap-y-3 text-sm">
          <p className="text-gray-500">Name</p><p className="font-medium">{user?.first_name} {user?.last_name}</p>
          <p className="text-gray-500">Email</p><p className="font-medium">{user?.email}</p>
          <p className="text-gray-500">Role</p><p className="font-medium">Super Admin</p>
        </div>
      </div>

      {/* Supported Countries */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Supported Countries</h2>
        <div className="space-y-3">
          {options.countries.map((c) => (
            <div key={c.code} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm font-medium">{c.name}</p>
                <p className="text-xs text-gray-400">{c.taxSystem}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium">{c.currency}</p>
                <p className="text-xs text-gray-400">{c.code}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Plan Tiers */}
      <div className="bg-white rounded-xl shadow-sm p-5">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Plan Tiers</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {options.plans.map((p) => (
            <div key={p.value} className="border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-800">{p.label}</h3>
              <div className="mt-2 text-sm text-gray-500 space-y-1">
                <p>Up to {p.users} users</p>
                <p>Up to {p.companies} companies</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
