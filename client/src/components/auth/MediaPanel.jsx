import { useEffect, useRef, useState } from 'react';

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function MediaPanel({ videoSrc }) {
  const videoRef = useRef(null);
  const [paused, setPaused] = useState(prefersReducedMotion);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const respectMotionPreference = (event) => {
      if (!event.matches) return;
      videoRef.current?.pause();
      setPaused(true);
    };

    if (mediaQuery.matches) videoRef.current?.pause();
    mediaQuery.addEventListener('change', respectMotionPreference);
    return () => mediaQuery.removeEventListener('change', respectMotionPreference);
  }, []);

  return (
    <aside className="auth-media" aria-label="Escrit marketplace">
      {!failed ? (
        <video
          ref={videoRef}
          autoPlay={!paused}
          muted
          loop
          playsInline
          preload="metadata"
          onPlay={() => setPaused(false)}
          onPause={() => setPaused(true)}
          onError={() => setFailed(true)}
        >
          <source src={videoSrc} type="video/mp4" />
        </video>
      ) : (
        <div className={`auth-collage ${paused ? 'is-paused' : ''}`} aria-hidden="true">
          {['Handmade ceramics', 'Studio headphones', 'Design consultation', 'Leather travel bag'].map((card, index) => (
            <div className={`auth-listing-card card-${index}`} key={card}>
              <span className="auth-card-art" />
              <strong>{card}</strong>
              <small>Protected with Escrit</small>
            </div>
          ))}
        </div>
      )}
      <div className="auth-media-copy">
        <strong>Buy, sell and get paid safely.</strong>
        <span>Escrow is available when offered; buyers can choose based on the listing.</span>
      </div>
    </aside>
  );
}
