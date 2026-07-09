/**
 * SplitPanelController
 *
 * Encapsulates the accessibility and touch-interaction behavior for the
 * landing page's split panels: Enter/Space toggles expansion for keyboard
 * users, and a tap-to-expand affordance activates on touch-only devices.
 */
export class SplitPanelController {
  private readonly media: MediaQueryList;
  private readonly onTouchModeChange: (isTouchOnly: boolean) => void;
  private readonly listener: (event: MediaQueryListEvent) => void;

  constructor(onTouchModeChange: (isTouchOnly: boolean) => void) {
    this.onTouchModeChange = onTouchModeChange;
    this.media = window.matchMedia('(hover: none)');
    this.listener = (event) => this.onTouchModeChange(event.matches);
    this.media.addEventListener('change', this.listener);
    this.onTouchModeChange(this.media.matches);
  }

  isTouchOnly(): boolean {
    return this.media.matches;
  }

  dispose(): void {
    this.media.removeEventListener('change', this.listener);
  }
}
