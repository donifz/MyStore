import Checkout from '../../components/Checkout';
import { metadata } from '../../lib/seo';
export const dynamic = 'force-dynamic';
export const generateMetadata = () =>
  metadata('Корзина — MyStore', 'Оформите заказ в магазине.', '/cart', true);
export default function CartPage() {
  return <Checkout />;
}
