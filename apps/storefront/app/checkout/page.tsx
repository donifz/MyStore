import Checkout from '../../components/Checkout';
import { metadata } from '../../lib/seo';

export const dynamic = 'force-dynamic';
export const generateMetadata = () =>
  metadata(
    'Оформление заказа — MyStore',
    'Оформите заказ в магазине.',
    '/checkout',
    true,
  );

export default function CheckoutPage() {
  return <Checkout initialStep="checkout" />;
}
