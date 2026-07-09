/**
 * InputManager
 *
 * Centralizes keyboard, pointer and virtual touch-button state so game
 * engines never touch the DOM event system directly. One instance is
 * created per mounted game and torn down with `dispose()` on unmount,
 * which prevents the listener leaks that plagued the original inline
 * `<script>` based games.
 */
export class InputManager {
  readonly keys = new Set<string>();
  readonly touch = new Set<string>();
  readonly pointer = { x: 0, y: 0, active: false };

  private target: Window;
  private onKeyDown = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    if (this.preventDefaultKeys.has(key)) event.preventDefault();
    this.keys.add(key);
    this.keyDownCallback?.(key, event);
  };
  private onKeyUp = (event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    this.keys.delete(key);
    this.keyUpCallback?.(key, event);
  };
  private onBlur = () => {
    this.keys.clear();
    this.touch.clear();
    this.pointer.active = false;
    this.blurCallback?.();
  };

  private preventDefaultKeys: Set<string>;
  private keyDownCallback?: (key: string, event: KeyboardEvent) => void;
  private keyUpCallback?: (key: string, event: KeyboardEvent) => void;
  private blurCallback?: () => void;

  constructor(target: Window = window, preventDefaultKeys: string[] = []) {
    this.target = target;
    this.preventDefaultKeys = new Set(preventDefaultKeys);
    this.target.addEventListener('keydown', this.onKeyDown as EventListener, { passive: false });
    this.target.addEventListener('keyup', this.onKeyUp as EventListener);
    this.target.addEventListener('blur', this.onBlur);
  }

  onKeyDownEvent(callback: (key: string, event: KeyboardEvent) => void): void {
    this.keyDownCallback = callback;
  }

  onKeyUpEvent(callback: (key: string, event: KeyboardEvent) => void): void {
    this.keyUpCallback = callback;
  }

  onWindowBlur(callback: () => void): void {
    this.blurCallback = callback;
  }

  setTouch(control: string, active: boolean): void {
    if (active) this.touch.add(control);
    else this.touch.delete(control);
  }

  isDown(...keys: string[]): boolean {
    return keys.some((key) => this.keys.has(key));
  }

  dispose(): void {
    this.target.removeEventListener('keydown', this.onKeyDown as EventListener);
    this.target.removeEventListener('keyup', this.onKeyUp as EventListener);
    this.target.removeEventListener('blur', this.onBlur);
    this.keys.clear();
    this.touch.clear();
  }
}
