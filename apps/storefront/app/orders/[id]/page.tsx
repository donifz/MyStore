import OrderDetailClient from './OrderDetailClient';
import { metadata } from '../../../lib/seo';

export const dynamic = 'force-dynamic';
export const generateMetadata = () =>
  metadata(
    'Статус заказа — MyStore',
    'Отслеживание статуса заказа.',
    '/orders',
    true,
  );

export default async function OrderStatusPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <OrderDetailClient id={id} />;
}
