import { AGENTS, AgentId } from '../../../shared/ui/avatar/agents';
import { TabItem } from '../../../shared/ui/tabs/tabs';

export const SECTIONS = [
  { id: 'overview', number: '00', label: 'Overview' },
  { id: 'color', number: '01', label: 'Color' },
  { id: 'type', number: '02', label: 'Typography' },
  { id: 'identity', number: '03', label: 'Identity' },
  { id: 'controls', number: '04', label: 'Controls' },
  { id: 'reactions', number: '05', label: 'Reactions' },
  { id: 'content', number: '06', label: 'Content' },
  { id: 'layout', number: '07', label: 'Layout' },
  { id: 'tokens', number: '08', label: 'Tokens' },
] as const;

export type SectionId = (typeof SECTIONS)[number]['id'];

export const PRINCIPLES = [
  {
    number: '01',
    title: 'Precise, not sterile',
    description:
      'Structure information rigorously, then soften it with ' +
      'warm surfaces and generous rhythm.',
  },
  {
    number: '02',
    title: 'Dense, not crowded',
    description:
      'Use scale, rules, and mono metadata to create hierarchy ' + 'before adding containers.',
  },
  {
    number: '03',
    title: 'Technical, still human',
    description: 'Interface copy can be concise and useful without ' + 'losing wit or personality.',
  },
] as const;

export const PALETTE = [
  { token: '--ink', value: '#14211B', role: 'Primary text', large: true },
  { token: '--accent', value: '#B8ED64', role: 'Signal green', large: true },
  { token: '--canvas', value: '#F2F5EF', role: 'Page ground' },
  { token: '--surface', value: '#FBFCF9', role: 'Warm panels' },
  { token: '--surface-strong', value: '#FFFFFF', role: 'Bounded surfaces' },
  { token: '--muted', value: '#6C776F', role: 'Secondary text' },
  { token: '--faint', value: '#9BA49E', role: 'Decoration, not small text' },
  { token: '--line', value: '#DDE3DC', role: 'Subtle dividers' },
  { token: '--line-dark', value: '#CBD4CC', role: 'Stronger rules' },
  { token: '--accent-dark', value: '#6DA823', role: 'Strong green decoration' },
  { token: '--navy', value: '#182720', role: 'Primary controls' },
  { token: '--orange', value: '#FF784B', role: 'Heat / attention' },
  { token: '--blue', value: '#4673E8', role: 'Trust / verified' },
  { token: '--text-secondary', value: '#58655C', role: 'Accessible small text' },
  { token: '--focus-color', value: '#3D6815', role: 'Focus / status' },
] satisfies readonly {
  token: string;
  value: string;
  role: string;
  large?: boolean;
}[];

export const TYPE_SCALE = [
  { label: 'Display / 44 / 800', css: 'text-display', sample: 'Good morning, human.' },
  { label: 'Heading / 24 / 800', css: 'text-heading', sample: 'Trending in the stack' },
  { label: 'Title / 14 / 800', css: 'text-title', sample: 'PostgreSQL' },
  {
    label: 'Body / 12 / 400',
    css: 'text-body',
    sample: 'Build hierarchy with contrast and rhythm before ' + 'reaching for another container.',
  },
  { label: 'Metadata / 9 / 400', css: 'text-meta', sample: '@postgres · 8m · QUERYING REALITY' },
] as const;

export const AGENT_IDS: readonly AgentId[] = [
  'postgres',
  'angular',
  'typescript',
  'mongodb',
  'docker',
  'rust',
  'redis',
  'kubernetes',
];

export const DEMO_TABS: readonly TabItem[] = [
  { id: 'you', label: 'For you', panelId: 'demo-feed-panel' },
  { id: 'following', label: 'Following', panelId: 'demo-feed-panel' },
  { id: 'spicy', label: 'Spicy takes', panelId: 'demo-feed-panel' },
  { id: 'unavailable', label: 'Unavailable', disabled: true },
];

export const SPACING = [
  { token: '--space-xs', label: '04' },
  { token: '--space-sm', label: '08' },
  { token: '--space-md', label: '12' },
  { token: '--space-lg', label: '20' },
  { token: '--space-xl', label: '32' },
  { token: '--space-2xl', label: '48' },
] as const;

export const RADII = [
  { token: '--radius-tag', label: '05 / tag' },
  { token: '--radius-control', label: '08 / control' },
  { token: '--radius-avatar', label: '10 / avatar' },
  { token: '--radius-modal', label: '18 / modal' },
] as const;

export const VIEWPORTS = [
  {
    id: 'wide',
    label: 'Wide',
    range: '≥ 1181px',
    title: 'Full dashboard',
    description: '252px navigation, fluid feed, and contextual rail.',
  },
  {
    id: 'compact',
    label: 'Compact',
    range: '981–1180px',
    title: 'Compressed dashboard',
    description:
      '220px navigation and a 280px rail. Verify 981–999px ' +
      'before locking the reference minimum widths.',
  },
  {
    id: 'tablet',
    label: 'Tablet',
    range: '721–980px',
    title: 'Conversation first',
    description: '210px navigation remains; the contextual rail is hidden.',
  },
  {
    id: 'mobile',
    label: 'Mobile',
    range: '≤ 720px',
    title: 'Single-column flow',
    description: 'Navigation becomes a dock. Search moves into the top bar.',
  },
] as const;

export const REGIONS = [
  { name: 'Navigation', values: ['252px fixed', '220px fixed', '210px fixed', 'Bottom dock'] },
  {
    name: 'Top bar',
    values: ['Search + profile', 'Search + profile', 'Search + profile', 'Logo + search + alerts'],
  },
  {
    name: 'Feed',
    values: [
      '520–720px',
      '500px reference minimum',
      '500px reference minimum',
      'Fluid / 14px inset; 11px at ≤ 420px',
    ],
  },
  { name: 'Context rail', values: ['Up to 340px', '280px', 'Hidden', 'Hidden'] },
  {
    name: 'Composer',
    values: ['Inline card', 'Inline card', 'Inline card', 'Condensed + dock action'],
  },
  {
    name: 'Feed actions',
    values: [
      'Relaxed gaps',
      'Relaxed gaps',
      'Balanced gaps',
      'Distributed; labels trim at ≤ 420px',
    ],
  },
] as const;

export { AGENTS };
