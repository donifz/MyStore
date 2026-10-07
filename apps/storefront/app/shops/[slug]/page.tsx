import { notFound } from 'next/navigation';
import Catalog from '../../../components/Catalog';
import {
  publicApi,
  PublicApiError,
  Store,
  Search,
} from '../../../lib/public-api';
import { metadata } from '../../../lib/seo';
export const dynamic = 'force-dynamic';
type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Search>;
};
export async function generateMetadata({ params, searchParams }: Props) {
  const { slug } = await params;
  try {
    const s = await publicApi<Store>('/stores/' + encodeURIComponent(slug));
    return metadata(
      s.name + ' — MyStore',
      s.description || `Каталог магазина ${s.name}, ${s.city}. Цены и наличие.`,
      '/shops/' + slug,
      Object.keys(await searchParams).length > 0,
    );
  } catch (e) {
    if (e instanceof PublicApiError && e.status === 404) notFound();
    return metadata(
      'Магазин временно недоступен — MyStore',
      'Попробуйте позднее.',
      '/shops/' + slug,
      true,
    );
  }
}
export default async function StorePage({ params, searchParams }: Props) {
  return <Catalog slug={(await params).slug} search={await searchParams} />;
}
