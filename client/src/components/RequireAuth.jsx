import { Navigate, useLocation } from 'react-router-dom';
import { useAuthContext } from '../lib/AuthContext.jsx';
import SessionCheckSkeleton from './SessionCheckSkeleton.jsx';

// WHAT: Guards pages that need a signed-in user.
// WHY wait on `restoring`: a user can be signed in while their status is still
// 'anon' (a cookie exists but no local hint). Redirecting immediately would
// wrongly send them to the sign-in page, so we hold on the skeleton until the
// first restore attempt has settled.
export default function RequireAuth({ children }) {
  const { status, restoring } = useAuthContext();
  const location = useLocation();

  if (status === 'checking' || (status === 'anon' && restoring)) return <SessionCheckSkeleton />;
  // WHY ?next=: after signing in, the person returns to the page they asked for (a receipt link, for
  // example) instead of landing on the marketplace and having to find it again.
  if (status === 'anon') return <Navigate to={`/sign-in?next=${encodeURIComponent(`${location.pathname}${location.search}`)}`} replace />;
  return children;
}
