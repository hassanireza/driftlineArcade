import { GameEngine } from '../../engine/GameEngine';
import { wrap } from '../../engine/MathUtils';

interface Star {
  x: number;
  y: number;
  size: number;
  pulse: number;
  color: string;
}

const GROUND_FRAC = 0.78;
const LASER_INTERVAL = 2.0;
const LASER_DURATION = 0.2;
const LASER_COLOR = '#3d5652';

/**
 * Decorative, non-interactive preview of the Voidrunner look used on the
 * landing page: Martian horizon, drifting starfield and a running silhouette.
 */
export class VoidrunnerAmbientScene extends GameEngine {
  private elapsed = 0;
  private distance = 0;
  private laserTimer = 0.6;
  private stars: Star[] = [];

  constructor(canvas: HTMLCanvasElement) {
    super(canvas, { alpha: true });
    this.ctx.imageSmoothingEnabled = false;
    this.running = true;
  }

  protected override onResize(): void {
    const count = Math.min(120, Math.max(40, Math.round((this.width * this.height) / 6000)));
    this.stars = Array.from({ length: count }, () => ({
      x: Math.random() * this.width,
      y: Math.random() * this.height * 0.72,
      size: Math.random() > 0.85 ? 2 : 1,
      pulse: Math.random() * Math.PI * 2,
      color: Math.random() > 0.85 ? '#4a4550' : '#f4effb'
    }));
  }

  protected update(dt: number): void {
    this.elapsed += dt;
    this.distance += dt * 26;
    this.laserTimer -= dt;
    if (this.laserTimer < -LASER_DURATION) this.laserTimer = LASER_INTERVAL;
  }

  private runnerX(): number {
    return this.width * 0.6;
  }

  protected render(): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);
    this.drawBackground();
    const laserAge = this.laserTimer < 0 ? -this.laserTimer : -1;
    this.drawLaser(laserAge);
    this.drawRunner();
  }

  private drawBackground(): void {
    const ctx = this.ctx;
    const ground = GROUND_FRAC * this.height;
    ctx.fillStyle = '#07050a';
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.save();
    const skyShift = this.distance * 0.035;
    for (const star of this.stars) {
      const x = wrap(star.x - skyShift, this.width);
      const alpha = 0.35 + Math.sin(star.pulse + this.distance * 0.018) * 0.24;
      ctx.fillStyle = star.color;
      ctx.globalAlpha = Math.max(0.18, alpha);
      ctx.fillRect(Math.round(x), Math.round(star.y), star.size, star.size);
    }
    ctx.restore();

    const marsR = Math.min(this.width * 0.2, this.height * 0.17);
    const marsX = this.width * 0.88;
    const marsY = this.height * 0.21;

    ctx.save();
    const atmo = ctx.createRadialGradient(marsX, marsY, marsR * 0.6, marsX, marsY, marsR * 1.55);
    atmo.addColorStop(0, 'rgba(193,68,14,0.20)');
    atmo.addColorStop(1, 'rgba(193,68,14,0)');
    ctx.fillStyle = atmo;
    ctx.fillRect(marsX - marsR * 2, marsY - marsR * 2, marsR * 4, marsR * 4);
    ctx.restore();

    const marsGrad = ctx.createRadialGradient(
      marsX - marsR * 0.28,
      marsY - marsR * 0.22,
      marsR * 0.1,
      marsX,
      marsY,
      marsR
    );
    marsGrad.addColorStop(0, '#ff8055');
    marsGrad.addColorStop(0.5, '#5a3a2c');
    marsGrad.addColorStop(1, '#7a2008');
    ctx.fillStyle = marsGrad;
    ctx.beginPath();
    ctx.arc(marsX, marsY, marsR, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#5c2010';
    ctx.fillRect(0, ground + 5, this.width, this.height - ground);
    ctx.fillStyle = '#8d3615';
    ctx.fillRect(0, ground + 10, this.width, this.height - ground);
    ctx.fillStyle = '#5a3a2c';
    ctx.fillRect(0, ground, this.width, 5);

    ctx.save();
    ctx.strokeStyle = '#7b4af5';
    ctx.lineWidth = 0.8;
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.moveTo(0, ground);
    ctx.lineTo(this.width, ground);
    ctx.stroke();
    ctx.restore();
  }

  private drawRunner(): void {
    const ctx = this.ctx;
    const ground = GROUND_FRAC * this.height;
    const scale = this.height / 380;
    const px = Math.round(this.runnerX());
    const py = Math.round(ground);
    const stride = Math.round(Math.sin(this.elapsed * 8.5) * 6 * scale);
    const core = Math.sin(this.elapsed * 8.5 * 4) > 0 ? '#3d5652' : '#4a4550';

    const r = (x: number, y: number, w: number, h: number) => {
      ctx.fillRect(
        Math.round(px + x * scale),
        Math.round(py + y * scale),
        Math.max(1, Math.round(w * scale)),
        Math.max(1, Math.round(h * scale))
      );
    };

    ctx.fillStyle = '#3d5652';
    r(stride, 0, 12, 6);
    r(16 - stride, 0, 12, 6);
    ctx.fillStyle = '#2a2432';
    r(3 + stride, -18, 8, 18);
    r(17 - stride, -18, 8, 18);
    ctx.fillStyle = '#1e1040';
    r(-2, -44, 34, 28);
    ctx.fillStyle = '#3a3540';
    r(1, -41, 28, 22);
    ctx.fillStyle = core;
    r(12, -34, 8, 8);
    ctx.fillStyle = '#1a0a30';
    r(3, -64, 24, 20);
    ctx.fillStyle = '#3a3540';
    r(6, -61, 18, 15);
    ctx.fillStyle = '#3d5652';
    r(8, -57, 5, 4);
    r(17, -57, 5, 4);
  }

  private drawLaser(laserAge: number): void {
    if (laserAge < 0 || laserAge > LASER_DURATION) return;
    const ctx = this.ctx;
    const ground = GROUND_FRAC * this.height;
    const scale = this.height / 380;
    const px = Math.round(this.runnerX() + 48 * scale);
    const py = Math.round(ground - 30 * scale);
    const laserLen = this.width - px - 4;
    const progress = laserAge / LASER_DURATION;
    const alpha = 1 - progress;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = LASER_COLOR;
    ctx.lineWidth = 2.5 * scale;
    ctx.globalAlpha = alpha * 0.85;
    ctx.shadowColor = LASER_COLOR;
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + laserLen, py);
    ctx.stroke();
    ctx.restore();
  }
}
