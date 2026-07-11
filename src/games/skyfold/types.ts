export interface Player {
  x: number;
  y: number;
  vx: number;
  vy: number;
  aim: number;
  invulnerable: number;
}

export interface Terrace {
  x: number;
  y: number;
  w: number;
  h: number;
  d: number;
  speed: number;
  hue: number;
}

export interface Mote {
  x: number;
  y: number;
  size: number;
  speed: number;
  color: string;
}

export interface Sentry {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  health: number;
  maxHealth: number;
  speed: number;
  orbit: number;
  phase: number;
  elite: boolean;
}

export interface Monolith {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  health: number;
  rotation: number;
  spin: number;
}

export interface Beam {
  sx: number;
  sy: number;
  ex: number;
  ey: number;
  life: number;
}

export interface Shard {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
  rotation: number;
  spin: number;
}

export interface Pickup {
  x: number;
  y: number;
  speed: number;
  radius: number;
  pulse: number;
}

export type SkyfoldMode = 'menu' | 'playing' | 'paused' | 'gameover';

export interface SkyfoldScoreEntry {
  name: string;
  score: number;
  wave: number;
  time: number;
  date: string;
}

export interface SkyfoldHud {
  score: number;
  wave: number;
  health: number;
  laserReady: boolean;
  chargeFraction: number;
  bombCharges: number;
  maxBombs: number;
}

export interface SkyfoldRunResult {
  reason: 'crash' | 'quit';
  score: number;
  wave: number;
  time: number;
}
