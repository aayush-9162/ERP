import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { HiOutlineHome, HiOutlineOfficeBuilding, HiOutlineUsers, HiOutlineCog, HiOutlineLogout } from 'react-icons/hi';

const navItems = [
  { to: '/', icon: HiOutlineHome, label: 'Dashboard' },
  { to: '/tenants', icon: HiOutlineOfficeBuilding, label: 'Tenants' },
  { to: '/users', icon: HiOutlineUsers, label: 'Users' },
  { to: '/settings', icon: HiOutlineCog, label: 'Settings' },
];

export default function Sidebar() {
  const { user, logout } = useAuth();

  return (
    <aside className="w-64 bg-gray-900 text-white min-h-screen flex flex-col">
      <div className="p-4 border-b border-gray-700">
        <h1 className="text-xl font-bold">ERP Admin</h1>
        <p className="text-xs text-gray-400 mt-1">SaaS Management Panel</p>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`
            }
          >
            <Icon className="w-5 h-5" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-700">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-sm font-bold">
            {user?.first_name?.[0] || 'S'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.first_name} {user?.last_name}</p>
            <p className="text-xs text-gray-400 truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-red-400 transition-colors w-full"
        >
          <HiOutlineLogout className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
