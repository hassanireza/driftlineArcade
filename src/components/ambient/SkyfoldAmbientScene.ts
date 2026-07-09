import { GameEngine } from '../../engine/GameEngine';

interface Mote {
  x: number;
  y: number;
  size: number;
  speed: number;
  color: string;
}

interface Terrace {
  x: number;
  y: number;
  w: number;
  h: number;
  d: number;
  speed: number;
  hue: number;
}

const LASER_INTERVAL = 2.2;
const LASER_DURATION = 0.18;

/**
 * Decorative, non-interactive preview of the Skyfold Aviary look used on
 * the landing page. Extends the same GameEngine base as the real games so
 * lifecycle and resize handling stay consistent across the whole app.
 */
export class SkyfoldAmbientScene extends GameEngine {
  private elapsed = 0;
  private laserTimer = 0.8;
  private motes: Mote[] = [];
  private terraces: Terrace[] = [];

  constructor(canvas: HTMLCanvasElement) {
    super(canvas, { alpha: true });
    this.running = true;
  }

  protected override onResize(): void {
    const moteCount = Math.min(70, Math.max(28, Math.round((this.width * this.height) / 14000)));
    this.motes = Array.from({ length: moteCount }, () => this.makeMote(true));
    const terraceCount = Math.max(7, Math.round(this.height / 100));
    this.terraces = Array.from({ length: terraceCount }, () => this.makeTerrace(true));
  }

  private makeMote(anyY: boolean): Mote {
    return {
      x: Math.random() * this.width,
      y: anyY ? Math.random() * this.height : -6,
      size: Math.random() * 2.4 + 0.8,
      speed: Math.random() * 30 + 14,
      color: Math.random() > 0.5 ? '#cfc6b8' : '#6b5348'
    };
  }

  private makeTerrace(anyY: boolean): Terrace {
    return {
      x: Math.random() * this.width,
      y: anyY ? Math.random() * this.height : -this.height * 0.08,
      w: Math.random() * 120 + 90,
      h: Math.random() * 38 + 28,
      d: Math.random() * 44 + 28,
      speed: Math.random() * 18 + 10,
      hue: Math.random()
    };
  }

  protected update(dt: number): void {
    this.elapsed += dt;
    this.laserTimer -= dt;
    if (this.laserTimer < -LASER_DURATION) this.laserTimer = LASER_INTERVAL;

    for (const mote of this.motes) {
      mote.y += mote.speed * dt;
      if (mote.y > this.height + 4) Object.assign(mote, this.makeMote(false));
    }
    for (const terrace of this.terraces) {
      terrace.y += terrace.speed * dt;
      if (terrace.y > this.height + 6) Object.assign(terrace, this.makeTerrace(false));
    }
  }

  private gliderPos(t: number): { px: number; py: number; aim: number } {
    return {
      px: this.width * 0.42 + Math.sin(t * 0.38) * this.width * 0.06,
      py: this.height * 0.46 + Math.cos(t * 0.52) * this.height * 0.04,
      aim: -Math.PI / 2 + Math.sin(t * 0.45) * 0.18
    };
  }

  protected render(): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    const gradient = ctx.createLinearGradient(0, 0, 0, this.height);
    gradient.addColorStop(0, '#0b0a09');
    gradient.addColorStop(0.38, '#12181a');
    gradient.addColorStop(0.72, '#0c1416');
    gradient.addColorStop(1, '#050605');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.save();
    ctx.globalAlpha = 0.1;
    ctx.strokeStyle = '#cfc6b8';
    ctx.lineWidth = 1;
    const gap = 72;
    const offset = (this.elapsed * 15) % gap;
    for (let y = -gap + offset; y < this.height + gap; y += gap) {
      ctx.beginPath();
      ctx.moveTo(-40, y);
      ctx.lineTo(this.width + 40, y - 45);
      ctx.stroke();
    }
    ctx.restore();

    for (const terrace of this.terraces) this.drawIsoBlock(terrace);
    ctx.save();
    for (const mote of this.motes) {
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = mote.color;
      ctx.beginPath();
      ctx.arc(mote.x, mote.y, mote.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    const laserAge = this.laserTimer < 0 ? -this.laserTimer : -1;
    this.drawBeam(laserAge);
    this.drawGlider();
  }

  private drawIsoBlock(terrace: Terrace): void {
    const ctx = this.ctx;
    const { x, y, w, h, d, hue } = terrace;
    const top = hue > 0.66 ? '#cfc6b8' : hue > 0.33 ? '#b8bdb2' : '#c4bcae';
    const left = hue > 0.66 ? '#4a3540' : hue > 0.33 ? '#2e4440' : '#4a3a2c';
    const right = hue > 0.66 ? '#3a3540' : hue > 0.33 ? '#24393a' : '#4a352a';
    ctx.save();
    ctx.globalAlpha = 0.82;
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
    ctx.strokeStyle = 'rgba(66,60,82,0.12)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  private drawGlider(): void {
    const ctx = this.ctx;
    const { px, py } = this.gliderPos(this.elapsed);
    const bank = Math.sin(this.elapsed * 0.4) * 0.2;

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(bank);
    ctx.shadowColor = 'rgba(106,93,143,0.42)';
    ctx.shadowBlur = 18;

    const top = -22;
    const bottom = 16;
    const side = 15;
    const waist = -2;

    // Curling tail
    ctx.strokeStyle = 'rgba(140,122,78,.65)';
    ctx.lineWidth = 1.6;
    const tailWave = Math.sin(this.elapsed * 5) * 5;
    ctx.beginPath();
    ctx.moveTo(0, bottom);
    ctx.quadraticCurveTo(8 + tailWave, bottom + 12, 0, bottom + 24);
    ctx.quadraticCurveTo(-8 - tailWave, bottom + 36, 0, bottom + 48);
    ctx.stroke();

    // Diamond sail, two panels
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

    ctx.strokeStyle = 'rgba(58,53,64,.55)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, top);
    ctx.lineTo(0, bottom);
    ctx.moveTo(-side, bottom * 0.55);
    ctx.lineTo(side, bottom * 0.55);
    ctx.stroke();

    ctx.fillStyle = '#7c4633';
    ctx.beginPath();
    ctx.arc(0, waist, 2.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private drawBeam(laserAge: number): void {
    if (laserAge < 0 || laserAge > LASER_DURATION) return;
    const ctx = this.ctx;
    const { px, py, aim } = this.gliderPos(this.elapsed);
    const progress = laserAge / LASER_DURATION;
    const alpha = (1 - progress) * 0.85;
    const beamLen = 100 + Math.sin(this.elapsed * 1.1) * 15;

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(aim + Math.PI / 2);
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#e09040';
    ctx.lineWidth = 5;
    ctx.globalAlpha = alpha * 0.35;
    ctx.shadowColor = '#e09040';
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.moveTo(0, -22);
    ctx.lineTo(0, -22 - beamLen);
    ctx.stroke();
    ctx.lineWidth = 2.5;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.moveTo(0, -22);
    ctx.lineTo(0, -22 - beamLen);
    ctx.stroke();
    ctx.restore();
  }
}
