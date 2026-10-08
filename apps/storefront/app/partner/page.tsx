import PartnerForm from '../../components/PartnerForm';
import { metadata } from '../../lib/seo';
export const dynamic = 'force-dynamic';
export function generateMetadata() {
  return metadata(
    'Стать партнёром — MyStore',
    'Отправьте заявку на подключение магазина к MyStore.',
    '/partner',
    true,
  );
}
export default function Partner() {
  return <PartnerForm />;
}
