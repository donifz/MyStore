import { useEffect } from 'react';
import { Navigate, Outlet, useParams } from 'react-router-dom';
import { useSession } from '../auth/SessionProvider';
import WorkspaceShell from './WorkspaceShell';
import { shopStart } from './workspace-navigation';
export function ShopHome() {
  const { shopId } = useParams(),
    session = useSession();
  const shop = session.user?.shops.find((s) => s.id === shopId);
  return shop ? <Navigate to={shopStart(shop)} replace /> : null;
}
export default function SellerLayout() {
  const session = useSession(),
    { shopId } = useParams();
  const shop = session.user?.shops.find((s) => s.id === shopId);
  useEffect(() => {
    if (shop) session.selectShop(shop.id);
  }, [shop?.id]);
  return (
    <WorkspaceShell>
      <Outlet />
    </WorkspaceShell>
  );
}
