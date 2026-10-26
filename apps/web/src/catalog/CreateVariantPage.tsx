import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import { useSession } from '../auth/SessionProvider';

export default function CreateVariantPage() {
  const { shopId } = useParams();
  const session = useSession();
  const [searchParams] = useSearchParams();
  const shop = session.user?.shops.find((item) => item.id === shopId);
  if (!shop || shop.role === 'cashier')
    return <p role="alert">Недостаточно прав для создания товара.</p>;

  const params = new URLSearchParams({ create: '1' });
  const parentId = searchParams.get('parentId');
  if (parentId) params.set('parentId', parentId);
  const target = `/seller/${shopId}/receiving?${params.toString()}`;
  return <Navigate replace to={target} />;
}
