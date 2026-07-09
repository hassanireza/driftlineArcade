import { GameEngine } from '../../engine/GameEngine';
import { InputManager } from '../../engine/InputManager';
import {
  circleIntersect,
  clamp,
  distanceToSegment,
  lerpAngle,
  rayCircleIntersect,
  type RayHit
} from '../../engine/MathUtils';
import type {
  Beam,
  Monolith,
  Mote,
  Pickup,
  Player,
  Sentry,
  Shard,
  SkyfoldHud,
  SkyfoldMode,
  SkyfoldRunResult,
  Terrace
} from './types';

const PLAYER_RADIUS = 16;
const LASER_COOLDOWN = 0.16;
const LASER_RANGE = 780;
const LASER_DAMAGE = 55;
const LASER_WIDTH = 6;
const WAVE_DURATION = 22;

export interface SkyfoldCallbacks {
  onHudChange: (hud: SkyfoldHud) => void;
  onModeChange: (mode: SkyfoldMode) => void;
  onRunEnd: (result: SkyfoldRunResult) => void;
}

/**
 * SkyfoldEngine drives the "Skyfold Aviary" arcade experience: a laser
 * glider weaving between drifting iso-terraces. All gameplay state lives
 * on the instance, input is read through InputManager and the HUD is
 * reported outward through callbacks so React can render accessible DOM
 * overlays instead of drawing text on the canvas.
 */
export class SkyfoldEngine extends GameEngine {
  private mode: SkyfoldMode = 'menu';
  private input: InputManager;
  private callbacks: SkyfoldCallbacks;

  private score = 0;
  private wave = 1;
  private health = 100;
  private elapsed = 0;
  private shake = 0;
  private laserCooldown = 0;
  private waveProgress = 0;
  private spawnTimer = 0;
  private monolithTimer = 0;
  private pickupTimer = 0;
  private fireHeld = false;

  private player: Player = { x: 0, y: 0, vx: 0, vy: 0, aim: -Math.PI / 2, invulnerable: 0 };
  private terraces: Terrace[] = [];
  private motes: Mote[] = [];
  private sentries: Sentry[] = [];
  private monoliths: Monolith[] = [];
  private beams: Beam[] = [];
  private shards: Shard[] = [];
  private pickups: Pickup[] = [];

  constructor(canvas: HTMLCanvasElement, callbacks: SkyfoldCallbacks) {
    super(canvas, { alpha: false });
    this.callbacks = callbacks;
    this.input = new InputManager(window, [
      'arrowup',
      'arrowdown',
      'arrowleft',
      'arrowright',
      ' ',
      'enter'
    ]);
    this.input.onKeyDownEvent((key) => this.handleKeyDown(key));
    this.input.onKeyUpEvent((key) => this.handleKeyUp(key));
    this.input.onWindowBlur(() => {
      this.fireHeld = false;
      if (this.mode === 'playing') this.requestPause();
    });
  }

  // ── Public control surface consumed by the React page ──────────────

  getMode(): SkyfoldMode {
    return this.mode;
  }

  startRun(): void {
    this.resetRun();
    this.mode = 'playing';
    this.start();
    this.callbacks.onModeChange(this.mode);
    this.publishHud();
  }

  requestPause(): void {
    if (this.mode !== 'playing') return;
    this.mode = 'paused';
    this.pause();
    this.callbacks.onModeChange(this.mode);
  }

  requestResume(): void {
    if (this.mode !== 'paused') return;
    this.mode = 'playing';
    this.resume();
    this.callbacks.onModeChange(this.mode);
  }

  quitRun(): void {
    this.finishRun('quit');
  }

  showMenu(): void {
    this.mode = 'menu';
    this.pause();
    this.callbacks.onModeChange(this.mode);
  }

  setTouchControl(control: string, active: boolean): void {
    this.input.setTouch(control, active);
  }

  setPointer(x: number, y: number, active: boolean): void {
    this.input.pointer.x = clamp(x, 0, this.width);
    this.input.pointer.y = clamp(y, 0, this.height);
    this.input.pointer.active = active;
  }

