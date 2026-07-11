import { GameEngine } from '../../engine/GameEngine';
import { InputManager } from '../../engine/InputManager';
import { rectsOverlap, wrap } from '../../engine/MathUtils';
import type {
  Dune,
  Obstacle,
  ObstacleType,
  Particle,
  Pickup,
  Projectile,
  RunnerPlayer,
  Star,
  VoidrunnerHud,
  VoidrunnerMode,
  VoidrunnerRunResult
} from './types';

const LOGICAL_WIDTH = 960;
const LOGICAL_HEIGHT = 360;
const GROUND = 286;
const GRAVITY = 0.62;
const FAST_FALL = 1.34;
const JUMP = -12.4;
const MAX_LIVES = 5;
const PLAYER_X = 96;
const LASER_COLOR = '#3d5652';
const MAX_SLIDE_STAMINA = 100;
const SLIDE_DRAIN_PER_STEP = 1.6;
const SLIDE_REGEN_PER_STEP = 1.1;
const MAX_BOMBS = 2;
const GUN_BUFF_DURATION = 480; // steps (~8s at 60fps-equivalent step units)
const MAX_SPEED = 13.5;

export interface VoidrunnerCallbacks {
  onHudChange: (hud: VoidrunnerHud) => void;
  onModeChange: (mode: VoidrunnerMode) => void;
  onRunEnd: (result: VoidrunnerRunResult) => void;
}

/**
 * VoidrunnerEngine drives the Martian laser-runner. It renders at a fixed
 * logical resolution (960x360) that CSS scales responsively, mirroring the
 * feel of the original canvas build while gaining typed, encapsulated state.
 */
export class VoidrunnerEngine extends GameEngine {
  private mode: VoidrunnerMode = 'ready';
  private input: InputManager;
  private callbacks: VoidrunnerCallbacks;
  private bestScore: number;

  private score = 0;
  private distance = 0;
  private speed = 3.4;
  private spawnTimer = 0;
  private pickupTimer = 0;
  private invincible = 0;
  private shake = 0;
  private flash = 0;
  private deathTime = 0;
  private shotCooldown = 0;
  private slideStamina = MAX_SLIDE_STAMINA;
  private slideLocked = false;
  private bombCharges = MAX_BOMBS;
  private nextBombScore = 900;
  private bombFlash = 0;
  private gunBuff = 0;
  private joystickJumpArmed = true;

  private stars: Star[] = [];
  private dunes: Dune[] = [];
  private obstacles: Obstacle[] = [];
  private pickups: Pickup[] = [];
  private lasers: Projectile[] = [];
  private enemyShots: Projectile[] = [];
  private particles: Particle[] = [];
  private player: RunnerPlayer = this.createPlayer();

  constructor(canvas: HTMLCanvasElement, callbacks: VoidrunnerCallbacks, bestScore: number) {
    super(canvas, { alpha: false }, { width: LOGICAL_WIDTH, height: LOGICAL_HEIGHT });
    this.ctx.imageSmoothingEnabled = false;
    this.callbacks = callbacks;
    this.bestScore = bestScore;
    this.input = new InputManager(window, ['arrowup', 'arrowdown', ' ']);
    this.input.onKeyDownEvent((key, event) => this.handleKeyDown(key, event));
    this.input.onKeyUpEvent((key) => this.handleKeyUp(key));
    this.input.onWindowBlur(() => {
      if (this.mode === 'running') this.requestPause();
    });
    this.resetWorld();
  }

  // ── Public control surface ──────────────────────────────────────

  getMode(): VoidrunnerMode {
    return this.mode;
  }

  updateBestScore(best: number): void {
    this.bestScore = best;
  }

  startRun(): void {
    this.resetWorld();
    this.mode = 'running';
    this.start();
    this.callbacks.onModeChange(this.mode);
    this.publishHud();
  }

  requestPause(): void {
    if (this.mode !== 'running') return;
    this.mode = 'paused';
    this.pause();
    this.callbacks.onModeChange(this.mode);
  }

  requestResume(): void {
    if (this.mode !== 'paused') return;
    this.mode = 'running';
    this.resume();
    this.callbacks.onModeChange(this.mode);
  }

  togglePause(): void {
    if (this.mode === 'running') this.requestPause();
    else if (this.mode === 'paused') this.requestResume();
  }

