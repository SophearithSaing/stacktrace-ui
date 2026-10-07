import { DOCUMENT } from '@angular/common';
import { Directive, ElementRef, afterRenderEffect, inject, model } from '@angular/core';

@Directive({
  selector: '[appMenu]',
  host: {
    '(click)': 'onClick($event)',
    '(keydown)': 'onKeydown($event)',
    '(focusout)': 'onFocusOut($event)',
    '(document:pointerdown)': 'onOutsidePointer($event)',
    '(window:resize)': 'positionPanel()',
    '(window:scroll)': 'positionPanel()',
  },
})
export class Menu {
  readonly open = model(false, { alias: 'appMenu' });
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly document = inject(DOCUMENT);
  private lastItem = false;
  private readonly renderEffect = afterRenderEffect(this.focusPanel.bind(this));

  /**
   * Resolves enabled menu choices from projected content.
   *
   * @returns Focusable menu items in DOM order.
   */
  private items(): HTMLElement[] {
    return Array.from(
      this.host.nativeElement.querySelectorAll<HTMLElement>(
        '[role="menuitem"], [role="menuitemradio"]',
      ),
    ).filter(this.isEnabled.bind(this));
  }

  /**
   * Tests whether an item can participate in menu navigation.
   *
   * @param item Menu choice to inspect.
   * @returns Whether the item is enabled and visible.
   */
  private isEnabled(item: HTMLElement): boolean {
    return (
      !item.hasAttribute('disabled') &&
      item.getAttribute('aria-disabled') !== 'true' &&
      !item.closest('[hidden]')
    );
  }

  /**
   * Focuses the initial choice only after the panel has rendered.
   */
  private focusPanel(): void {
    if (this.open()) {
      const items = this.items();
      items[this.lastItem ? items.length - 1 : 0]?.focus();
      this.positionPanel();
    }
  }

  /**
   * Shifts the panel inside the viewport without changing design dimensions.
   */
  protected positionPanel(): void {
    if (!this.open()) {
      return;
    }
    const panel = this.host.nativeElement.querySelector<HTMLElement>('[role="menu"]');
    const window = this.document.defaultView;
    if (!panel || !window) {
      return;
    }
    panel.style.setProperty('--menu-shift', '0px');
    panel.style.removeProperty('--menu-top');
    panel.style.removeProperty('--menu-bottom');
    panel.style.removeProperty('--menu-available-height');
    const bounds = panel.getBoundingClientRect();
    const shift =
      bounds.right > window.innerWidth
        ? window.innerWidth - bounds.right
        : Math.max(0, -bounds.left);
    panel.style.setProperty('--menu-shift', shift + 'px');
    const anchor = this.host.nativeElement.getBoundingClientRect();
    const gap = Math.max(0, anchor.top - bounds.bottom);
    const above = Math.max(0, anchor.top - gap);
    const below = Math.max(0, window.innerHeight - anchor.bottom - gap);
    const placeBelow = bounds.height > above && below > above;
    if (placeBelow) {
      panel.style.setProperty('--menu-top', 'calc(100% + var(--popover-offset))');
      panel.style.setProperty('--menu-bottom', 'auto');
    }
    panel.style.setProperty('--menu-available-height', (placeBelow ? below : above) + 'px');
  }

  /**
   * Dismisses the menu and optionally restores its trigger's focus.
   *
   * @param restoreFocus Whether focus should return to the trigger.
   */
  private close(restoreFocus = true): void {
    this.open.set(false);
    if (restoreFocus) {
      this.host.nativeElement.querySelector<HTMLElement>('[data-menu-trigger]')?.focus();
    }
  }

  /**
   * Opens from the trigger or closes after an enabled choice is activated.
   *
   * @param event Click inside the menu scope.
   */
  protected onClick(event: MouseEvent): void {
    const target = (event.target as Element).closest<HTMLElement>(
      '[data-menu-trigger], [role="menuitem"], [role="menuitemradio"]',
    );
    if (!target || !this.isEnabled(target)) {
      return;
    }
    if (target.hasAttribute('data-menu-trigger')) {
      this.lastItem = false;
      this.open.set(!this.open());
    } else {
      this.close();
    }
  }

  /**
   * Implements menu opening, wrapped arrows, Home/End, Tab, and Escape.
   *
   * @param event Keyboard interaction in the menu scope.
   */
  protected onKeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement;
    if (target.closest('[data-menu-trigger]') && ['ArrowDown', 'ArrowUp'].includes(event.key)) {
      event.preventDefault();
      this.lastItem = event.key === 'ArrowUp';
      this.open.set(true);
      return;
    }
    if (!this.open()) {
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.close();
      return;
    }
    if (event.key === 'Tab') {
      this.close();
      return;
    }
    const items = this.items();
    if (
      !items.length ||
      !['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)
    ) {
      return;
    }
    event.preventDefault();
    const current = items.indexOf(this.document.activeElement as HTMLElement);
    let next = current;
    switch (event.key) {
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = items.length - 1;
        break;
      case 'ArrowDown':
      case 'ArrowRight':
        next = (current + 1) % items.length;
        break;
      default:
        next = (current - 1 + items.length) % items.length;
    }
    items[next]?.focus();
  }

  /**
   * Dismisses when keyboard focus leaves the menu scope.
   *
   * @param event Focus transition from a descendant.
   */
  protected onFocusOut(event: FocusEvent): void {
    if (!this.host.nativeElement.contains(event.relatedTarget as Node | null)) {
      this.close(false);
    }
  }

  /**
   * Dismisses on outside pointer interaction without stealing focus.
   *
   * @param event Document pointer event.
   */
  protected onOutsidePointer(event: PointerEvent): void {
    if (!this.host.nativeElement.contains(event.target as Node | null)) {
      this.close(false);
    }
  }
}