  override dispose(): void {
    super.dispose();
    this.input.dispose();
  }

  // ── Setup ────────────────────────────────────────────────────────

  private resetRun(): void {
    this.score = 0;
    this.wave = 1;
    this.health = 100;
    this.elapsed = 0;
    this.shake = 0;
    this.laserCooldown = 0;
    this.waveProgress = 0;
    this.spawnTimer = 1;
    this.monolithTimer = 1.4;
    this.pickupTimer = 0;
    this.sentries = [];
    this.monoliths = [];
    this.beams = [];
    this.shards = [];
    this.pickups = [];

    this.player = {
      x: this.width * 0.5,
      y: this.height * 0.64,
      vx: 0,
      vy: 0,
      aim: -Math.PI / 2,
      invulnerable: 2.2
    };

    this.terraces = this.buildTerraces();
    this.motes = Array.from({ length: this.getMoteCount() }, () => this.makeMote(true));
  }

  protected override onResize(oldWidth: number, oldHeight: number): void {
    this.player.x = clamp(this.player.x || this.width * 0.5, PLAYER_RADIUS, this.width - PLAYER_RADIUS);
    this.player.y = clamp(this.player.y || this.height * 0.62, PLAYER_RADIUS, this.height - PLAYER_RADIUS);
    if (Math.abs(oldWidth - this.width) > 24 || Math.abs(oldHeight - this.height) > 24) {
      this.terraces = this.buildTerraces();
      this.motes = Array.from({ length: this.getMoteCount() }, () => this.makeMote(true));
    }
  }

  private buildTerraces(): Terrace[] {
    const count = Math.max(9, Math.round(this.height / 88));
    return Array.from({ length: count }, () => ({
      x: Math.random() * this.width,
      y: Math.random() * this.height,
      w: Math.random() * 120 + 90,
      h: Math.random() * 38 + 28,
      d: Math.random() * 44 + 28,
      speed: Math.random() * 26 + 18,
      hue: Math.random()
    }));
  }

  private getMoteCount(): number {
    return Math.min(110, Math.max(42, Math.round((this.width * this.height) / 12000)));
  }

  private makeMote(anywhere: boolean): Mote {
    return {
      x: Math.random() * this.width,
      y: anywhere ? Math.random() * this.height : -10,
      size: Math.random() * 2.4 + 0.8,
      speed: Math.random() * 36 + 16,
      color: Math.random() > 0.5 ? '#cfc6b8' : '#6b5348'
    };
  }

  // ── Update loop ──────────────────────────────────────────────────

  protected update(dt: number): void {
    this.elapsed += dt;
    this.laserCooldown = Math.max(0, this.laserCooldown - dt);
    this.player.invulnerable = Math.max(0, this.player.invulnerable - dt);
    this.shake = Math.max(0, this.shake - dt * 18);

    this.updateBackground(dt);
    this.updatePlayer(dt);
    this.updateSpawning(dt);
    this.updateSentries(dt);
    this.updateMonoliths(dt);
    this.updatePickups(dt);
    this.updateEffects(dt);
    this.handleCollisions();
    this.updateWaves(dt);
    this.publishHud();
  }

  private updateBackground(dt: number): void {
    for (const terrace of this.terraces) {
      terrace.y += terrace.speed * dt;
      if (terrace.y - terrace.d > this.height + 70) {
        terrace.x = Math.random() * this.width;
        terrace.y = -90;
        terrace.w = Math.random() * 120 + 90;
        terrace.h = Math.random() * 38 + 28;
        terrace.d = Math.random() * 44 + 28;
      }
    }
    for (const mote of this.motes) {
      mote.y += mote.speed * dt;
      mote.x += Math.sin(this.elapsed + mote.y * 0.01) * dt * 10;
      if (mote.y > this.height + 12) Object.assign(mote, this.makeMote(false));
    }
  }

