import { notFound, permanentRedirect } from 'next/navigation';
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
      '/shop/' + s.slug,
      Object.keys(await searchParams).length > 0,
    );
  } catch (e) {
    if (e instanceof PublicApiError && e.status === 404) notFound();
    return metadata(
      'Магазин временно недоступен — MyStore',
      'Попробуйте позднее.',
      '/shop/' + slug,
      true,
    );
  }
}

export default async function StorePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const search = await searchParams;
  let store: Store;
  try {
    store = await publicApi<Store>('/stores/' + encodeURIComponent(slug));
  } catch (error) {
    if (error instanceof PublicApiError && error.status === 404) notFound();
    throw error;
  }
  if (store.slug !== slug) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(search)) {
      if (Array.isArray(value))
        value.forEach((item) => query.append(key, item));
      else if (value !== undefined) query.set(key, value);
    }
    permanentRedirect(
      `/shop/${encodeURIComponent(store.slug)}${query.size ? `?${query}` : ''}`,
    );
  }
  return <Catalog slug={slug} search={search} />;
}
