import { Navigate } from 'react-router-dom';
import { useAuthContext } from '../lib/AuthContext.jsx';
import SessionCheckSkeleton from './SessionCheckSkeleton.jsx';

// WHAT: Guards pages that need a signed-in user.
// WHY wait on `restoring`: a user can be signed in while their status is still
// 'anon' (a cookie exists but no local hint). Redirecting immediately would
// wrongly send them to the sign-in page, so we hold on the skeleton until the
// first restore attempt has settled.
export default function RequireAuth({ children }) {
  const { status, restoring } = useAuthContext();

  if (status === 'checking' || (status === 'anon' && restoring)) return <SessionCheckSkeleton />;
  if (status === 'anon') return <Navigate to="/sign-in" replace />;
  return children;
}