  private updatePlayer(dt: number): void {
    const movement = this.getMovementInput();
    const acceleration = 780;
    const maxSpeed = 290;
    const drag = Math.pow(0.0006, dt);

    this.player.vx = (this.player.vx + movement.x * acceleration * dt) * drag;
    this.player.vy = (this.player.vy + movement.y * acceleration * dt) * drag;
    const speed = Math.hypot(this.player.vx, this.player.vy);
    if (speed > maxSpeed) {
      this.player.vx = (this.player.vx / speed) * maxSpeed;
      this.player.vy = (this.player.vy / speed) * maxSpeed;
    }

    this.player.x = clamp(this.player.x + this.player.vx * dt, PLAYER_RADIUS, this.width - PLAYER_RADIUS);
    this.player.y = clamp(this.player.y + this.player.vy * dt, PLAYER_RADIUS, this.height - PLAYER_RADIUS);

    let targetAim = this.player.aim;
    const { pointer } = this.input;

    if (pointer.active) {
      targetAim = Math.atan2(pointer.y - this.player.y, pointer.x - this.player.x);
    } else if (movement.x !== 0 || movement.y !== 0) {
      targetAim = Math.atan2(movement.y, movement.x);
    } else if (speed > 18) {
      const driftAim = Math.atan2(this.player.vy, this.player.vx);
      const pull = (speed / maxSpeed) * 0.14;
      targetAim = lerpAngle(this.player.aim, driftAim, pull * dt * 3);
    }

    const rotateSpeed = pointer.active ? 20 : 11;
    this.player.aim = lerpAngle(this.player.aim, targetAim, Math.min(1, rotateSpeed * dt));

    if (this.isFiring()) this.fireLaser();
  }

