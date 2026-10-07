import PartnerForm from '../../components/PartnerForm';
import { metadata } from '../../lib/seo';
export const dynamic = 'force-dynamic';
export function generateMetadata() {
  return metadata(
    'Стать партнёром — MyStore',
    'Создайте магазин и опубликуйте витрину.',
    '/partner',
    true,
  );
}
export default function Partner() {
  return <PartnerForm />;
}
