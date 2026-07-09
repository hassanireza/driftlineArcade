/**
 * GameEngine
 *
 * Abstract base class providing the render loop, canvas sizing and
 * pause/resume lifecycle shared by every game in Driftline Arcade.
 * Concrete engines (SkyfoldEngine, VoidrunnerEngine) implement the
 * `update` and `render` hooks and stay focused purely on gameplay.
 */
export abstract class GameEngine {
  protected readonly canvas: HTMLCanvasElement;
  protected readonly ctx: CanvasRenderingContext2D;
  protected width = 1;
  protected height = 1;
  protected devicePixelRatioLimit = 2;

  private rafHandle = 0;
  private lastFrameTime = 0;
  private resizeObserver: ResizeObserver | null = null;
  private disposed = false;
  private readonly fixedSize: { width: number; height: number } | null;

  running = false;

  constructor(
    canvas: HTMLCanvasElement,
    contextOptions?: CanvasRenderingContext2DSettings,
    fixedSize?: { width: number; height: number }
  ) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', contextOptions ?? { alpha: false });
    if (!ctx) throw new Error('Canvas 2D context is not available in this browser.');
    this.ctx = ctx;
    this.fixedSize = fixedSize ?? null;
  }

  /** Called every tick while `running` is true. dt is in seconds. */
  protected abstract update(dt: number): void;

  /** Called every tick regardless of running state. */
  protected abstract render(): void;

  /** Called whenever the canvas box has meaningfully resized. */
  protected onResize(_oldWidth: number, _oldHeight: number): void {
    // Optional hook for subclasses.
  }

  mount(): void {
    this.resizeObserver = new ResizeObserver(() => this.resizeCanvas());
    this.resizeObserver.observe(this.canvas.parentElement ?? this.canvas);
    this.resizeCanvas();
    this.rafHandle = requestAnimationFrame((time) => {
      this.lastFrameTime = time;
      this.loop(time);
    });
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.rafHandle);
    this.resizeObserver?.disconnect();
  }

  start(): void {
    this.running = true;
    this.lastFrameTime = performance.now();
  }

  pause(): void {
    this.running = false;
  }

  resume(): void {
    this.running = true;
    this.lastFrameTime = performance.now();
  }

  private resizeCanvas(): void {
    if (this.fixedSize) {
      if (this.canvas.width !== this.fixedSize.width || this.canvas.height !== this.fixedSize.height) {
        this.canvas.width = this.fixedSize.width;
        this.canvas.height = this.fixedSize.height;
        this.width = this.fixedSize.width;
        this.height = this.fixedSize.height;
      }
      return;
    }
    const parent = this.canvas.parentElement;
    const rect = (parent ?? this.canvas).getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, this.devicePixelRatioLimit);
    const pixelWidth = Math.max(1, Math.floor(rect.width * dpr));
    const pixelHeight = Math.max(1, Math.floor(rect.height * dpr));

    if (this.canvas.width !== pixelWidth || this.canvas.height !== pixelHeight) {
      this.canvas.width = pixelWidth;
      this.canvas.height = pixelHeight;
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    const oldWidth = this.width;
    const oldHeight = this.height;
    this.width = Math.max(1, rect.width);
    this.height = Math.max(1, rect.height);

    if (Math.abs(oldWidth - this.width) > 0.5 || Math.abs(oldHeight - this.height) > 0.5) {
      this.onResize(oldWidth, oldHeight);
    }
  }

  private loop = (now: number): void => {
    if (this.disposed) return;
    this.resizeCanvas();
    const rawDt = (now - this.lastFrameTime) / 1000 || 0;
    const dt = Math.min(rawDt, 0.05);
    this.lastFrameTime = now;
    if (this.running) this.update(dt);
    this.render();
    this.rafHandle = requestAnimationFrame(this.loop);
  };
}
