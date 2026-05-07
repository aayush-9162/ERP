import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useAuth } from '../../contexts/AuthContext';
import ChangePasswordModal from '../common/ChangePasswordModal';

export default function DashboardLayout() {
  const { user } = useAuth();
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
        <Outlet />
      </main>
      {user?.must_change_password && <ChangePasswordModal forced />}
    </div>
  );
}
