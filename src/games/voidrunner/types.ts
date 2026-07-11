export interface RunnerPlayer {
  x: number;
  y: number;
  vy: number;
  onGround: boolean;
  jumps: number;
  sliding: boolean;
  fastFall: boolean;
  lives: number;
  runT: number;
  glowT: number;
}

export type ObstacleType = 'rock' | 'crystal' | 'drone' | 'gate' | 'turret';

export interface Obstacle {
  type: ObstacleType;
  x: number;
  y: number;
  w: number;
  h: number;
  t: number;
  hp: number;
  alive: boolean;
  solid: boolean;
  shoot?: number;
}

export interface Pickup {
  type: 'life' | 'shield' | 'gun';
  x: number;
  y: number;
  w: number;
  h: number;
  t: number;
  alive: boolean;
}

export interface Projectile {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  life?: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
  decay: number;
}

export interface Star {
  x: number;
  y: number;
  size: number;
  pulse: number;
}

export interface Dune {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type VoidrunnerMode = 'ready' | 'running' | 'paused' | 'dying' | 'gameover';

export interface VoidrunnerScoreEntry {
  score: number;
  date: string;
}

export interface VoidrunnerHud {
  score: number;
  best: number;
  lives: number;
  maxLives: number;
  speed: number;
  bombCharges: number;
  maxBombs: number;
  slideStamina: number;
  gunActive: boolean;
}

export interface VoidrunnerRunResult {
  score: number;
  best: number;
  isNewBest: boolean;
}
