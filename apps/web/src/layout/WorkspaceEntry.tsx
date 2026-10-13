import { Navigate, useLocation } from 'react-router-dom';
import { useSession } from '../auth/SessionProvider';
import WorkspaceShell from './WorkspaceShell';
import PartnerDashboard from './PartnerDashboard';
import { workspaceStart } from './workspace-navigation';
export default function WorkspaceEntry() {
  const session = useSession(),
    location = useLocation();
  if (session.loading)
    return (
      <p role="status" className="loading">
        Загрузка…
      </p>
    );
  if (!session.user)
    return (
      <Navigate
        to="/seller/login"
        replace
        state={{ from: location.pathname + location.search + location.hash }}
      />
    );
  const user = session.user,
    explicit = new URLSearchParams(location.search).get('view') === 'shops';
  if (location.hash === '#partner-shops')
    return (
      <Navigate
        to={user.shops.length > 1 ? '/seller?view=shops' : workspaceStart(user)}
        replace
      />
    );
  if (!explicit) return <Navigate to={workspaceStart(user)} replace />;
  if (user.shops.length === 1)
    return <Navigate to={workspaceStart(user)} replace />;
  return (
    <WorkspaceShell>
      <PartnerDashboard />
    </WorkspaceShell>
  );
}
