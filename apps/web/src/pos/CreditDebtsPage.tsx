import ShopCustomersPage from '../customers/ShopCustomersPage';

/**
 * Customers and Debts are unified in the CRM hub.
 * Direct visits to /debts open the unified hub with the "debt" filter active.
 */
export default function CreditDebtsPage() {
  return <ShopCustomersPage initialTab="debt" />;
}