  jump(): void {
    if (this.mode === 'ready' || this.mode === 'gameover') {
      this.startRun();
      return;
    }
    if (this.mode !== 'running') return;
    if (this.player.jumps >= 2) return;
    this.player.vy = this.player.jumps === 0 ? JUMP : JUMP * 0.86;
    this.player.onGround = false;
    this.player.sliding = false;
    this.player.fastFall = false;
    this.player.jumps += 1;
    this.burst(this.player.x + 12, GROUND, 8, '#4a4550', 2.4, -2.2);
  }

  slide(on: boolean): void {
    if (this.mode !== 'running') return;
    if (on) {
      if (this.slideLocked) return;
      if (!this.player.onGround) this.player.fastFall = true;
      else this.player.sliding = true;
    } else {
      this.player.sliding = false;
      this.player.fastFall = false;
    }
  }

  private updateSlideStamina(step: number): void {
    if (this.player.sliding) {
      this.slideStamina = Math.max(0, this.slideStamina - SLIDE_DRAIN_PER_STEP * step);
      if (this.slideStamina <= 0) {
        this.slideLocked = true;
        this.player.sliding = false;
      }
    } else {
      this.slideStamina = Math.min(MAX_SLIDE_STAMINA, this.slideStamina + SLIDE_REGEN_PER_STEP * step);
      if (this.slideLocked && this.slideStamina >= MAX_SLIDE_STAMINA * 0.4) this.slideLocked = false;
    }
  }

  /** Analog joystick: push down to slide/fast-fall, flick up to jump. */
  private applyJoystickInput(): void {
    const { joystick } = this.input;
    if (!joystick.active) {
      this.joystickJumpArmed = true;
      return;
    }
    if (joystick.y > 0.45) {
      this.slide(true);
    } else {
      this.slide(false);
    }
    if (joystick.y < -0.45) {
      if (this.joystickJumpArmed) {
        this.jump();
        this.joystickJumpArmed = false;
      }
    } else {
      this.joystickJumpArmed = true;
    }
  }

  fireLaser(): void {
    if (this.mode !== 'running' || this.shotCooldown > 0) return;
    const rapid = this.gunBuff > 0;
    this.shotCooldown = rapid ? 4.5 : 9;
    const box = this.playerBox();
    const y = this.player.sliding ? box.y + 7 : box.y + Math.max(10, box.h * 0.38);
    this.lasers.push({ x: box.x + box.w + 6, y, w: 34, h: 5, vx: 19 });
    if (rapid) this.lasers.push({ x: box.x + box.w + 6, y: y - 12, w: 34, h: 5, vx: 19 });
    this.burst(box.x + box.w + 10, y + 2, 4, LASER_COLOR, 1.4, -0.4);
  }

  setTouchControl(control: string, active: boolean): void {
    this.input.setTouch(control, active);
  }

  setJoystick(x: number, y: number, active: boolean): void {
    this.input.setJoystick(x, y, active);
  }

  /**
   * Screen-wipe ability: clears every obstacle and enemy shot currently on
   * screen for a burst of score. Gives the player a real panic button
   * against a dense cluster instead of only jump/slide/shoot.
   */
  useBomb(): void {
    if (this.mode !== 'running' || this.bombCharges <= 0) return;
    this.bombCharges -= 1;
    this.bombFlash = 14;
    this.shake = Math.max(this.shake, 10);
    for (const obstacle of this.obstacles) {
      if (!obstacle.alive) continue;
      obstacle.alive = false;
      this.score += 15;
      const box = this.obstacleBox(obstacle);
      this.burst(box.x + box.w / 2, box.y + box.h / 2, 14, '#8c5a3e', 5, -2);
    }
    this.enemyShots = [];
  }

  override dispose(): void {
    super.dispose();
    this.input.dispose();
  }

  // ── Setup ────────────────────────────────────────────────────────

  private createPlayer(): RunnerPlayer {
    return {
      x: PLAYER_X,
      y: GROUND,
      vy: 0,
      onGround: true,
      jumps: 0,
      sliding: false,
      fastFall: false,
      lives: 3,
      runT: 0,
      glowT: 0
    };
  }

