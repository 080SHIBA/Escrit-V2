import { useEffect, useRef, useState } from 'react';

let initializedClientId = null;
let activeButtonHandlers = null;

// "Continue with Google". Google Identity Services (loaded in index.html)
// returns a signed ID token in the browser and the API verifies it, so no
// password or client secret is involved. Google's own button is rendered
// (required by their branding rules); missing configuration is reported.
export default function GoogleSignInButton({ onCredential, onError, disabled = false }) {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const containerRef = useRef(null);
  const handlersRef = useRef({ onCredential, onError });
  const [ready, setReady] = useState(false);
  const [setupError, setSetupError] = useState('');

  handlersRef.current = { onCredential, onError };

  useEffect(() => {
    if (!clientId) {
      setSetupError('Google sign-in is not configured for this site.');
      return undefined;
    }

    let cancelled = false;
    let attempts = 0;
    let timer;
    // The Google script loads async, so wait for it if it is not ready yet.
    function trySetup() {
      if (cancelled) return;
      if (!window.google?.accounts?.id) {
        attempts += 1;
        if (attempts >= 50) {
          const message = 'Google sign-in could not load. Check your connection and try again.';
          setSetupError(message);
          handlersRef.current.onError?.(message);
          return;
        }
        timer = window.setTimeout(trySetup, 100);
        return;
      }
      activeButtonHandlers = handlersRef;
      if (initializedClientId !== clientId) {
        try {
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: (response) => {
              const handlers = activeButtonHandlers?.current;
              if (response?.credential) handlers?.onCredential(response.credential);
              else handlers?.onError?.('Google did not return a credential. Please try again.');
            },
          });
          initializedClientId = clientId;
        } catch {
          const message = 'Google sign-in could not start. Please try again.';
          setSetupError(message);
          handlersRef.current.onError?.(message);
          return;
        }
      }
      if (containerRef.current) {
        window.google.accounts.id.renderButton(containerRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text: 'continue_with',
          width: Math.min(containerRef.current.offsetWidth || 400, 400),
        });
      }
      setReady(true);
    }
    trySetup();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      if (activeButtonHandlers === handlersRef) activeButtonHandlers = null;
    };
  }, [clientId]);

  if (!clientId) {
    return <p className="auth-error" role="status">{setupError}</p>;
  }

  return (
    <div className={`w-full flex justify-center ${disabled ? 'pointer-events-none opacity-60' : ''}`} aria-busy={disabled}>
      {/* Google sizes its button from this box at mount, so it needs a real width. */}
      <div ref={containerRef} className={ready ? '' : 'h-10'} style={{ width: '100%', maxWidth: 400 }} />
      {setupError && <p className="auth-error" role="alert">{setupError}</p>}
    </div>
  );
}
