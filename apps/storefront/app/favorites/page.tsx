import Favorites from '../../components/storefront/Favorites';
export const metadata = {
  title: 'Избранное — MyStore',
  robots: { index: false, follow: false },
};
export default function Page() {
  return <Favorites />;
}
