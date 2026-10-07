import { Component, signal } from '@angular/core';
import { Dialog } from './dialog';
import { element, press, render } from '../ui/testing/component-fixture';

@Component({
  imports: [Dialog],
  template: `
    @if (showOpener()) {
      <button (click)="open.set(true)" id="opener">Open</button>
    }
    <div #fallback id="fallback" tabindex="-1">Conversation</div>
    <dialog [(appDialog)]="open" [appDialogFocusFallback]="fallback" aria-label="Test dialog">
      <button data-dialog-initial-focus>First</button><button>Last</button>
      <div hidden><button>Hidden</button></div>
      <button tabindex="-1">Programmatic</button>
    </dialog>
  `,
})
class DialogHost {
  readonly open = signal(false);
  readonly showOpener = signal(true);
}

describe('Dialog behavior', (): void => {
  let showDescriptor: PropertyDescriptor | undefined;
  let closeDescriptor: PropertyDescriptor | undefined;

  beforeEach((): void => {
    const prototype = HTMLDialogElement.prototype;
    showDescriptor = Object.getOwnPropertyDescriptor(prototype, 'showModal');
    closeDescriptor = Object.getOwnPropertyDescriptor(prototype, 'close');
    Object.defineProperty(prototype, 'showModal', {
      configurable: true,
      value: function (this: HTMLDialogElement): void {
        this.open = true;
      },
    });
    Object.defineProperty(prototype, 'close', {
      configurable: true,
      value: function (this: HTMLDialogElement): void {
        this.open = false;
        this.dispatchEvent(new Event('close'));
      },
    });
  });

  afterEach((): void => {
    const prototype = HTMLDialogElement.prototype;
    if (showDescriptor) {
      Object.defineProperty(prototype, 'showModal', showDescriptor);
    } else {
      Reflect.deleteProperty(prototype, 'showModal');
    }
    if (closeDescriptor) {
      Object.defineProperty(prototype, 'close', closeDescriptor);
    } else {
      Reflect.deleteProperty(prototype, 'close');
    }
  });

  it('sets initial focus, contains Tab, and restores the connected opener', async (): Promise<void> => {
    const fixture = await render(DialogHost);
    const opener = element<HTMLButtonElement>(fixture, '#opener');
    opener.focus();
    opener.click();
    fixture.detectChanges();
    await fixture.whenStable();
    const dialog = element<HTMLDialogElement>(fixture, 'dialog');
    const buttons = dialog.querySelectorAll<HTMLButtonElement>('button');
    expect(dialog.open).toBe(true);
    expect(document.activeElement).toBe(buttons[0]);
    buttons[1].focus();
    expect(press(buttons[1], 'Tab').defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(buttons[0]);
    buttons[0].dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Tab',
        shiftKey: true,
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(document.activeElement).toBe(buttons[1]);
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(dialog.open).toBe(false);
    expect(fixture.componentInstance.open()).toBe(false);
    expect(document.activeElement).toBe(opener);
  });

  it('distinguishes backdrop clicks from blank content and reconciles native close', async (): Promise<void> => {
    const fixture = await render(DialogHost);
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    const dialog = element<HTMLDialogElement>(fixture, 'dialog');
    vi.spyOn(dialog, 'getBoundingClientRect').mockReturnValue({
      left: 10,
      right: 100,
      top: 10,
      bottom: 100,
    } as DOMRect);
    dialog.dispatchEvent(new MouseEvent('click', { clientX: 50, clientY: 50, bubbles: true }));
    expect(fixture.componentInstance.open()).toBe(true);
    dialog.dispatchEvent(new MouseEvent('click', { clientX: 5, clientY: 5, bubbles: true }));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(dialog.open).toBe(false);
    fixture.componentInstance.open.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    dialog.close();
    expect(fixture.componentInstance.open()).toBe(false);
    fixture.destroy();
    vi.restoreAllMocks();
  });

  it('restores fallback focus when an open dialog loses its opener', async (): Promise<void> => {
    const fixture = await render(DialogHost);
    const opener = element<HTMLButtonElement>(fixture, '#opener');
    opener.focus();
    opener.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.componentInstance.showOpener.set(false);
    fixture.detectChanges();
    const dialog = element<HTMLDialogElement>(fixture, 'dialog');
    expect(opener.isConnected).toBe(false);
    expect(dialog.contains(document.activeElement)).toBe(true);
    dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(dialog.open).toBe(false);
    expect(document.activeElement).toBe(element(fixture, '#fallback'));
  });

  it('restores focus only once across controlled and delayed native closure', async (): Promise<void> => {
    const fixture = await render(DialogHost);
    const opener = element<HTMLButtonElement>(fixture, '#opener');
    opener.focus();
    opener.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.componentInstance.open.set(false);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(document.activeElement).toBe(opener);
    element(fixture, 'dialog').dispatchEvent(new Event('close'));
    expect(document.activeElement).toBe(opener);
  });
});