  private resetWorld(): void {
    this.score = 0;
    this.distance = 0;
    this.speed = 3.4;
    this.spawnTimer = 44;
    this.pickupTimer = 360;
    this.invincible = 0;
    this.shake = 0;
    this.flash = 0;
    this.deathTime = 0;
    this.shotCooldown = 0;
    this.slideStamina = MAX_SLIDE_STAMINA;
    this.slideLocked = false;
    this.bombCharges = MAX_BOMBS;
    this.nextBombScore = 900;
    this.bombFlash = 0;
    this.gunBuff = 0;
    this.joystickJumpArmed = true;
    this.player = this.createPlayer();
    this.obstacles = [];
    this.pickups = [];
    this.lasers = [];
    this.enemyShots = [];
    this.particles = [];
    this.stars = Array.from({ length: 90 }, () => ({
      x: Math.random() * LOGICAL_WIDTH,
      y: 10 + Math.random() * 120,
      size: Math.random() < 0.76 ? 1 : 2,
      pulse: Math.random() * Math.PI * 2
    }));
    this.dunes = Array.from({ length: 26 }, (_, i) => ({
      x: i * 54,
      y: GROUND + 8 + Math.random() * 42,
      w: 14 + Math.random() * 44,
      h: 2 + Math.random() * 8
    }));
  }

  // ── Update loop ──────────────────────────────────────────────────

  protected update(rawDtMs: number): void {
    const dtMs = rawDtMs * 1000;
    if (this.mode !== 'running' && this.mode !== 'dying') return;

    const step = Math.min(dtMs / 16.6667, 2);
    const active = this.mode === 'running';

    if (active) {
      this.score += step;
      this.distance += this.speed * step;
      this.speed = Math.min(MAX_SPEED, 3.4 + this.score * 0.0032);
      this.spawnTimer -= step;
      this.pickupTimer -= step;
      this.shotCooldown = Math.max(0, this.shotCooldown - step);
      this.invincible = Math.max(0, this.invincible - step);
      this.bombFlash = Math.max(0, this.bombFlash - step);
      this.gunBuff = Math.max(0, this.gunBuff - step);

      if (this.score >= this.nextBombScore && this.bombCharges < MAX_BOMBS) {
        this.bombCharges += 1;
        this.nextBombScore += 900;
      }

      this.updateSlideStamina(step);
      this.applyJoystickInput();

      if (this.spawnTimer <= 0) {
        this.spawnObstacle();
        const difficulty = Math.max(30, 132 - this.score * 0.026 - this.speed * 3);
        this.spawnTimer = difficulty + Math.random() * 42;
      }
      if (this.pickupTimer <= 0) {
        this.spawnPickup();
        this.pickupTimer = 460 + Math.random() * 280;
      }
    } else {
      this.deathTime += step;
      this.speed = Math.max(0, this.speed - 0.09 * step);
      if (this.deathTime > 90) {
        this.mode = 'gameover';
        this.callbacks.onModeChange(this.mode);
        const isNewBest = this.score > this.bestScore;
        this.callbacks.onRunEnd({
          score: Math.max(0, Math.floor(this.score)),
          best: Math.max(this.bestScore, Math.floor(this.score)),
          isNewBest
        });
      }
    }

    if (this.player.onGround && !this.player.sliding) this.player.runT += 0.22 * step;
    this.player.glowT += 0.08 * step;
    this.shake = Math.max(0, this.shake - step);
    this.flash = Math.max(0, this.flash - step);

    if (!this.player.onGround) {
      this.player.vy += (this.player.fastFall ? FAST_FALL : GRAVITY) * step;
      this.player.y += this.player.vy * step;
      if (this.player.y >= GROUND) {
        this.player.y = GROUND;
        this.player.vy = 0;
        this.player.onGround = true;
        this.player.jumps = 0;
        this.player.fastFall = false;
        this.burst(this.player.x + 16, GROUND, 7, '#5a3a2c', 2, -1);
      }
    }

    for (const o of this.obstacles) {
      o.x -= this.speed * step;
      o.t += 0.05 * step;
      if (active && (o.type === 'turret' || o.type === 'drone') && o.shoot !== undefined) {
        o.shoot -= step;
        if (o.shoot <= 0) {
          const box = this.obstacleBox(o);
          this.enemyShots.push({ x: box.x - 4, y: box.y + box.h * 0.5, w: 14, h: 5, vx: -this.speed * 1.5 });
          o.shoot = o.type === 'turret' ? 95 + Math.random() * 50 : 120 + Math.random() * 80;
        }
      }
    }

    for (const pickup of this.pickups) {
      pickup.x -= this.speed * 0.9 * step;
      pickup.t += 0.08 * step;
    }
    for (const laser of this.lasers) laser.x += laser.vx * step;
    for (const shot of this.enemyShots) shot.x += shot.vx * step;

    for (const p of this.particles) {
      p.x += p.vx * step;
      p.y += p.vy * step;
      p.vy += 0.12 * step;
      p.life -= p.decay * step;
    }

    this.obstacles = this.obstacles.filter((o) => o.alive && o.x > -120);
    this.pickups = this.pickups.filter((p) => p.alive && p.x > -60);
    this.lasers = this.lasers.filter((l) => l.x < LOGICAL_WIDTH + 60);
    this.enemyShots = this.enemyShots.filter((s) => s.x > -40);
    this.particles = this.particles.filter((p) => p.life > 0);

    if (active) this.resolveCollisions();
    this.publishHud();
  }

