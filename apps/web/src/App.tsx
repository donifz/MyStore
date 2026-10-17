import StaffPage from './staff/StaffPage';
import StaffActivationPage from './auth/StaffActivationPage';
import ForgotPasswordPage from './auth/ForgotPasswordPage';
import ResetPasswordPage from './auth/ResetPasswordPage';
import CapturePage from './catalog/CapturePage';
import CategoriesPage from './catalog/CategoriesPage';
import OrdersPage from './orders/OrdersPage';
import { Routes, Route } from 'react-router-dom';
import { SessionProvider } from './auth/SessionProvider';
import LoginPage from './auth/LoginPage';
import SellerLayout, { ShopHome } from './layout/SellerLayout';
import WorkspaceEntry from './layout/WorkspaceEntry';
import CatalogPage from './catalog/CatalogPage';
import CreateVariantPage from './catalog/CreateVariantPage';
import SalePage from './pos/SalePage';
import ReceivingPage from './receiving/ReceivingPage';
import ShiftPage from './pos/ShiftPage';
import SalesHistoryPage from './pos/SalesHistoryPage';
import ReturnPage from './pos/ReturnPage';
import SaleDetailPage from './pos/SaleDetailPage';
import PublicLayout from './storefront/PublicLayout';
import CatalogPublicPage from './storefront/CatalogPublicPage';
import StoresPage from './storefront/StoresPage';
import ProductPage from './storefront/ProductPage';
import PartnerPage from './storefront/PartnerPage';
import StorefrontSettingsPage from './storefront/StorefrontSettingsPage';
import EditVariantPage from './catalog/EditVariantPage';
import BarcodeLabelsPage from './catalog/BarcodeLabelsPage';
import AdminPage from './platform/AdminPage';
import StockOperationsPage from './inventory/StockOperationsPage';
import ReportsPage from './reports/ReportsPage';
import OperationsPage from './operations/OperationsPage';
import PlatformAccessPage from './platform/PlatformAccessPage';
export default function App() {
  return (
    <SessionProvider>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<CatalogPublicPage />} />
          <Route path="/shops" element={<StoresPage />} />
          <Route path="/shops/:slug" element={<CatalogPublicPage />} />
          <Route path="/shops/:slug/products/:id" element={<ProductPage />} />
          <Route path="/partner" element={<PartnerPage />} />
        </Route>
        <Route path="/seller/staff/accept" element={<StaffActivationPage />} />
        <Route
          path="/seller/forgot-password"
          element={<ForgotPasswordPage />}
        />
        <Route path="/seller/reset-password" element={<ResetPasswordPage />} />
        <Route path="/seller/login" element={<LoginPage />} />
        <Route path="/platform/admin" element={<AdminPage />} />
        <Route path="/seller" element={<WorkspaceEntry />} />
        <Route path="/seller/:shopId" element={<SellerLayout />}>
          <Route index element={<ShopHome />} />
          <Route path="staff" element={<StaffPage />} />
          <Route path="platform-access" element={<PlatformAccessPage />} />
          <Route path="storefront" element={<StorefrontSettingsPage />} />
          <Route path="products/:id/edit" element={<EditVariantPage />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="orders/:id" element={<OrdersPage />} />
          <Route path="shift" element={<ShiftPage />} />
          <Route path="sales" element={<SalesHistoryPage />} />
          <Route path="sales/:saleId" element={<SaleDetailPage />} />
          <Route path="sales/:saleId/return" element={<ReturnPage />} />
          <Route path="pos" element={<SalePage />} />
          <Route path="receiving" element={<ReceivingPage />} />
          <Route path="inventory" element={<StockOperationsPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="operations" element={<OperationsPage />} />
          <Route path="products" element={<CatalogPage />} />
          <Route path="products/capture" element={<CapturePage />} />
          <Route path="labels" element={<BarcodeLabelsPage />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="products/new" element={<CreateVariantPage />} />
        </Route>
        <Route
          path="*"
          element={<p className="loading">Страница не найдена</p>}
        />
      </Routes>
    </SessionProvider>
  );
}
