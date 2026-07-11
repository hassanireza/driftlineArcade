import { useEffect, useState } from 'react';
import styles from './OrientationGate.module.css';

function isSmallTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const narrow = Math.min(window.innerWidth, window.innerHeight) <= 900;
  return coarse && narrow;
}

function isPortrait(): boolean {
  if (typeof window === 'undefined') return false;
  return window.innerHeight > window.innerWidth;
}

/**
 * These arcade games are designed for a wide, landscape stage. On phones and
 * small tablets we ask the player to rotate rather than squeezing (and
 * distorting) the play field into a portrait strip.
 */
export function OrientationGate({ gameName }: { gameName: string }) {
  const [show, setShow] = useState(() => isSmallTouchDevice() && isPortrait());

  useEffect(() => {
    const update = () => setShow(isSmallTouchDevice() && isPortrait());
    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  if (!show) return null;

  return (
    <div className={styles.gate} role="alert">
      <div className={styles.phone} aria-hidden="true">
        <span className={styles.phoneBody} />
      </div>
      <p className={styles.title}>Turn your device</p>
      <p className={styles.copy}>{gameName} plays best full-width, landscape. Rotate your phone to begin.</p>
    </div>
  );
}