  private spawnObstacle(): void {
    const progress = Math.min(1, this.score / 2600);
    const roll = Math.random();
    let type: ObstacleType = 'rock';
    if (roll < 0.24 + progress * 0.08) type = 'rock';
    else if (roll < 0.46) type = 'crystal';
    else if (roll < 0.72) type = 'drone';
    else if (roll < 0.88) type = 'gate';
    else type = 'turret';

    const base: Obstacle = {
      type,
      x: LOGICAL_WIDTH + 30,
      y: GROUND,
      w: 30,
      h: 30,
      t: Math.random() * 100,
      hp: 1,
      alive: true,
      solid: true
    };

    if (type === 'rock') {
      base.w = 30 + Math.random() * 34;
      base.h = 28 + Math.random() * 34;
      base.y = GROUND;
    } else if (type === 'crystal') {
      base.w = 42;
      base.h = 56 + Math.random() * 28;
      base.y = GROUND;
    } else if (type === 'drone') {
      base.w = 48;
      base.h = 22;
      base.y = GROUND - 98 - Math.random() * 34;
      base.hp = 2;
      base.shoot = 100 + Math.random() * 70;
    } else if (type === 'gate') {
      base.w = 58;
      base.h = 26;
      base.y = GROUND - 64;
      base.hp = 1;
    } else {
      base.w = 34;
      base.h = 42;
      base.y = GROUND;
      base.hp = 3;
      base.shoot = 80 + Math.random() * 60;
    }

    this.obstacles.push(base);
  }

  private spawnPickup(): void {
    const roll = Math.random();
    const type: Pickup['type'] = roll < 0.46 ? 'life' : roll < 0.74 ? 'shield' : 'gun';
    this.pickups.push({
      type,
      x: LOGICAL_WIDTH + 24,
      y: GROUND - 86 - Math.random() * 72,
      w: 24,
      h: 24,
      t: Math.random() * 20,
      alive: true
    });
  }

  private obstacleBox(o: Obstacle): { x: number; y: number; w: number; h: number } {
    if (o.type === 'rock') return { x: o.x + 4, y: GROUND - o.h + 4, w: o.w - 8, h: o.h - 4 };
    if (o.type === 'crystal') return { x: o.x + 4, y: GROUND - o.h + 6, w: o.w - 8, h: o.h - 6 };
    if (o.type === 'drone') return { x: o.x + 5, y: o.y + Math.sin(o.t) * 5 + 3, w: o.w - 10, h: o.h - 4 };
    if (o.type === 'gate') return { x: o.x + 2, y: o.y, w: o.w - 4, h: o.h };
    return { x: o.x + 4, y: GROUND - o.h + 4, w: o.w - 8, h: o.h - 4 };
  }

  private playerBox(): { x: number; y: number; w: number; h: number } {
    if (this.player.sliding && this.player.onGround) return { x: this.player.x - 8, y: GROUND - 21, w: 58, h: 20 };
    if (!this.player.onGround) return { x: this.player.x + 2, y: this.player.y - 45, w: 34, h: 38 };
    return { x: this.player.x, y: GROUND - 58, w: 30, h: 58 };
  }

