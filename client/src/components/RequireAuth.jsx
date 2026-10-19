import { Navigate } from 'react-router-dom';
import { useAuthContext } from '../lib/AuthContext.jsx';

export default function RequireAuth({ children }) {
  const { status } = useAuthContext();

  if (status === 'checking') {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Checking your session">
        <div className="skeleton h-8 w-48" />
        <div className="skeleton h-24 w-full" />
        <div className="skeleton h-24 w-full" />
      </div>
    );
  }
  if (status === 'anon') return <Navigate to="/sign-in" replace />;
  return children;
}
