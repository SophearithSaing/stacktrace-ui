import { QuickComposer } from './quick-composer';
import { element, render } from '../../../../shared/ui/testing/component-fixture';

describe('QuickComposer', (): void => {
  it('requests composition and labels unavailable attachment capabilities honestly', async (): Promise<void> => {
    const fixture = await render(QuickComposer);
    const compose = vi.fn();
    const unavailable = vi.fn();
    fixture.componentInstance.composeRequested.subscribe(compose);
    fixture.componentInstance.unavailableRequested.subscribe(unavailable);
    element<HTMLButtonElement>(fixture, '.quick-entry').click();
    expect(compose).toHaveBeenCalled();
    element<HTMLButtonElement>(fixture, '[aria-label="Code attachment unavailable"]').click();
    expect(unavailable).toHaveBeenCalledWith(expect.stringContaining('unavailable'));
  });
});