  private burst(x: number, y: number, count: number, color: string, spread: number, rise: number): void {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * spread,
        vy: rise - Math.random() * spread,
        size: 2 + Math.random() * 4,
        color,
        life: 1,
        decay: 0.035 + Math.random() * 0.035
      });
    }
  }

  private damagePlayer(): void {
    if (this.invincible > 0 || this.mode !== 'running') return;
    this.player.lives -= 1;
    this.invincible = 96;
    this.shake = 16;
    this.flash = 12;
    const box = this.playerBox();
    this.burst(box.x + box.w / 2, box.y + box.h / 2, 24, '#6b2f2a', 5.6, -2);
    if (this.player.lives <= 0) {
      this.player.lives = 0;
      this.mode = 'dying';
      this.deathTime = 0;
    }
  }

  private resolveCollisions(): void {
    const pBox = this.playerBox();

    for (let li = this.lasers.length - 1; li >= 0; li--) {
      const laser = this.lasers[li];
      let spent = false;
      for (const obstacle of this.obstacles) {
        if (!obstacle.alive) continue;
        const box = this.obstacleBox(obstacle);
        if (!rectsOverlap(laser, box)) continue;
        obstacle.hp -= 1;
        spent = true;
        this.burst(laser.x + laser.w, laser.y + 2, 8, LASER_COLOR, 3, -1.2);
        if (obstacle.hp <= 0) {
          obstacle.alive = false;
          this.score += obstacle.type === 'turret' ? 80 : obstacle.type === 'drone' ? 60 : 35;
          this.burst(box.x + box.w / 2, box.y + box.h / 2, 18, '#8c5a3e', 5, -2);
        }
        break;
      }
      if (spent) this.lasers.splice(li, 1);
    }

    for (const obstacle of this.obstacles) {
      if (!obstacle.alive || !obstacle.solid) continue;
      if (rectsOverlap(pBox, this.obstacleBox(obstacle))) {
        obstacle.alive = false;
        this.damagePlayer();
        break;
      }
    }

    for (let i = this.enemyShots.length - 1; i >= 0; i--) {
      if (rectsOverlap(pBox, this.enemyShots[i])) {
        this.enemyShots.splice(i, 1);
        this.damagePlayer();
      }
    }

    for (const pickup of this.pickups) {
      const y = pickup.y + Math.sin(pickup.t) * 7;
      if (!rectsOverlap(pBox, { x: pickup.x, y, w: pickup.w, h: pickup.h })) continue;
      pickup.alive = false;
      if (pickup.type === 'life') {
        this.player.lives = Math.min(MAX_LIVES, this.player.lives + 1);
        this.burst(pickup.x + 12, y + 12, 14, '#4e5a48', 3.4, -2);
      } else if (pickup.type === 'gun') {
        this.gunBuff = GUN_BUFF_DURATION;
        this.burst(pickup.x + 12, y + 12, 16, '#8c5a3e', 4, -2.2);
      } else {
        this.invincible = Math.max(this.invincible, 150);
        this.burst(pickup.x + 12, y + 12, 16, '#3d5652', 3.8, -2);
      }
    }
  }

  private publishHud(): void {
    this.callbacks.onHudChange({
      score: Math.floor(this.score),
      best: Math.max(this.bestScore, Math.floor(this.score)),
      lives: this.player.lives,
      maxLives: MAX_LIVES,
      speed: this.speed,
      bombCharges: this.bombCharges,
      maxBombs: MAX_BOMBS,
      slideStamina: this.slideStamina,
      gunActive: this.gunBuff > 0
    });
  }

  // ── Rendering ────────────────────────────────────────────────────

  protected render(): void {
    const ctx = this.ctx;
    ctx.save();
    if (this.shake > 0) {
      ctx.translate((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake * 0.45);
    }

    this.drawBackground();
    this.drawPickups();
    this.drawObstacles();
    this.drawLasers();
    this.drawEnemyShots();
    this.drawPlayer();
    this.drawParticles();

    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${(this.flash / 12) * 0.24})`;
      ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    }
    if (this.bombFlash > 0) {
      ctx.fillStyle = `rgba(230, 224, 211, ${Math.min(0.5, this.bombFlash / 14)})`;
      ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    }
    ctx.restore();
  }

  private drawBackground(): void {
    const ctx = this.ctx;
    ctx.fillStyle = '#07050a';
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

    const skyShift = this.distance * 0.035;
    for (const star of this.stars) {
      const x = wrap(star.x - skyShift, LOGICAL_WIDTH);
      const alpha = 0.35 + Math.sin(star.pulse + this.distance * 0.018) * 0.24;
      ctx.fillStyle = `rgba(244, 239, 251, ${Math.max(0.18, alpha).toFixed(3)})`;
      ctx.fillRect(Math.round(x), Math.round(star.y), star.size, star.size);
    }

    this.drawMoon(760 - this.distance * 0.018, 62, 30, '#3a1b12', '#1b0d0a');
    this.drawMoon(438 - this.distance * 0.012, 40, 14, '#25152f', '#100916');
    this.drawMountains(this.distance * 0.15, '#210c08', 112, 8);
    this.drawMountains(this.distance * 0.38, '#4a1608', 86, 11);

    ctx.fillStyle = '#5c2010';
    ctx.fillRect(0, GROUND + 5, LOGICAL_WIDTH, LOGICAL_HEIGHT - GROUND);
    ctx.fillStyle = '#8d3615';
    ctx.fillRect(0, GROUND + 10, LOGICAL_WIDTH, LOGICAL_HEIGHT - GROUND);
    ctx.fillStyle = '#5a3a2c';
    ctx.fillRect(0, GROUND, LOGICAL_WIDTH, 5);
    ctx.fillStyle = '#2d0d07';
    ctx.fillRect(0, GROUND + 5, LOGICAL_WIDTH, 4);

    for (const dune of this.dunes) {
      const x = wrap(dune.x - this.distance * 0.72, LOGICAL_WIDTH + 80) - 40;
      ctx.fillStyle = '#351009';
      ctx.fillRect(Math.round(x), Math.round(dune.y), dune.w, dune.h);
    }
  }

  private drawMoon(x: number, y: number, r: number, color: string, shadow: string): void {
    const ctx = this.ctx;
    const px = wrap(x, LOGICAL_WIDTH + r * 4) - r * 2;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(px, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = shadow;
    ctx.beginPath();
    ctx.arc(px + r * 0.32, y - r * 0.18, r * 0.68, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawMountains(offset: number, color: string, height: number, peaks: number): void {
    const ctx = this.ctx;
    const width = LOGICAL_WIDTH * 1.8;
    const step = width / peaks;
    const start = -wrap(offset, width);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, GROUND + 1);
    for (let rep = 0; rep < 3; rep++) {
      for (let i = 0; i <= peaks; i++) {
        const x = start + rep * width + i * step;
        const y = GROUND - height * (0.45 + 0.55 * Math.abs(Math.sin(i * 1.7 + 0.6)));
        ctx.lineTo(x, GROUND);
        ctx.lineTo(x + step * 0.5, y);
        ctx.lineTo(x + step, GROUND);
      }
    }
    ctx.lineTo(LOGICAL_WIDTH, GROUND + 1);
    ctx.closePath();
    ctx.fill();
  }

  private drawPlayer(): void {
    const ctx = this.ctx;
    const box = this.playerBox();
    const blinking = this.invincible > 0 && Math.floor(this.invincible / 7) % 2 === 0;
    if (blinking) ctx.globalAlpha = 0.42;

    if (this.player.sliding && this.player.onGround) this.drawSlider(box);
    else if (!this.player.onGround) this.drawJet(box);
    else this.drawRunner(box);

    ctx.globalAlpha = 1;
  }

  private drawRunner(box: { x: number; y: number; w: number; h: number }): void {
    const ctx = this.ctx;
    const x = Math.round(box.x);
    const y = Math.round(GROUND);
    const stride = Math.round(Math.sin(this.player.runT) * 6);
    const core = Math.sin(this.player.glowT * 4) > 0 ? '#3d5652' : '#4a4550';

    ctx.fillStyle = '#3d5652';
    ctx.fillRect(x + stride, y, 12, 6);
    ctx.fillRect(x + 16 - stride, y, 12, 6);

    ctx.fillStyle = '#2a2432';
    ctx.fillRect(x + 3 + stride, y - 18, 8, 18);
    ctx.fillRect(x + 17 - stride, y - 18, 8, 18);

    ctx.fillStyle = '#1e1040';
    ctx.fillRect(x - 2, y - 44, 34, 28);
    ctx.fillStyle = '#3a3540';
    ctx.fillRect(x + 1, y - 41, 28, 22);
    ctx.fillStyle = core;
    ctx.fillRect(x + 12, y - 34, 8, 8);

    const arm = Math.round(Math.sin(this.player.runT + Math.PI) * 5);
    ctx.fillStyle = '#2a2432';
    ctx.fillRect(x - 10, y - 42 + arm, 9, 18);
    ctx.fillRect(x + 31, y - 42 - arm, 9, 18);
    ctx.fillStyle = '#6b6470';
    ctx.fillRect(x + 38, y - 30 - arm, 10, 3);

    ctx.fillStyle = '#1a0a30';
    ctx.fillRect(x + 3, y - 64, 24, 20);
    ctx.fillStyle = '#3a3540';
    ctx.fillRect(x + 6, y - 61, 18, 15);
    ctx.fillStyle = '#3d5652';
    ctx.fillRect(x + 8, y - 57, 5, 4);
    ctx.fillRect(x + 17, y - 57, 5, 4);
    ctx.fillStyle = '#4a4550';
    ctx.fillRect(x + 14, y - 72, 2, 10);
    ctx.fillStyle = '#3d5652';
    ctx.fillRect(x + 12, y - 75, 6, 5);
  }

  private drawSlider(box: { x: number; y: number; w: number; h: number }): void {
    const ctx = this.ctx;
    const x = Math.round(box.x);
    const y = Math.round(box.y);
    ctx.fillStyle = '#11091e';
    ctx.fillRect(x + 4, y + 17, box.w - 8, 5);
    ctx.fillStyle = '#2a2432';
    ctx.fillRect(x, y + 7, box.w, 14);
    ctx.fillStyle = '#3a3540';
    ctx.fillRect(x + 12, y + 1, 34, 12);
    ctx.fillStyle = '#3d5652';
    ctx.fillRect(x + 16, y + 3, 11, 7);
    ctx.fillStyle = '#6b6470';
    ctx.fillRect(x + box.w - 8, y + 10, 8, 3);
    ctx.fillStyle = '#0d0717';
    ctx.fillRect(x + 8, y + 19, 10, 7);
    ctx.fillRect(x + box.w - 19, y + 19, 10, 7);
    ctx.fillStyle = '#3d5652';
    ctx.fillRect(x + 10, y + 21, 6, 3);
    ctx.fillRect(x + box.w - 17, y + 21, 6, 3);
  }

  private drawJet(box: { x: number; y: number; w: number; h: number }): void {
    const ctx = this.ctx;
    const x = Math.round(box.x);
    const y = Math.round(box.y);
    ctx.fillStyle = '#160824';
    ctx.fillRect(x - 4, y + 8, 42, 22);
    ctx.fillStyle = '#2a2432';
    ctx.fillRect(x, y + 11, 38, 16);
    ctx.fillStyle = '#4a4550';
    ctx.fillRect(x + 34, y + 14, 8, 10);
    ctx.fillStyle = '#3d5652';
    ctx.fillRect(x + 18, y + 13, 12, 8);
    ctx.fillStyle = '#3a3540';
    ctx.fillRect(x + 4, y + 2, 24, 7);
    ctx.fillRect(x + 4, y + 29, 24, 7);
    ctx.fillStyle = '#8c5a3e';
    ctx.fillRect(x - 12, y + 14, 9, 5);
    ctx.fillStyle = '#8c7a4e';
    ctx.fillRect(x - 8, y + 20, 6, 4);
  }

  private drawObstacles(): void {
    for (const o of this.obstacles) {
      if (o.type === 'rock') this.drawRock(o);
      else if (o.type === 'crystal') this.drawCrystal(o);
      else if (o.type === 'drone') this.drawDrone(o);
      else if (o.type === 'gate') this.drawGate(o);
      else this.drawTurret(o);
    }
  }

  private drawRock(o: Obstacle): void {
    const ctx = this.ctx;
    const x = Math.round(o.x);
    const y = Math.round(GROUND - o.h);
    ctx.fillStyle = '#3a1005';
    ctx.fillRect(x - 3, y + 3, o.w + 6, o.h - 2);
    ctx.fillStyle = '#7a2a0a';
    ctx.fillRect(x, y, o.w, o.h);
    ctx.fillStyle = '#5a3a2c';
    ctx.fillRect(x + 8, y + 8, 12, 5);
    ctx.fillRect(x + o.w - 18, y + o.h - 16, 10, 5);
  }

  private drawCrystal(o: Obstacle): void {
    const ctx = this.ctx;
    const x = Math.round(o.x);
    const y = Math.round(GROUND);
    ctx.fillStyle = '#063040';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + o.w * 0.5, y - o.h);
    ctx.lineTo(x + o.w, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#3d5652';
    ctx.beginPath();
    ctx.moveTo(x + 5, y);
    ctx.lineTo(x + o.w * 0.5, y - o.h + 9);
    ctx.lineTo(x + o.w - 6, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#6a8a83';
    ctx.fillRect(x + o.w * 0.48, y - o.h + 13, 3, o.h * 0.5);
  }

  private drawDrone(o: Obstacle): void {
    const ctx = this.ctx;
    const x = Math.round(o.x);
    const y = Math.round(o.y + Math.sin(o.t) * 5);
    ctx.fillStyle = '#4a1606';
    ctx.fillRect(x, y + 4, o.w, o.h - 5);
    ctx.fillStyle = o.hp > 1 ? '#5a3a2c' : '#6b2f2a';
    ctx.fillRect(x + 4, y, o.w - 8, o.h);
    ctx.fillStyle = '#7a5a3e';
    ctx.fillRect(x + o.w / 2 - 4, y + 8, 8, 6);
    ctx.strokeStyle = '#8c5a3e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 8, y - 4);
    ctx.lineTo(x + o.w - 8, y - 4);
    ctx.stroke();
  }

  private drawGate(o: Obstacle): void {
    const ctx = this.ctx;
    const x = Math.round(o.x);
    const y = Math.round(o.y);
    ctx.fillStyle = '#14003a';
    ctx.fillRect(x, y, o.w, o.h);
    ctx.strokeStyle = '#4a4550';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 2, y + 2, o.w - 4, o.h - 4);
    ctx.fillStyle = '#3d5652';
    ctx.fillRect(x + 8, y + 10, o.w - 16, 5);
  }

  private drawTurret(o: Obstacle): void {
    const ctx = this.ctx;
    const x = Math.round(o.x);
    const y = Math.round(GROUND);
    ctx.fillStyle = '#180824';
    ctx.fillRect(x, y - o.h, o.w, o.h);
    ctx.fillStyle = o.hp > 2 ? '#3a3540' : o.hp > 1 ? '#8b3a1a' : '#6a1020';
    ctx.fillRect(x + 3, y - o.h + 3, o.w - 6, o.h - 3);
    ctx.fillStyle = '#6b2f2a';
    ctx.fillRect(x - 9, y - 27, 12, 5);
    ctx.fillStyle = '#3d5652';
    ctx.fillRect(x + 9, y - o.h + 9, 8, 5);
  }

  private drawPickups(): void {
    const ctx = this.ctx;
    for (const p of this.pickups) {
      const x = Math.round(p.x);
      const y = Math.round(p.y + Math.sin(p.t) * 7);
      ctx.fillStyle = 'rgba(34, 211, 238, 0.14)';
      ctx.fillRect(x - 4, y - 4, p.w + 8, p.h + 8);
      if (p.type === 'life') {
        ctx.fillStyle = '#4e5a48';
        ctx.fillRect(x + 9, y + 4, 6, 16);
        ctx.fillRect(x + 4, y + 9, 16, 6);
      } else if (p.type === 'gun') {
        ctx.fillStyle = '#8c5a3e';
        ctx.fillRect(x + 4, y + 9, 18, 6);
        ctx.fillRect(x + 16, y + 5, 6, 6);
      } else {
        ctx.strokeStyle = '#3d5652';
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 2, y + 2, 20, 20);
        ctx.fillStyle = '#6a8a83';
        ctx.fillRect(x + 7, y + 7, 10, 10);
      }
    }
  }

  private drawLasers(): void {
    const ctx = this.ctx;
    for (const laser of this.lasers) {
      ctx.fillStyle = '#3d5652';
      ctx.fillRect(Math.round(laser.x), Math.round(laser.y), laser.w, laser.h);
      ctx.fillStyle = '#6a8a83';
      ctx.fillRect(Math.round(laser.x + 3), Math.round(laser.y + 1), laser.w - 6, 2);
    }
  }

  private drawEnemyShots(): void {
    const ctx = this.ctx;
    for (const shot of this.enemyShots) {
      ctx.fillStyle = '#6b2f2a';
      ctx.fillRect(Math.round(shot.x), Math.round(shot.y), shot.w, shot.h);
      ctx.fillStyle = '#8c7a4e';
      ctx.fillRect(Math.round(shot.x + 3), Math.round(shot.y + 1), 5, 2);
    }
  }

  private drawParticles(): void {
    const ctx = this.ctx;
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      const size = Math.max(1, Math.round(p.size * p.life));
      ctx.fillRect(Math.round(p.x), Math.round(p.y), size, size);
    }
    ctx.globalAlpha = 1;
  }

  // ── Input ────────────────────────────────────────────────────────

  private handleKeyDown(key: string, event: KeyboardEvent): void {
    if (event.repeat) return;
    const code = event.code;
    if (code === 'Space' || code === 'ArrowUp') this.jump();
    else if (code === 'ArrowDown') this.slide(true);
    else if (key === 'f' || key === 'z') this.fireLaser();
    else if (key === 'b') this.useBomb();
    else if (key === 'p' || key === 'escape') this.togglePause();
  }

  private handleKeyUp(key: string): void {
    if (key === 'arrowdown') this.slide(false);
  }
}
