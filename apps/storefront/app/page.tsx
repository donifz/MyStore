import Catalog from '../components/Catalog';
import { Search } from '../lib/public-api';
import { metadata } from '../lib/seo';
export const dynamic = 'force-dynamic';
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  return metadata(
    'Товары местных магазинов — MyStore',
    'Товары магазинов Кыргызстана: цены, актуальное наличие и контакты продавцов.',
    '/',
    Object.keys(await searchParams).length > 0,
  );
}
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  return <Catalog search={await searchParams} />;
}
