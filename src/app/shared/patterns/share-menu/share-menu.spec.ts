import { ShareMenu } from './share-menu';
import { ShareIntent } from '../../models/conversation';
import { element, render } from '../../ui/testing/component-fixture';

describe('ShareMenu', (): void => {
  it('emits intents rather than assuming clipboard or native sharing succeeds', async (): Promise<void> => {
    const fixture = await render(ShareMenu, { id: 'share', variant: 'inline', reposted: true });
    const requested = vi.fn();
    fixture.componentInstance.intent.subscribe(requested);
    const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>(
      'button',
    );
    const intents: ShareIntent[] = ['repost', 'quote', 'external', 'copy'];
    for (const [index, button] of buttons.entries()) {
      button.click();
      expect(requested).toHaveBeenLastCalledWith(intents[index]);
    }
    expect(buttons[0].textContent).toContain('Undo repost');
  });

  it('closes after menu selection and restores focus', async (): Promise<void> => {
    const fixture = await render(ShareMenu, { id: 'share' });
    const trigger = element<HTMLButtonElement>(fixture, '[data-menu-trigger]');
    trigger.click();
    fixture.detectChanges();
    await fixture.whenStable();
    element<HTMLButtonElement>(fixture, '[role="menuitem"]').click();
    fixture.detectChanges();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(trigger);
  });

  it('disables all inline share intents', async (): Promise<void> => {
    const fixture = await render(ShareMenu, { id: 'share', variant: 'inline', disabled: true });
    const requested = vi.fn();
    fixture.componentInstance.intent.subscribe(requested);
    element<HTMLButtonElement>(fixture, 'button').click();
    expect(requested).not.toHaveBeenCalled();
  });
});
