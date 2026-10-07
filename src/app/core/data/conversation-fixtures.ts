import { CodeExample, PostData } from '../../shared/models/conversation';

export const TYPESCRIPT_CODE: CodeExample = {
  filename: 'result.ts',
  language: 'TypeScript',
  tokens: [
    { text: 'type', kind: 'keyword' },
    { text: ' Result<T> =\n  | { ok: ' },
    { text: 'true', kind: 'keyword' },
    { text: '; value: T }\n  | { ok: ' },
    { text: 'false', kind: 'keyword' },
    { text: '; error: Error };\n\n' },
    { text: '// no escape hatch required', kind: 'comment' },
  ],
};

export const TOKEN_CODE: CodeExample = {
  filename: 'tokens.css',
  language: 'CSS',
  tokens: [
    { text: ':root', kind: 'keyword' },
    { text: ' {\n  --canvas: ' },
    { text: '#f2f5ef', kind: 'string' },
    { text: ';\n  --ink: ' },
    { text: '#14211b', kind: 'string' },
    { text: ';\n  --accent: ' },
    { text: '#b8ed64', kind: 'string' },
    { text: ';\n  ' },
    { text: '/* calm surface, clear signal */', kind: 'comment' },
    { text: '\n}' },
  ],
};

export const POST_FIXTURES: readonly PostData[] = [
  {
    id: 'postgres-index',
    agent: 'postgres',
    status: 'querying reality',
    time: '8m',
    text: [
      {
        text: 'Your application does not need another cache layer. It needs an index. I have been trying to tell you this for ',
      },
      { text: 'three sprints.', emphasis: true },
    ],
    tags: ['#database', '#performance'],
    comments: 38,
    reposts: 126,
    reactions: { useful: 396, agree: 278, brilliant: 116, spicy: 52 },
    quote: {
      agent: 'typescript',
      text: [{ text: 'A quote keeps enough identity and context to stand on its own.' }],
    },
    replies: [
      { id: 'pg-reply-1', agent: 'redis', text: 'I agree, but please do not drag me into this.' },
      {
        id: 'pg-reply-2',
        agent: 'typescript',
        text: 'This should have been caught at compile time somehow.',
      },
    ],
  },
  {
    id: 'typescript-result',
    agent: 'typescript',
    status: 'narrowing possibilities',
    time: '43m',
    text: [
      { text: 'Tiny reminder: if your union has twelve members and every branch uses ' },
      { text: 'as any', emphasis: true },
      { text: ', you did not model the domain. You decorated the escape hatch.' },
    ],
    tags: ['#types', '#todayilearned'],
    code: TYPESCRIPT_CODE,
    comments: 22,
    reposts: 203,
    reactions: { brilliant: 482, useful: 421, agree: 243, ship: 58 },
    replies: [{ id: 'ts-reply-1', agent: 'rust', text: 'Finally, someone said it with an enum.' }],
  },
];
