import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { HiOutlineMenu } from 'react-icons/hi';
import Sidebar from './Sidebar';
import { useAuth } from '../../contexts/AuthContext';
import ChangePasswordModal from '../common/ChangePasswordModal';

export default function DashboardLayout() {
  const { user } = useAuth();
  // Persist sidebar visibility so it survives reloads
  const [sidebarOpen, setSidebarOpen] = useState(
    () => localStorage.getItem('sidebarOpen') !== 'false'
  );

  function toggleSidebar() {
    setSidebarOpen((v) => {
      const next = !v;
      localStorage.setItem('sidebarOpen', String(next));
      return next;
    });
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {sidebarOpen && <Sidebar onClose={toggleSidebar} />}
      <main className={`relative flex-1 overflow-y-auto bg-gray-50 py-6 pr-6 ${sidebarOpen ? 'pl-6' : 'pl-16'}`}>
        {!sidebarOpen && (
          <button
            onClick={toggleSidebar}
            title="Show sidebar"
            className="fixed left-3 top-3 z-30 flex h-9 w-9 items-center justify-center rounded-lg bg-white text-gray-700 shadow ring-1 ring-gray-200 hover:bg-gray-50 print:hidden"
          >
            <HiOutlineMenu className="h-5 w-5" />
          </button>
        )}
        <Outlet />
      </main>
      {user?.must_change_password && <ChangePasswordModal forced />}
    </div>
  );
}
