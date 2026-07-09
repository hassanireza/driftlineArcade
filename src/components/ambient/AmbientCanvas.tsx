import { useEffect, useRef } from 'react';
import type { GameEngine } from '../../engine/GameEngine';

interface AmbientCanvasProps {
  className?: string;
  ariaHidden?: boolean;
  factory: (canvas: HTMLCanvasElement) => GameEngine;
}

/**
 * Mounts a decorative GameEngine subclass onto a canvas for the lifetime
 * of the component. The factory pattern keeps this wrapper reusable for
 * any ambient scene without duplicating mount and cleanup logic.
 */
export function AmbientCanvas({ className, ariaHidden = true, factory }: AmbientCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const engine = factory(canvas);
    engine.mount();
    return () => engine.dispose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden={ariaHidden} />;
}
