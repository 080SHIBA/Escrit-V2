import GoogleSignInButton from '../GoogleSignInButton.jsx';

export default function GoogleButton({ onClick, onError, loading }) {
  return (
    <div className="auth-google" aria-busy={loading}>
      <GoogleSignInButton onCredential={onClick} onError={onError} disabled={loading} />
      {loading && <span className="auth-helper" role="status">Connecting to Google…</span>}
    </div>
  );
}
