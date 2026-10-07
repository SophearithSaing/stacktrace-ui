import { EmptyState } from './empty-state';
import { element, render } from '../testing/component-fixture';

describe('EmptyState', (): void => {
  it('renders safe text without inventing a recovery action', async (): Promise<void> => {
    const fixture = await render(EmptyState, { title: '<b>No posts</b>' });
    expect(element(fixture, '.empty-state-title').textContent).toBe('<b>No posts</b>');
    expect((fixture.nativeElement as HTMLElement).querySelector('button')).toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelector('b')).toBeNull();
  });

  it('emits the supplied recovery action', async (): Promise<void> => {
    const fixture = await render(EmptyState, {
      title: 'No posts',
      description: 'Try another filter.',
      actionLabel: 'Reset filters',
    });
    const action = vi.fn();
    fixture.componentInstance.actionRequested.subscribe(action);
    element<HTMLButtonElement>(fixture, 'button').click();
    expect(action).toHaveBeenCalledOnce();
  });
});
