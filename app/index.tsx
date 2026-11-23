import { Redirect } from 'expo-router';

import { getHomeRoute } from '@/presentation/navigation/role-routes';
import { useSession } from '@/presentation/session/SessionProvider';

export default function Index() {
  const session = useSession();

  return <Redirect href={getHomeRoute(session)} />;
}
