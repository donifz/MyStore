import PartnerForm from '../../components/PartnerForm';
import { metadata } from '../../lib/seo';
export const dynamic = 'force-dynamic';
export function generateMetadata() {
  return metadata(
    'Стать партнёром — MyStore',
    'Касса, учёт и онлайн-витрина магазина: 30 дней бесплатно без привязки карты.',
    '/partner',
    true,
  );
}
export default function Partner() {
  return <PartnerForm />;
}
