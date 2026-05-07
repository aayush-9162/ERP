import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  HiOutlineHome, HiOutlineUsers, HiOutlineOfficeBuilding,
  HiOutlineCube, HiOutlineClipboardList, HiOutlineSwitchHorizontal,
  HiOutlineShoppingCart, HiOutlineDocumentText, HiOutlineUserGroup,
  HiOutlineTruck, HiOutlineClipboardCheck, HiOutlineLibrary,
  HiOutlineChartBar, HiOutlineCash, HiOutlineCalculator, HiOutlineDocumentReport,
  HiOutlineDocumentDuplicate, HiOutlineReceiptTax, HiOutlineSelector,
  HiOutlineCog,
} from 'react-icons/hi';

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: HiOutlineHome, roles: ['admin', 'manager'] },
  { to: '/team', label: 'Team', icon: HiOutlineUsers, roles: ['admin', 'manager'] },
  { to: '/company', label: 'Company Profile', icon: HiOutlineOfficeBuilding, roles: ['admin', 'manager'] },
  { type: 'divider', label: 'Inventory' },
  { to: '/inventory', label: 'Overview', icon: HiOutlineClipboardList },
  { to: '/inventory/products', label: 'Products', icon: HiOutlineCube },
  { to: '/inventory/stock', label: 'Stock Adjustment', icon: HiOutlineSwitchHorizontal, roles: ['admin', 'manager'] },
  { type: 'divider', label: 'Sales' },
  { to: '/pos', label: 'POS / Billing', icon: HiOutlineShoppingCart },
  { to: '/sales', label: 'Sales List', icon: HiOutlineDocumentText },
  { to: '/quotations', label: 'Quotations', icon: HiOutlineDocumentDuplicate },
  { to: '/customers', label: 'Customers', icon: HiOutlineUserGroup },
  { type: 'divider', label: 'Purchases' },
  { to: '/purchases/new', label: 'New Purchase', icon: HiOutlineTruck },
  { to: '/purchases', label: 'Purchase List', icon: HiOutlineClipboardCheck },
  { to: '/suppliers', label: 'Suppliers', icon: HiOutlineLibrary },
  { type: 'divider', label: 'Reports & Finance' },
  { to: '/reports', label: 'Overview', icon: HiOutlineChartBar, roles: ['admin', 'manager'] },
  { to: '/reports/profit-loss', label: 'Profit & Loss', icon: HiOutlineCash, roles: ['admin', 'manager'] },
  { to: '/reports/inventory', label: 'Stock Valuation', icon: HiOutlineDocumentReport, roles: ['admin', 'manager'] },
  { to: '/reports/customers', label: 'Customer Ledger', icon: HiOutlineUserGroup, roles: ['admin', 'manager'] },
  { to: '/reports/gst', label: 'GST Returns', icon: HiOutlineReceiptTax, roles: ['admin', 'manager'] },
  { to: '/reports/accounts', label: 'Accounts', icon: HiOutlineCalculator, roles: ['admin', 'manager'] },
  { type: 'divider', label: 'System' },
  { to: '/settings', label: 'Settings', icon: HiOutlineCog },
];

export default function Sidebar() {
  const { user, companies, activeCompany, switchCompany } = useAuth();
  const [showCompanyMenu, setShowCompanyMenu] = useState(false);

  const linkClass = ({ isActive }) =>
    `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${isActive ? 'bg-primary-600 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'}`;

  return (
    <aside className="flex h-screen w-64 flex-col bg-gray-900 text-white print:hidden">
      {/* Company switcher */}
      <div className="border-b border-gray-700 px-3 py-3">
        <div className="relative">
          <button
            onClick={() => setShowCompanyMenu(!showCompanyMenu)}
            className="flex w-full items-center justify-between rounded-lg bg-gray-800 px-3 py-2.5 text-left hover:bg-gray-750 transition-colors"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{activeCompany?.name || 'Select Company'}</p>
              <p className="truncate text-[10px] text-gray-400">{activeCompany?.role ? `Role: ${activeCompany.role}` : 'No company'}</p>
            </div>
            <HiOutlineSelector className="h-5 w-5 flex-shrink-0 text-gray-400" />
          </button>

          {showCompanyMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowCompanyMenu(false)} />
              <div className="absolute left-0 right-0 z-50 mt-1 rounded-lg bg-gray-800 py-1 shadow-xl ring-1 ring-gray-700">
                {companies.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => { switchCompany(c); setShowCompanyMenu(false); }}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-700 ${activeCompany?.id === c.id ? 'bg-gray-700 text-primary-400' : 'text-gray-300'}`}
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded bg-primary-600 text-xs font-bold">{c.name?.[0]}</div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{c.name}</p>
                      <p className="text-[10px] text-gray-500">{c.role}</p>
                    </div>
                  </button>
                ))}
                <div className="border-t border-gray-700 mt-1 pt-1">
                  <NavLink to="/companies" onClick={() => setShowCompanyMenu(false)}
                    className="flex items-center gap-2 px-3 py-2 text-xs text-gray-400 hover:text-white hover:bg-gray-700">
                    <HiOutlineCog className="h-4 w-4" /> Manage Companies
                  </NavLink>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {(() => {
          const role = activeCompany?.role || user?.role?.name;
          const visible = navItems.filter((i) => !i.roles || i.roles.includes(role));
          // Drop any divider that has no real nav item before the next divider
          const cleaned = visible.filter((item, idx) => {
            if (item.type !== 'divider') return true;
            for (let i = idx + 1; i < visible.length; i++) {
              if (visible[i].type === 'divider') return false;
              return true;
            }
            return false;
          });
          return cleaned.map((item, idx) =>
            item.type === 'divider' ? (
              <div key={idx} className="pb-1 pt-4"><p className="px-3 text-[10px] font-bold uppercase tracking-wider text-gray-500">{item.label}</p></div>
            ) : (
              <NavLink key={item.to} to={item.to} end={['/inventory', '/purchases', '/reports', '/quotations'].includes(item.to)} className={linkClass}>
                <item.icon className="h-5 w-5 flex-shrink-0" />{item.label}
              </NavLink>
            )
          );
        })()}
      </nav>

    </aside>
  );
}
