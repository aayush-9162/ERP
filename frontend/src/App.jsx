import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/common/ProtectedRoute';
import DashboardLayout from './components/layout/DashboardLayout';
import LoginPage from './pages/auth/LoginPage';
import DashboardPage from './pages/dashboard/DashboardPage';
import UsersPage from './pages/users/UsersPage';
import CompanyPage from './pages/company/CompanyPage';
import InventoryDashboardPage from './pages/inventory/InventoryDashboardPage';
import ProductsPage from './pages/inventory/ProductsPage';
import StockAdjustmentPage from './pages/inventory/StockAdjustmentPage';
import POSPage from './pages/sales/POSPage';
import SalesListPage from './pages/sales/SalesListPage';
import InvoicePage from './pages/sales/InvoicePage';
import CustomersPage from './pages/customers/CustomersPage';
import PurchaseEntryPage from './pages/purchases/PurchaseEntryPage';
import PurchasesListPage from './pages/purchases/PurchasesListPage';
import PurchaseViewPage from './pages/purchases/PurchaseViewPage';
import SuppliersPage from './pages/suppliers/SuppliersPage';
import ReportsDashboard from './pages/reports/ReportsDashboard';
import ProfitLossPage from './pages/reports/ProfitLossPage';
import InventoryReportPage from './pages/reports/InventoryReportPage';
import CustomerLedgerPage from './pages/reports/CustomerLedgerPage';
import AccountsPage from './pages/reports/AccountsPage';
import GSTReportsPage from './pages/reports/GSTReportsPage';
import QuotationsListPage from './pages/quotations/QuotationsListPage';
import QuotationCreatePage from './pages/quotations/QuotationCreatePage';
import QuotationViewPage from './pages/quotations/QuotationViewPage';
import CompaniesPage from './pages/companies/CompaniesPage';
import TeamPage from './pages/companies/TeamPage';
import SettingsPage from './pages/settings/SettingsPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster position="top-right" />
        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
            <Route path="/companies" element={<CompaniesPage />} />
            <Route path="/team" element={<ProtectedRoute roles={['admin']}><TeamPage /></ProtectedRoute>} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/users" element={<ProtectedRoute roles={['admin', 'manager']}><UsersPage /></ProtectedRoute>} />
            <Route path="/company" element={<CompanyPage />} />

            <Route path="/inventory" element={<InventoryDashboardPage />} />
            <Route path="/inventory/products" element={<ProductsPage />} />
            <Route path="/inventory/stock" element={<ProtectedRoute roles={['admin', 'manager']}><StockAdjustmentPage /></ProtectedRoute>} />

            <Route path="/pos" element={<POSPage />} />
            <Route path="/sales" element={<SalesListPage />} />
            <Route path="/sales/:id" element={<InvoicePage />} />
            <Route path="/customers" element={<CustomersPage />} />

            <Route path="/quotations" element={<QuotationsListPage />} />
            <Route path="/quotations/new" element={<QuotationCreatePage />} />
            <Route path="/quotations/:id" element={<QuotationViewPage />} />

            <Route path="/purchases/new" element={<PurchaseEntryPage />} />
            <Route path="/purchases" element={<PurchasesListPage />} />
            <Route path="/purchases/:id" element={<PurchaseViewPage />} />
            <Route path="/suppliers" element={<SuppliersPage />} />

            <Route path="/reports" element={<ProtectedRoute roles={['admin', 'manager']}><ReportsDashboard /></ProtectedRoute>} />
            <Route path="/reports/profit-loss" element={<ProtectedRoute roles={['admin', 'manager']}><ProfitLossPage /></ProtectedRoute>} />
            <Route path="/reports/inventory" element={<ProtectedRoute roles={['admin', 'manager']}><InventoryReportPage /></ProtectedRoute>} />
            <Route path="/reports/customers" element={<ProtectedRoute roles={['admin', 'manager']}><CustomerLedgerPage /></ProtectedRoute>} />
            <Route path="/reports/gst" element={<ProtectedRoute roles={['admin', 'manager']}><GSTReportsPage /></ProtectedRoute>} />
            <Route path="/reports/accounts" element={<ProtectedRoute roles={['admin', 'manager']}><AccountsPage /></ProtectedRoute>} />
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
