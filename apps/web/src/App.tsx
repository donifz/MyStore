import { Routes, Route, Link } from 'react-router-dom';
import { SessionProvider } from './auth/SessionProvider';
import LoginPage from './auth/LoginPage';
import SellerLayout, { ShopSelect } from './layout/SellerLayout';
import CatalogPage from './catalog/CatalogPage';
import CreateVariantPage from './catalog/CreateVariantPage';
import SalePage from './pos/SalePage';
import ReceivingPage from './receiving/ReceivingPage';
import ShiftPage from './pos/ShiftPage';
import SalesHistoryPage from './pos/SalesHistoryPage';
import ReturnPage from './pos/ReturnPage';
import SaleDetailPage from './pos/SaleDetailPage';
export default function App() {
  return (
    <SessionProvider>
      <Routes>
        <Route
          path="/"
          element={
            <main className="chooser">
              <h1>MyStore</h1>
              <p>Магазины, товары и общие остатки</p>
              <Link to="/seller">Войти для продавцов</Link>
            </main>
          }
        />
        <Route path="/seller/login" element={<LoginPage />} />
        <Route path="/seller" element={<ShopSelect />} />
        <Route path="/seller/:shopId" element={<SellerLayout />}>
          <Route path="shift" element={<ShiftPage />} />
          <Route path="sales" element={<SalesHistoryPage />} />
          <Route path="sales/:saleId" element={<SaleDetailPage />} />
          <Route path="sales/:saleId/return" element={<ReturnPage />} />
          <Route path="pos" element={<SalePage />} />
          <Route path="receiving" element={<ReceivingPage />} />
          <Route path="products" element={<CatalogPage />} />
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
