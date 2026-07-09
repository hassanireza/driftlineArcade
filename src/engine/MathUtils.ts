/**
 * Pure, allocation-light math helpers shared by every canvas engine.
 * Kept outside any class so hot loops never pay for method dispatch.
 */

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Shortest-path angular interpolation, wraps correctly across +-PI. */
export function lerpAngle(a: number, b: number, t: number): number {
  const diff = (((b - a) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
  return a + diff * t;
}

export function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function wrap(value: number, max: number): number {
  return ((value % max) + max) % max;
}

export function circleIntersect(
  ax: number,
  ay: number,
  ar: number,
  bx: number,
  by: number,
  br: number
): boolean {
  return Math.hypot(ax - bx, ay - by) <= ar + br;
}

export function rectsOverlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number }
): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function distanceToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  const vx = bx - ax;
  const vy = by - ay;
  const wx = px - ax;
  const wy = py - ay;
  const lengthSq = vx * vx + vy * vy;
  if (lengthSq === 0) return Math.hypot(px - ax, py - ay);
  const t = clamp((wx * vx + wy * vy) / lengthSq, 0, 1);
  return Math.hypot(px - (ax + t * vx), py - (ay + t * vy));
}

export interface RayHit {
  point: { x: number; y: number };
  distance: number;
}

export function rayCircleIntersect(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  radius: number
): RayHit | null {
  const dx = bx - ax;
  const dy = by - ay;
  const fx = ax - cx;
  const fy = ay - cy;
  const a = dx * dx + dy * dy;
  const b = 2 * (fx * dx + fy * dy);
  const c = fx * fx + fy * fy - radius * radius;
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0 || a === 0) return null;
  const root = Math.sqrt(discriminant);
  const t1 = (-b - root) / (2 * a);
  const t2 = (-b + root) / (2 * a);
  const t = t1 >= 0 && t1 <= 1 ? t1 : t2 >= 0 && t2 <= 1 ? t2 : null;
  if (t === null) return null;
  const point = { x: ax + dx * t, y: ay + dy * t };
  return { point, distance: Math.hypot(point.x - ax, point.y - ay) };
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US').format(value);
}

export function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}

export function sanitizeName(name: string): string {
  return String(name).replace(/[^\w .-]/g, '').trim().slice(0, 18) || 'Pilot';
}
