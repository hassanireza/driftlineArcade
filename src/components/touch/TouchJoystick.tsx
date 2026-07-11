import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './TouchControls.module.css';

export interface TouchJoystickProps {
  /** Called continuously with a normalized -1..1 vector while the stick is held. */
  onChange: (x: number, y: number, active: boolean) => void;
  label?: string;
  /** Radius in px the thumb can travel from center. */
  radius?: number;
}

/**
 * A GTA-mobile-style floating analog joystick. The base is anchored where the
 * finger first touches down (within the widget's hit area), and the thumb is
 * clamped to `radius` px from that origin. Pure pointer events, no deps.
 */
export function TouchJoystick({ onChange, label = 'Move', radius = 46 }: TouchJoystickProps) {
  const zoneRef = useRef<HTMLDivElement | null>(null);
  const activePointerId = useRef<number | null>(null);
  const originRef = useRef({ x: 0, y: 0 });
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);
  const [thumb, setThumb] = useState({ x: 0, y: 0 });

  const reset = useCallback(() => {
    activePointerId.current = null;
    setOrigin(null);
    setThumb({ x: 0, y: 0 });
    onChange(0, 0, false);
  }, [onChange]);

  const handlePointerDown = useCallback((event: React.PointerEvent) => {
    const zone = zoneRef.current;
    if (!zone) return;
    event.preventDefault();
    (event.target as Element).setPointerCapture?.(event.pointerId);
    activePointerId.current = event.pointerId;
    const rect = zone.getBoundingClientRect();
    const originX = event.clientX - rect.left;
    const originY = event.clientY - rect.top;
    originRef.current = { x: originX, y: originY };
    setOrigin({ x: originX, y: originY });
    setThumb({ x: 0, y: 0 });
    onChange(0, 0, true);
  }, [onChange]);

  const handlePointerMove = useCallback((event: React.PointerEvent) => {
    if (activePointerId.current !== event.pointerId) return;
    const zone = zoneRef.current;
    if (!zone) return;
    event.preventDefault();
    const rect = zone.getBoundingClientRect();
    const dx = event.clientX - rect.left - originRef.current.x;
    const dy = event.clientY - rect.top - originRef.current.y;
    const dist = Math.hypot(dx, dy);
    const clamped = Math.min(dist, radius);
    const angle = Math.atan2(dy, dx);
    const tx = Math.cos(angle) * clamped;
    const ty = Math.sin(angle) * clamped;
    setThumb({ x: tx, y: ty });
    onChange(clamped > 4 ? tx / radius : 0, clamped > 4 ? ty / radius : 0, true);
  }, [onChange, radius]);

  const handlePointerUp = useCallback((event: React.PointerEvent) => {
    if (activePointerId.current !== event.pointerId) return;
    reset();
  }, [reset]);

  useEffect(() => () => onChange(0, 0, false), [onChange]);

  return (
    <div
      ref={zoneRef}
      className={styles.joystickZone}
      aria-label={label}
      role="slider"
      aria-valuenow={0}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {origin && (
        <div className={styles.joystickBase} style={{ left: origin.x, top: origin.y }}>
          <div
            className={styles.joystickThumb}
            style={{ transform: `translate(${thumb.x}px, ${thumb.y}px)` }}
          />
        </div>
      )}
      {!origin && <span className={styles.joystickHint}>{label}</span>}
    </div>
  );
}
