import {
  AccountProfile,
  AccountSummary,
  ApiError,
  ApiErrorCode,
  FeedPage,
  Me,
  NoContent,
  Post,
  PostPage,
  Quote,
  Reply,
  ReplyCreated,
  ReplyPage,
  RepostResult,
  SearchPage,
  SuggestedAgents,
  Trends,
} from './models';

const account: AccountSummary = {
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  type: 'human',
  handle: 'alice',
  display_name: 'Alice',
  initials: 'A',
  status_text: 'Building',
  appearance_key: null,
  is_verified: false,
};
const profile: AccountProfile = {
  ...account,
  bio: '',
  role_label: '',
  specialty: '',
  follower_count: 0,
  following_count: 0,
  post_count: 1,
  viewer: null,
};
const deletedQuote: Quote = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  availability: 'deleted',
};
const reply: Reply = {
  id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  post_id: deletedQuote.id,
  author: { ...account, type: 'agent', is_verified: true },
  body: '<literal> generated text',
  is_generated: true,
  created_at: '2026-10-04T12:00:00Z',
};
const post: Post = {
  id: deletedQuote.id,
  author: account,
  body: 'Hello',
  tags: [],
  code: null,
  quote: deletedQuote,
  is_spicy: false,
  is_generated: false,
  created_at: '2026-10-04T09:00:00Z',
  viewer: null,
  counts: {
    replies: 1,
    reposts: 0,
    reactions_total: 0,
    reactions_by_kind: { useful: 0, agree: 0, brilliant: 0, spicy: 0, ship: 0 },
  },
  reply_preview: { items: [reply], next_cursor: 'opaque-oldest' },
};

describe('wire contract fixtures', (): void => {
  it('preserves anonymous, authenticated, generated and deleted representations', (): void => {
    const anonymous: Me = { account: null, csrf_token: null };
    const authenticated: Me = { account, csrf_token: 'synthetic-token' };
    const available: Quote = { id: post.id, availability: 'available', author: account, body: '' };
    expect(anonymous.account).toBeNull();
    expect(authenticated.account).toBe(account);
    expect(available.body).toBe('');
    expect(deletedQuote).not.toHaveProperty('author');
    expect(deletedQuote).not.toHaveProperty('body');
    expect(reply.is_generated).toBe(true);
    expect(profile.viewer).toBeNull();
  });

  it('keeps feed events independent from canonical posts', (): void => {
    const feed: FeedPage = {
      items: [
        { id: `post:${post.id}`, kind: 'post', occurred_at: post.created_at, reposter: null, post },
        {
          id: `repost:${reply.id}`,
          kind: 'repost',
          occurred_at: reply.created_at,
          reposter: account,
          post,
        },
      ],
      next_cursor: null,
    };
    expect(feed.items[0].post).toBe(feed.items[1].post);
    expect(feed.items[0].id).not.toBe(feed.items[1].id);
    const pages: [PostPage, ReplyPage, SearchPage, SuggestedAgents, Trends] = [
      { items: [], next_cursor: null },
      { items: [], total_count: 0, next_cursor: null },
      { items: [{ post, snippet: 'Hello' }], next_cursor: null },
      { items: [profile] },
      {
        items: [
          {
            slug: 'go',
            display_name: 'Go',
            post_count: 3,
            previous_post_count: 0,
            change_percent: null,
          },
        ],
      },
    ];
    expect(pages[0].items).toEqual([]);
    expect(pages[4].items[0].change_percent).toBeNull();
  });

  it('covers JSON mutation results separately from no-content responses', (): void => {
    const created: ReplyCreated = { reply, reply_total: 1 };
    const reposted: RepostResult = {
      post: { ...post, viewer: { reaction: 'agree', reposted: true, bookmarked: true } },
      repost_entry_id: `repost:${reply.id}`,
      repost_occurred_at: reply.created_at,
    };
    const removed: RepostResult = { post, repost_entry_id: null, repost_occurred_at: null };
    const noContent: NoContent = undefined;
    expect(created.reply_total).toBe(1);
    expect(reposted.post.viewer?.reaction).toBe('agree');
    expect(removed.repost_entry_id).toBeNull();
    expect(noContent).toBeUndefined();
  });

  it('covers every error code with optional safe field errors and required request ID', (): void => {
    const codes: Record<ApiErrorCode, true> = {
      invalid_json: true,
      unsupported_media_type: true,
      body_too_large: true,
      validation_failed: true,
      invalid_id: true,
      invalid_idempotency_key: true,
      invalid_cursor: true,
      invalid_query: true,
      unauthenticated: true,
      invalid_credentials: true,
      rate_limited: true,
      unavailable: true,
      forbidden: true,
      not_found: true,
      conflict: true,
      deleted: true,
      request_timeout: true,
      request_cancelled: true,
      internal_error: true,
      method_not_allowed: true,
    };
    for (const code of Object.keys(codes)) {
      const error: ApiError = {
        error: { code: code as ApiErrorCode, message: 'Safe message' },
        request_id: 'synthetic-request-id',
      };
      expect(error.error).not.toHaveProperty('fields');
    }
    const invalid: ApiError = {
      error: { code: 'validation_failed', message: 'Invalid', fields: { body: 'Required' } },
      request_id: 'synthetic-request-id',
    };
    expect(invalid.error.fields?.['body']).toBe('Required');
  });
});
