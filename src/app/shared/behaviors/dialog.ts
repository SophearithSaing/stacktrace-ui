import { DOCUMENT } from '@angular/common';
import { DestroyRef, Directive, ElementRef, afterRenderEffect, inject, model } from '@angular/core';

@Directive({
  selector: 'dialog[appDialog]',
  host: {
    '(cancel)': 'onCancel($event)',
    '(close)': 'onClose()',
    '(click)': 'onBackdrop($event)',
    '(keydown)': 'onKeydown($event)',
  },
})
export class Dialog {
  readonly open = model(false, { alias: 'appDialog' });
  private readonly element = inject<ElementRef<HTMLDialogElement>>(ElementRef);
  private readonly document = inject(DOCUMENT);
  private previousFocus: HTMLElement | null = null;
  private readonly renderEffect = afterRenderEffect(this.syncDialog.bind(this));
  private readonly cleanup = inject(DestroyRef).onDestroy(this.destroy.bind(this));

  /**
   * Synchronizes modal state after the dialog and its content have rendered.
   */
  private syncDialog(): void {
    const dialog = this.element.nativeElement;
    if (this.open() && !dialog.open) {
      this.previousFocus = this.document.activeElement as HTMLElement | null;
      dialog.showModal?.();
      dialog.querySelector<HTMLElement>('[data-dialog-initial-focus]')?.focus();
    } else if (!this.open() && dialog.open) {
      dialog.close?.();
      this.restoreFocus();
    }
  }

  /**
   * Restores the connected opener and clears the retained reference.
   */
  private restoreFocus(): void {
    const previous = this.previousFocus;
    this.previousFocus = null;
    if (previous?.isConnected) {
      previous.focus({ preventScroll: true });
    }
  }

  /**
   * Cleans up modal state and restores focus when its view is destroyed.
   */
  private destroy(): void {
    if (this.element.nativeElement.open) {
      this.element.nativeElement.close?.();
    }
    this.restoreFocus();
  }

  /**
   * Handles native Escape cancellation through controlled state.
   *
   * @param event Native dialog cancellation event.
   */
  protected onCancel(event: Event): void {
    event.preventDefault();
    this.open.set(false);
  }

  /**
   * Reconciles native closure with the consumer's model.
   */
  protected onClose(): void {
    if (!this.element.nativeElement.open) {
      this.open.set(false);
      this.restoreFocus();
    }
  }

  /**
   * Dismisses clicks truly outside the dialog rectangle, not empty content.
   *
   * @param event Pointer activation on the native dialog.
   */
  protected onBackdrop(event: MouseEvent): void {
    const dialog = this.element.nativeElement;
    const rect = dialog.getBoundingClientRect();
    if (
      event.target === dialog &&
      (event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom)
    ) {
      this.open.set(false);
    }
  }

  /**
   * Keeps Tab within modal controls, including reverse traversal.
   *
   * @param event Dialog keyboard event.
   */
  protected onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Tab' || !this.open()) {
      return;
    }
    const items = Array.from(
      this.element.nativeElement.querySelectorAll<HTMLElement>(
        'button:not(:disabled), a[href], input:not(:disabled):not([type="hidden"]), ' +
          'select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
      ),
    ).filter(this.isFocusable.bind(this));
    const first = items[0];
    const last = items[items.length - 1];
    if (!first) {
      event.preventDefault();
      this.element.nativeElement.focus();
    } else if (event.shiftKey && this.document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && this.document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  /**
   * Excludes hidden, inert, and programmatically focused controls from Tab.
   *
   * @param item Candidate control in the dialog.
   * @returns Whether the control can participate in keyboard traversal.
   */
  private isFocusable(item: HTMLElement): boolean {
    if (item.tabIndex < 0 || item.closest('[hidden], [inert]')) {
      return false;
    }
    const styles = this.document.defaultView?.getComputedStyle(item);
    return styles?.display !== 'none' && styles?.visibility !== 'hidden';
  }
}
