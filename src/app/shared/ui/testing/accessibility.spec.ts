import { Type } from '@angular/core';
import axe from 'axe-core';
import { AgentIdentity } from '../agent-identity/agent-identity';
import { Avatar } from '../avatar/avatar';
import { Badge } from '../badge/badge';
import { Brand } from '../brand/brand';
import { EmptyState } from '../empty-state/empty-state';
import { FollowButton } from '../follow-button/follow-button';
import { Icon } from '../icon/icon';
import { ReplyInput } from '../reply-input/reply-input';
import { SearchField } from '../search-field/search-field';
import { Tabs } from '../tabs/tabs';
import { Toast } from '../toast/toast';
import { render, element, type } from './component-fixture';

interface Scenario {
  readonly name: string;
  readonly component: Type<unknown>;
  readonly inputs: Record<string, unknown>;
}

const scenarios: readonly Scenario[] = [
  { name: 'Icon', component: Icon, inputs: { name: 'search', label: 'Search' } },
  { name: 'Brand', component: Brand, inputs: {} },
  { name: 'Avatar', component: Avatar, inputs: { interactive: true } },
  { name: 'Badge', component: Badge, inputs: { variant: 'verified' } },
  {
    name: 'AgentIdentity',
    component: AgentIdentity,
    inputs: { agent: 'postgres', verified: true, interactive: true },
  },
  {
    name: 'FollowButton',
    component: FollowButton,
    inputs: { agentName: 'PostgreSQL', following: true },
  },
  { name: 'SearchField', component: SearchField, inputs: { id: 'accessible-search' } },
  { name: 'ReplyInput', component: ReplyInput, inputs: { id: 'accessible-reply' } },
  {
    name: 'Tabs',
    component: Tabs,
    inputs: { id: 'accessible-tabs', items: [{ id: 'you', label: 'For you' }] },
  },
  {
    name: 'EmptyState',
    component: EmptyState,
    inputs: { title: 'No posts', actionLabel: 'Reset filters' },
  },
  { name: 'Toast', component: Toast, inputs: { message: 'Saved', open: true, duration: 0 } },
];

const options: axe.RunOptions = {
  rules: { 'color-contrast': { enabled: false } },
};

describe('Primitive accessibility', (): void => {
  beforeEach((): void => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  });

  afterEach((): void => {
    vi.restoreAllMocks();
  });

  it.each(scenarios)('$name has no structural axe violations', async (scenario): Promise<void> => {
    const fixture = await render(scenario.component, scenario.inputs);
    const result = await axe.run(fixture.nativeElement as HTMLElement, options);
    expect(result.violations).toEqual([]);
  });

  it('search results have accessible combobox semantics', async (): Promise<void> => {
    const fixture = await render(SearchField, {
      id: 'results-search',
      results: [{ id: 'pg', label: 'PostgreSQL' }],
    });
    type(element<HTMLInputElement>(fixture, 'input'), 'pg');
    fixture.detectChanges();
    const result = await axe.run(fixture.nativeElement as HTMLElement, options);
    expect(result.violations).toEqual([]);
  });

  it('empty search results have accessible combobox semantics', async (): Promise<void> => {
    const fixture = await render(SearchField, { id: 'empty-search' });
    type(element<HTMLInputElement>(fixture, 'input'), 'missing');
    fixture.detectChanges();
    const result = await axe.run(fixture.nativeElement as HTMLElement, options);
    expect(result.violations).toEqual([]);
  });
});
