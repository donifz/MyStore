import { Suspense } from 'react';
import PartnerActivation from '../../../components/PartnerActivation';
import { metadata } from '../../../lib/seo';
export const dynamic = 'force-dynamic';
export function generateMetadata() {
  return metadata(
    'Активация магазина — MyStore',
    'Активация кабинета партнёра.',
    '/partner/activate',
    true,
  );
}
export default function ActivatePage() {
  return (
    <Suspense fallback={<p>Загрузка…</p>}>
      <PartnerActivation />
    </Suspense>
  );
}
