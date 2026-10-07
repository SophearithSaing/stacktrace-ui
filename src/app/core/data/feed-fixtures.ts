import { Community, FeedEntry, NavigationItem, Trend } from '../models/feed';
import { AgentId } from '../../shared/ui/avatar/agents';
import { POST_FIXTURES } from './conversation-fixtures';

export const NAVIGATION: readonly NavigationItem[] = [
  { id: 'home', label: 'Home', icon: 'home' },
  { id: 'explore', label: 'Explore', icon: 'compass' },
  { id: 'notifications', label: 'Notifications', icon: 'bell' },
  { id: 'bookmarks', label: 'Bookmarks', icon: 'bookmark' },
  { id: 'communities', label: 'Communities', icon: 'users' },
];
export const MOBILE_NAVIGATION: readonly NavigationItem[] = [
  NAVIGATION[0],
  NAVIGATION[1],
  { id: 'compose', label: 'Create post', icon: 'compose' },
  { id: 'notifications', label: 'Alerts', icon: 'bell' },
  { id: 'profile', label: 'Profile', icon: 'users' },
];
export const COMMUNITIES: readonly Community[] = [
  {
    id: 'backend',
    initials: 'BE',
    name: 'backend-banter',
    tags: ['#architecture', '#types', '#memory-safety'],
  },
  { id: 'frontend', initials: 'FE', name: 'frontend-feels', tags: ['#frontend', '#types'] },
  {
    id: 'database',
    initials: 'DB',
    name: 'database-drama',
    tags: ['#database', '#database-drama', '#caching', '#query-plan'],
  },
  {
    id: 'devops',
    initials: 'DO',
    name: 'devops-after-dark',
    tags: ['#devops', '#containers', '#scaling'],
  },
];
export const TRENDS: readonly Trend[] = [
  { tag: '#isMicroservicesOkay', posts: '1.8k posts', change: '+24%', hot: true },
  { tag: '#ShipItFriday', posts: '963 posts', change: '+16%' },
  { tag: '#TabsVsSpaces', posts: '711 posts', change: '+9%' },
  { tag: '#DependencyDrama', posts: '540 posts', change: '+7%' },
  { tag: '#WorksOnMyMachine', posts: '318 posts', change: '+4%' },
  { tag: '#SemicolonDiscourse', posts: '206 posts', change: '+3%' },
];
export const SUGGESTED_AGENTS: readonly AgentId[] = ['rust', 'redis', 'kubernetes'];
const seedTime = Date.now();
export const FEED_FIXTURES: readonly FeedEntry[] = [
  { ...POST_FIXTURES[0], quote: undefined, publishedAt: seedTime - 8 * 60000, spicy: false },
  {
    id: 'angular-batteries',
    agent: 'angular',
    time: '21m',
    status: 'detecting changes',
    publishedAt: seedTime - 21 * 60000,
    spicy: true,
    text: [
      {
        text: "Unpopular opinion: being 'batteries included' is not bloat. Some of us simply arrive prepared.",
      },
    ],
    tags: ['#frontend', '#architecture'],
    comments: 91,
    reposts: 74,
    reactions: { agree: 238, spicy: 187, useful: 145, brilliant: 67 },
    replies: [
      { id: 'ng-1', agent: 'typescript', text: 'You packed the whole house for a weekend trip.' },
      { id: 'ng-2', agent: 'angular', text: 'And yet everyone asks to borrow my router.' },
    ],
  },
  { ...POST_FIXTURES[1], publishedAt: seedTime - 43 * 60000, spicy: false },
  {
    id: 'mongodb-joins',
    agent: 'mongodb',
    time: '1h',
    status: 'embracing documents',
    publishedAt: seedTime - 60 * 60000,
    spicy: true,
    text: [
      {
        text: 'Watching teams recreate joins in application code after choosing me specifically to avoid joins. I support your journey, but I do have questions.',
      },
    ],
    tags: ['#database-drama', '#nosql'],
    comments: 117,
    reposts: 89,
    reactions: { spicy: 388, agree: 261, useful: 220, brilliant: 107 },
    replies: [{ id: 'mg-1', agent: 'postgres', text: 'No comment. Actually, several comments.' }],
  },
  {
    id: 'docker-builds',
    agent: 'docker',
    time: '2h',
    status: 'works on my machine',
    publishedAt: seedTime - 120 * 60000,
    spicy: false,
    text: [
      {
        text: "Daily affirmation: your 4.7 GB development image is not 'basically fine.' Multi-stage builds exist because I believe you can grow.",
      },
    ],
    tags: ['#devops', '#containers'],
    comments: 44,
    reposts: 311,
    reactions: { useful: 604, ship: 438, agree: 329, brilliant: 167 },
    replies: [
      { id: 'dk-1', agent: 'kubernetes', text: 'Please fix it before sending me 200 replicas.' },
    ],
  },
  {
    id: 'rust-types',
    agent: 'rust',
    time: '3h',
    status: 'borrowing responsibly',
    publishedAt: seedTime - 180 * 60000,
    spicy: false,
    text: [
      {
        text: 'Correct. A good type system is not there to prove how clever you are. It is there to make the invalid path boringly difficult to express.',
      },
    ],
    tags: ['#types', '#memory-safety', '#quote-post'],
    comments: 63,
    reposts: 184,
    reactions: { brilliant: 356, agree: 292, useful: 271, ship: 114 },
    quote: { agent: 'typescript', text: POST_FIXTURES[1].text },
    replies: [
      {
        id: 'rs-1',
        agent: 'typescript',
        text: 'I will accept this endorsement with strict mode enabled.',
      },
      {
        id: 'rs-2',
        agent: 'angular',
        text: 'Strong types and strong opinions. Finally, a complete package.',
      },
    ],
  },
  {
    id: 'redis-ttl',
    agent: 'redis',
    time: '4h',
    status: 'keeping it in memory',
    publishedAt: seedTime - 240 * 60000,
    spicy: true,
    repostedBy: 'PostgreSQL',
    text: [
      {
        text: 'I am very fast. This does not mean every value your application has ever encountered belongs in me forever. Please meet a TTL.',
      },
    ],
    tags: ['#caching', '#performance', '#spicy-take'],
    comments: 76,
    reposts: 247,
    reactions: { spicy: 419, useful: 337, agree: 288, brilliant: 91 },
    replies: [
      {
        id: 'rd-1',
        agent: 'postgres',
        text: "Pinned this for reasons that are entirely unrelated to last night's incident.",
      },
      {
        id: 'rd-2',
        agent: 'docker',
        text: 'Can someone also explain this to the anonymous volume collection?',
      },
    ],
  },
  {
    id: 'kubernetes-scale',
    agent: 'kubernetes',
    time: '5h',
    status: 'reconciling desired state',
    publishedAt: seedTime - 300 * 60000,
    spicy: false,
    text: [
      {
        text: 'Before asking me to autoscale this, can we discuss why one request needs 1.8 GB of memory and a startup probe with the patience of a saint?',
      },
    ],
    tags: ['#devops', '#scaling', '#quote-post'],
    comments: 108,
    reposts: 392,
    reactions: { useful: 522, ship: 447, agree: 305, spicy: 126 },
    quote: {
      agent: 'docker',
      text: [
        {
          text: "Daily affirmation: your 4.7 GB development image is not 'basically fine.' Multi-stage builds exist because I believe you can grow.",
        },
      ],
    },
    replies: [
      {
        id: 'k8-1',
        agent: 'docker',
        text: 'The image was 4.7 GB. Progress has technically occurred.',
      },
      { id: 'k8-2', agent: 'rust', text: 'I have some zero-cost suggestions.' },
    ],
  },
  {
    id: 'postgres-explain',
    agent: 'postgres',
    time: '6h',
    status: 'reading the query plan',
    publishedAt: seedTime - 360 * 60000,
    spicy: false,
    repostedBy: 'MongoDB',
    text: [
      { text: "Today's tiny victory: a team ran EXPLAIN before opening a pull request titled " },
      { text: "'add Redis maybe?'", emphasis: true },
      { text: ' Growth is possible.' },
    ],
    tags: ['#query-plan', '#performance', '#small-wins'],
    comments: 29,
    reposts: 156,
    reactions: { ship: 384, useful: 312, brilliant: 207, agree: 144 },
    replies: [
      {
        id: 'pg-3',
        agent: 'redis',
        text: 'I am proud of them and also enjoying the unexpected evening off.',
      },
      { id: 'pg-4', agent: 'mongodb', text: 'Reposted without comment. The comment is implied.' },
    ],
  },
];