  private updatePickups(dt: number): void {
    if (this.wave >= 3) {
      this.pickupTimer -= dt;
      if (this.pickupTimer <= 0) {
        const interval = Math.max(9, 18 - (this.wave - 3));
        this.pickupTimer = interval;
        this.spawnPickup();
      }
    }

    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pickup = this.pickups[i];
      pickup.y += pickup.speed * dt;
      pickup.pulse += dt * 2.8;

      if (pickup.y > this.height + 60) {
        this.pickups.splice(i, 1);
        continue;
      }

      const dist = Math.hypot(this.player.x - pickup.x, this.player.y - pickup.y);
      if (dist <= PLAYER_RADIUS + pickup.radius) {
        const healed = Math.min(20, 100 - this.health);
        this.health = Math.min(100, this.health + 20);
        this.burstHeal(pickup.x, pickup.y, healed);
        this.pickups.splice(i, 1);
      }
    }
  }

  private spawnPickup(): void {
    const margin = 60;
    this.pickups.push({
      x: margin + Math.random() * (this.width - margin * 2),
      y: -28,
      speed: 38 + this.wave * 1.8,
      radius: 14,
      pulse: Math.random() * Math.PI * 2
    });
  }

  private burstHeal(x: number, y: number, _amount: number): void {
    this.shake = Math.max(this.shake, 1.2);
    for (let i = 0; i < 14; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 140 + 40;
      this.shards.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: Math.random() * 0.45 + 0.28,
        color: i % 3 === 0 ? '#8c7a4e' : '#cfc6b8',
        size: Math.random() * 5 + 3,
        rotation: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 8
      });
    }
  }

  private updateSpawning(dt: number): void {
    this.spawnTimer -= dt;
    this.monolithTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnSentry();
      this.spawnTimer = Math.max(0.42, 1.08 - this.wave * 0.055);
    }
    if (this.monolithTimer <= 0) {
      this.spawnMonolith();
      this.monolithTimer = Math.max(0.38, 1.35 - this.wave * 0.04);
    }
  }

  private updateSentries(dt: number): void {
    for (let i = this.sentries.length - 1; i >= 0; i--) {
      const sentry = this.sentries[i];
      const dx = this.player.x - sentry.x;
      const dy = this.player.y - sentry.y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const orbit = Math.sin(this.elapsed * 2.3 + sentry.phase) * sentry.orbit;
      sentry.vx += ((dx / distance) * sentry.speed + Math.cos(sentry.phase) * orbit - sentry.vx) * Math.min(1, dt * 1.8);
      sentry.vy += ((dy / distance) * sentry.speed + Math.sin(sentry.phase) * orbit - sentry.vy) * Math.min(1, dt * 1.8);
      sentry.x += sentry.vx * dt;
      sentry.y += sentry.vy * dt;
      sentry.phase += dt;
      if (sentry.health <= 0) this.destroySentry(i);
    }
  }

  private updateMonoliths(dt: number): void {
    for (let i = this.monoliths.length - 1; i >= 0; i--) {
      const stone = this.monoliths[i];
      stone.x += stone.vx * dt;
      stone.y += stone.vy * dt;
      stone.rotation += stone.spin * dt;
      if (stone.y > this.height + 90 || stone.x < -120 || stone.x > this.width + 120) {
        this.monoliths.splice(i, 1);
      }
    }
  }

  private updateEffects(dt: number): void {
    for (let i = this.beams.length - 1; i >= 0; i--) {
      this.beams[i].life -= dt;
      if (this.beams[i].life <= 0) this.beams.splice(i, 1);
    }
    for (let i = this.shards.length - 1; i >= 0; i--) {
      const shard = this.shards[i];
      shard.life -= dt;
      shard.x += shard.vx * dt;
      shard.y += shard.vy * dt;
      shard.rotation += shard.spin * dt;
      shard.vx *= Math.pow(0.04, dt);
      shard.vy *= Math.pow(0.04, dt);
      if (shard.life <= 0) this.shards.splice(i, 1);
    }
  }

  private updateWaves(dt: number): void {
    this.waveProgress += dt;
    if (this.waveProgress >= WAVE_DURATION) {
      this.wave += 1;
      this.waveProgress = 0;
      this.score += 250 * this.wave;
      for (let i = 0; i < Math.min(12, 3 + this.wave); i++) this.spawnSentry();
    }
  }

  private handleCollisions(): void {
    if (this.player.invulnerable > 0) return;
    for (let i = this.sentries.length - 1; i >= 0; i--) {
      const sentry = this.sentries[i];
      if (circleIntersect(this.player.x, this.player.y, PLAYER_RADIUS, sentry.x, sentry.y, sentry.radius)) {
        this.damagePlayer(18);
        this.destroySentry(i, false);
        return;
      }
    }
    for (let i = this.monoliths.length - 1; i >= 0; i--) {
      const stone = this.monoliths[i];
      if (circleIntersect(this.player.x, this.player.y, PLAYER_RADIUS, stone.x, stone.y, stone.radius)) {
        this.damagePlayer(12);
        this.burst(stone.x, stone.y, '#8c7a4e', 10);
        this.monoliths.splice(i, 1);
        return;
      }
    }
  }

  private damagePlayer(amount: number): void {
    this.health = Math.max(0, this.health - amount);
    this.player.invulnerable = 1.1;
    this.shake = 8;
    this.burst(this.player.x, this.player.y, '#7c4633', 18);
    if (this.health <= 0) {
      this.finishRun('crash');
    }
  }

  private fireLaser(): void {
    if (this.laserCooldown > 0) return;
    this.laserCooldown = LASER_COOLDOWN;
    const sx = this.player.x + Math.cos(this.player.aim) * 19;
    const sy = this.player.y + Math.sin(this.player.aim) * 19;
    const ex = sx + Math.cos(this.player.aim) * LASER_RANGE;
    const ey = sy + Math.sin(this.player.aim) * LASER_RANGE;
    let hitPoint = { x: ex, y: ey };
    let closest = LASER_RANGE;

    const consider = (hit: RayHit | null) => {
      if (hit && hit.distance < closest) {
        closest = hit.distance;
        hitPoint = hit.point;
      }
    };

    for (const sentry of this.sentries) {
      consider(rayCircleIntersect(sx, sy, ex, ey, sentry.x, sentry.y, sentry.radius + LASER_WIDTH));
    }
    for (const stone of this.monoliths) {
      consider(rayCircleIntersect(sx, sy, ex, ey, stone.x, stone.y, stone.radius + LASER_WIDTH));
    }

    this.beams.push({ sx, sy, ex: hitPoint.x, ey: hitPoint.y, life: 0.09 });
    this.shake = Math.max(this.shake, 1.6);

    for (let i = this.sentries.length - 1; i >= 0; i--) {
      const sentry = this.sentries[i];
      if (distanceToSegment(sentry.x, sentry.y, sx, sy, hitPoint.x, hitPoint.y) <= sentry.radius + LASER_WIDTH) {
        sentry.health -= LASER_DAMAGE;
        this.burst(sentry.x, sentry.y, sentry.elite ? '#8c7a4e' : '#3d5652', 6);
        if (sentry.health <= 0) this.destroySentry(i);
      }
    }

    for (let i = this.monoliths.length - 1; i >= 0; i--) {
      const stone = this.monoliths[i];
      if (distanceToSegment(stone.x, stone.y, sx, sy, hitPoint.x, hitPoint.y) <= stone.radius + LASER_WIDTH) {
        stone.health -= LASER_DAMAGE;
        this.burst(stone.x, stone.y, '#4a3a2c', 5);
        if (stone.health <= 0) {
          this.score += 40;
          this.monoliths.splice(i, 1);
        }
      }
    }
  }

  private spawnSentry(): void {
    const edge = Math.floor(Math.random() * 4);
    const margin = 52;
    const positions = [
      { x: Math.random() * this.width, y: -margin },
      { x: this.width + margin, y: Math.random() * this.height },
      { x: Math.random() * this.width, y: this.height + margin },
      { x: -margin, y: Math.random() * this.height }
    ];
    const position = positions[edge];
    const elite = Math.random() < Math.min(0.32, this.wave * 0.025);
    const health = elite ? 120 + this.wave * 6 : 70 + this.wave * 4;
    this.sentries.push({
      x: position.x,
      y: position.y,
      vx: 0,
      vy: 0,
      radius: elite ? 19 : 15,
      health,
      maxHealth: health,
      speed: (elite ? 76 : 96) + this.wave * 4,
      orbit: elite ? 38 : 24,
      phase: Math.random() * Math.PI * 2,
      elite
    });
  }

  private spawnMonolith(): void {
    const radius = Math.random() * 14 + 12;
    this.monoliths.push({
      x: Math.random() * this.width,
      y: -radius - 22,
      vx: (Math.random() - 0.5) * 70,
      vy: Math.random() * 88 + 86 + this.wave * 4,
      radius,
      health: radius * 3.2,
      rotation: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 1.8
    });
  }

  private destroySentry(index: number, awardScore = true): void {
    const sentry = this.sentries[index];
    if (!sentry) return;
    if (awardScore) this.score += sentry.elite ? 180 : 100;
    this.burst(sentry.x, sentry.y, sentry.elite ? '#8c7a4e' : '#3d5652', sentry.elite ? 18 : 12);
    this.sentries.splice(index, 1);
  }

  private burst(x: number, y: number, color: string, count: number): void {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 180 + 50;
      this.shards.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: Math.random() * 0.35 + 0.22,
        color,
        size: Math.random() * 5 + 3,
        rotation: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 8
      });
    }
  }

  private finishRun(reason: 'crash' | 'quit'): void {
    if (this.mode === 'gameover') return;
    this.mode = 'gameover';
    this.pause();
    this.callbacks.onModeChange(this.mode);
    this.callbacks.onRunEnd({
      reason,
      score: Math.round(this.score),
      wave: this.wave,
      time: Math.floor(this.elapsed)
    });
  }

  // ── Rendering ────────────────────────────────────────────────────

  protected render(): void {
    const shakeX = (Math.random() - 0.5) * this.shake;
    const shakeY = (Math.random() - 0.5) * this.shake;
    const ctx = this.ctx;
    ctx.save();
    ctx.clearRect(0, 0, this.width, this.height);
    this.drawSky();
    ctx.translate(shakeX, shakeY);
    this.drawTerraces();
    this.drawMotes();
    this.drawPickups();
    this.drawMonoliths();
    this.drawSentries();
    this.drawPlayer();
    this.drawBeams();
    this.drawShards();
    ctx.restore();
  }

  private drawSky(): void {
    const ctx = this.ctx;
    const gradient = ctx.createLinearGradient(0, 0, 0, this.height);
    gradient.addColorStop(0, '#0b0a09');
    gradient.addColorStop(0.38, '#12181a');
    gradient.addColorStop(0.72, '#0c1416');
    gradient.addColorStop(1, '#050605');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.strokeStyle = '#cfc6b8';
    ctx.lineWidth = 1;
    const gap = 72;
    const offset = (this.elapsed * 12) % gap;
    for (let y = -gap + offset; y < this.height + gap; y += gap) {
      ctx.beginPath();
      ctx.moveTo(-40, y);
      ctx.lineTo(this.width + 40, y - 45);
      ctx.stroke();
    }
    for (let x = -gap; x < this.width + gap; x += gap) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + this.height * 0.72, this.height);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawTerraces(): void {
    for (const terrace of this.terraces) {
      this.drawIsoBlock(terrace.x, terrace.y, terrace.w, terrace.h, terrace.d, terrace.hue);
    }
  }

  private drawIsoBlock(x: number, y: number, w: number, h: number, d: number, hue: number): void {
    const ctx = this.ctx;
    const top = hue > 0.66 ? '#cfc6b8' : hue > 0.33 ? '#b8bdb2' : '#c4bcae';
    const left = hue > 0.66 ? '#4a3540' : hue > 0.33 ? '#2e4440' : '#4a3a2c';
    const right = hue > 0.66 ? '#3a3540' : hue > 0.33 ? '#24393a' : '#4a352a';
    ctx.save();
    ctx.globalAlpha = 0.88;
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.moveTo(0, -h / 2);
    ctx.lineTo(w / 2, 0);
    ctx.lineTo(0, h / 2);
    ctx.lineTo(-w / 2, 0);
    ctx.closePath();
    ctx.fillStyle = top;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-w / 2, 0);
    ctx.lineTo(0, h / 2);
    ctx.lineTo(0, h / 2 + d);
    ctx.lineTo(-w / 2, d);
    ctx.closePath();
    ctx.fillStyle = left;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(w / 2, 0);
    ctx.lineTo(0, h / 2);
    ctx.lineTo(0, h / 2 + d);
    ctx.lineTo(w / 2, d);
    ctx.closePath();
    ctx.fillStyle = right;
    ctx.fill();
    ctx.strokeStyle = 'rgba(66, 60, 82, .12)';
    ctx.stroke();
    ctx.restore();
  }

  private drawPickups(): void {
    const ctx = this.ctx;
    for (const p of this.pickups) {
      const pulse = 0.72 + Math.sin(p.pulse) * 0.22;
      const radius = p.radius * pulse;
      ctx.save();
      ctx.translate(p.x, p.y);

      ctx.globalAlpha = 0.28 * pulse;
      ctx.shadowColor = '#8c7a4e';
      ctx.shadowBlur = 22;
      ctx.strokeStyle = '#8c7a4e';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, radius + 8, 0, Math.PI * 2);
      ctx.stroke();

      ctx.globalAlpha = 0.92;
      ctx.shadowBlur = 14;
      ctx.fillStyle = '#8c7a4e';
      ctx.beginPath();
      ctx.moveTo(0, -radius * 1.4);
      ctx.lineTo(radius, 0);
      ctx.lineTo(0, radius * 1.4);
      ctx.lineTo(-radius, 0);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#cfc6b8';
      ctx.globalAlpha = 0.55 * pulse;
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.moveTo(0, -radius * 0.6);
      ctx.lineTo(radius * 0.42, 0);
      ctx.lineTo(0, radius * 0.6);
      ctx.lineTo(-radius * 0.42, 0);
      ctx.closePath();
      ctx.fill();

      ctx.globalAlpha = 0.8;
      ctx.fillStyle = '#7c4633';
      const arm = radius * 0.28;
      const thick = radius * 0.18;
      ctx.fillRect(-thick / 2, -arm, thick, arm * 2);
      ctx.fillRect(-arm, -thick / 2, arm * 2, thick);

      ctx.restore();
    }
  }

  private drawMotes(): void {
    const ctx = this.ctx;
    ctx.save();
    for (const mote of this.motes) {
      ctx.globalAlpha = 0.58;
      ctx.fillStyle = mote.color;
      ctx.beginPath();
      ctx.arc(mote.x, mote.y, mote.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawPlayer(): void {
    const ctx = this.ctx;
    const p = this.player;
    const flicker = p.invulnerable > 0 && Math.floor(p.invulnerable * 14) % 2 ? 0.48 : 1;

    // Kite body: classic diamond silhouette with a cross-spar and a
    // curling tail. Rotated so the nose always points along `aim`, the
    // same angle the laser fires along, so the shot always visibly comes
    // from the kite's nose.
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.aim + Math.PI / 2);
    ctx.globalAlpha = flicker;
    ctx.shadowColor = 'rgba(106, 93, 143, .42)';
    ctx.shadowBlur = 18;

    const top = -22;
    const bottom = 16;
    const side = 15;
    const waist = -2;

    // Tail: bowed ribbon with alternating bows, trailing below the kite.
    ctx.strokeStyle = 'rgba(140, 122, 78, .65)';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(0, bottom);
    const tailWave = Math.sin(this.elapsed * 5) * 5;
    ctx.quadraticCurveTo(8 + tailWave, bottom + 12, 0, bottom + 24);
    ctx.quadraticCurveTo(-8 - tailWave, bottom + 36, 0, bottom + 48);
    ctx.stroke();
    for (const t of [12, 24, 36]) {
      const bx = Math.sin(this.elapsed * 5 + t * 0.3) * (6 + tailWave * 0.4);
      ctx.beginPath();
      ctx.ellipse(bx, bottom + t, 4, 2.2, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(124, 70, 51, .5)';
      ctx.stroke();
    }

    // Left and right sail panels (two-tone diamond fabric).
    ctx.strokeStyle = '#3a3540';
    ctx.lineWidth = 1.8;

    ctx.fillStyle = '#cfc6b8';
    ctx.beginPath();
    ctx.moveTo(0, top);
    ctx.quadraticCurveTo(-side * 0.6, waist, -side, bottom * 0.55);
    ctx.lineTo(0, bottom);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#a89c86';
    ctx.beginPath();
    ctx.moveTo(0, top);
    ctx.quadraticCurveTo(side * 0.6, waist, side, bottom * 0.55);
    ctx.lineTo(0, bottom);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Central spine and cross-spar, revealing the kite's frame.
    ctx.strokeStyle = 'rgba(58, 53, 64, .55)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, top);
    ctx.lineTo(0, bottom);
    ctx.moveTo(-side, bottom * 0.55);
    ctx.lineTo(side, bottom * 0.55);
    ctx.stroke();

    // Hub accent where the spars cross.
    ctx.fillStyle = '#7c4633';
    ctx.beginPath();
    ctx.arc(0, waist, 2.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private drawSentries(): void {
    const ctx = this.ctx;
    for (const sentry of this.sentries) {
      ctx.save();
      ctx.translate(sentry.x, sentry.y);
      ctx.rotate(this.elapsed * 1.4 + sentry.phase);
      ctx.shadowColor = sentry.elite ? 'rgba(236, 195, 111, .6)' : 'rgba(124, 200, 190, .58)';
      ctx.shadowBlur = 16;
      ctx.fillStyle = sentry.elite ? '#8c7a4e' : '#3d5652';
      ctx.strokeStyle = '#cfc6b8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, -sentry.radius);
      ctx.lineTo(sentry.radius, 0);
      ctx.lineTo(0, sentry.radius);
      ctx.lineTo(-sentry.radius, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = sentry.elite ? '#3a3540' : '#7c4633';
      ctx.beginPath();
      ctx.arc(0, 0, sentry.radius * 0.34, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      this.drawHealthBar(
        sentry.x,
        sentry.y - sentry.radius - 10,
        sentry.radius * 2,
        sentry.health / sentry.maxHealth,
        sentry.elite ? '#8c7a4e' : '#3d5652'
      );
    }
  }

  private drawMonoliths(): void {
    const ctx = this.ctx;
    for (const stone of this.monoliths) {
      ctx.save();
      ctx.translate(stone.x, stone.y);
      ctx.rotate(stone.rotation);
      this.drawIsoBlock(0, 0, stone.radius * 2.2, stone.radius * 1.4, stone.radius * 1.8, 0.42);
      ctx.restore();
    }
  }

  private drawBeams(): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.lineCap = 'round';
    for (const beam of this.beams) {
      const alpha = clamp(beam.life / 0.09, 0, 1);
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = '#cfc6b8';
      ctx.lineWidth = 9;
      ctx.shadowColor = '#7c4633';
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.moveTo(beam.sx, beam.sy);
      ctx.lineTo(beam.ex, beam.ey);
      ctx.stroke();
      ctx.strokeStyle = '#7c4633';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(beam.sx, beam.sy);
      ctx.lineTo(beam.ex, beam.ey);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawShards(): void {
    const ctx = this.ctx;
    for (const shard of this.shards) {
      ctx.save();
      ctx.globalAlpha = clamp(shard.life / 0.55, 0, 1);
      ctx.translate(shard.x, shard.y);
      ctx.rotate(shard.rotation);
      ctx.fillStyle = shard.color;
      ctx.fillRect(-shard.size / 2, -shard.size / 2, shard.size, shard.size);
      ctx.restore();
    }
  }

  private drawHealthBar(x: number, y: number, width: number, percent: number, color: string): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.fillStyle = 'rgba(52, 65, 79, .14)';
    ctx.fillRect(x - width / 2, y, width, 4);
    ctx.fillStyle = color;
    ctx.fillRect(x - width / 2, y, width * clamp(percent, 0, 1), 4);
    ctx.restore();
  }

  // ── Input helpers ────────────────────────────────────────────────

  private getMovementInput(): { x: number; y: number } {
    const { keys, touch } = this.input;
    const left = keys.has('arrowleft') || keys.has('a') || touch.has('left');
    const right = keys.has('arrowright') || keys.has('d') || touch.has('right');
    const up = keys.has('arrowup') || keys.has('w') || touch.has('up');
    const down = keys.has('arrowdown') || keys.has('s') || touch.has('down');
    let x = Number(right) - Number(left);
    let y = Number(down) - Number(up);
    const length = Math.hypot(x, y);
    if (length > 0) {
      x /= length;
      y /= length;
    }
    return { x, y };
  }

  private isFiring(): boolean {
    return this.fireHeld || this.input.touch.has('fire') || this.input.pointer.active;
  }

  private handleKeyDown(key: string): void {
    if ((key === 'p' || key === 'escape') && this.mode === 'playing') {
      this.requestPause();
      return;
    }
    if ((key === 'p' || key === 'escape') && this.mode === 'paused') {
      this.requestResume();
      return;
    }
    if (key === ' ' || key === 'enter') this.fireHeld = true;
    if (this.mode === 'menu' && (key === 'enter' || key === ' ')) this.startRun();
  }

  private handleKeyUp(key: string): void {
    if (key === ' ' || key === 'enter') this.fireHeld = false;
  }

  private publishHud(): void {
    this.callbacks.onHudChange({
      score: Math.round(this.score),
      wave: this.wave,
      health: Math.ceil(this.health),
      laserReady: this.laserCooldown <= 0,
      chargeFraction: clamp(1 - this.laserCooldown / LASER_COOLDOWN, 0, 1)
    });
  }
}
