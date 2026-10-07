import { isPlatformBrowser } from '@angular/common';
import {
  Component,
  EffectCleanupRegisterFn,
  PLATFORM_ID,
  effect,
  inject,
  input,
  model,
  output,
} from '@angular/core';

export const TOAST_DURATION = 2200;

@Component({
  selector: 'app-toast',
  templateUrl: './toast.html',
  host: {
    role: 'status',
    'aria-live': 'polite',
    'aria-atomic': 'true',
  },
})
export class Toast {
  readonly message = input('');
  readonly open = model(false);
  readonly duration = input(TOAST_DURATION);
  readonly dismissed = output<void>();
  private readonly platform = inject(PLATFORM_ID);
  private readonly timerEffect = effect(this.scheduleDismissal.bind(this));

  /**
   * Schedules dismissal and cancels stale timers on changes or destruction.
   *
   * @param cleanup Registers cancellation with the effect lifecycle.
   */
  private scheduleDismissal(cleanup: EffectCleanupRegisterFn): void {
    const open = this.open();
    const message = this.message();
    const duration = this.duration();
    if (!open || !message || duration <= 0 || !isPlatformBrowser(this.platform)) {
      return;
    }
    const timer = setTimeout(this.dismiss.bind(this), duration);
    cleanup(clearTimeout.bind(null, timer));
  }

  /**
   * Closes the current toast without moving keyboard focus.
   */
  dismiss(): void {
    if (this.open()) {
      this.open.set(false);
      this.dismissed.emit();
    }
  }
}
