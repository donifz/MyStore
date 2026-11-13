import Catalog from '../components/Catalog';
import { Search } from '../lib/public-api';
import { metadata, websiteJson, organizationJson } from '../lib/seo';

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
    {
      noindex: Object.keys(await searchParams).length > 0,
      image: '/osh-hero.webp',
    },
  );
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Search>;
}) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: websiteJson() }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: organizationJson() }}
      />
      <Catalog search={await searchParams} />
    </>
  );
}
