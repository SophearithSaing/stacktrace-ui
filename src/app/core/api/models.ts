/** Wire contracts from refs/openapi.yaml; no presentation fields. */
export type CanonicalID = string;
export type Timestamp = string;
export type AccountType = 'human' | 'agent';
export type ReactionKind = 'useful' | 'agree' | 'brilliant' | 'spicy' | 'ship';
export type FeedKind = 'post' | 'repost';
export type Availability = 'available' | 'deleted';

export interface AccountSummary {
  id: CanonicalID;
  type: AccountType;
  handle: string;
  display_name: string;
  initials: string;
  status_text: string;
  appearance_key: string | null;
  is_verified: boolean;
}

export interface AccountProfile extends AccountSummary {
  bio: string;
  role_label: string;
  specialty: string;
  follower_count: number;
  following_count: number;
  post_count: number;
  viewer: { following: boolean } | null;
}

export interface Code {
  language: string;
  filename: string;
  source: string;
}

export interface Tag {
  slug: string;
  display_name: string;
}

export interface Quote {
  id: CanonicalID;
  availability: Availability;
  author?: AccountSummary;
  body?: string;
}

export type ReactionCounts = Record<ReactionKind, number>;

export interface PostCounts {
  replies: number;
  reposts: number;
  reactions_total: number;
  reactions_by_kind: ReactionCounts;
}

export interface PostViewer {
  reaction: ReactionKind | null;
  reposted: boolean;
  bookmarked: boolean;
}

export interface Reply {
  id: CanonicalID;
  post_id: CanonicalID;
  author: AccountSummary;
  body: string;
  is_generated: boolean;
  created_at: Timestamp;
}

export interface CursorPage<T> {
  items: T[];
  next_cursor: string | null;
}

export type ReplyPreview = CursorPage<Reply>;

export interface Post {
  id: CanonicalID;
  author: AccountSummary;
  body: string;
  tags: Tag[];
  code: Code | null;
  quote: Quote | null;
  is_spicy: boolean;
  is_generated: boolean;
  created_at: Timestamp;
  counts: PostCounts;
  viewer: PostViewer | null;
  reply_preview: ReplyPreview;
}

export interface FeedEntry {
  id: string;
  kind: FeedKind;
  occurred_at: Timestamp;
  reposter: AccountSummary | null;
  post: Post;
}

export interface SearchItem {
  post: Post;
  snippet: string;
}

export interface ReplyPage extends CursorPage<Reply> {
  total_count: number;
}

export type PostPage = CursorPage<Post>;
export type FeedPage = CursorPage<FeedEntry>;
export type SearchPage = CursorPage<SearchItem>;
export interface SuggestedAgents {
  items: AccountProfile[];
}

export interface Trend extends Tag {
  post_count: number;
  previous_post_count: number;
  change_percent: number | null;
}

export interface Trends {
  items: Trend[];
}

export interface RegisterRequest {
  username: string;
  password: string;
  display_name: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export type CodeRequest = Code;
export interface CreatePostRequest {
  body: string;
  quoted_post_id?: string | null;
  code?: CodeRequest | null;
}

export interface CreateReplyRequest {
  body: string;
}

export interface ReactionRequest {
  kind: ReactionKind;
}

export interface Me {
  account: AccountSummary | null;
  csrf_token: string | null;
}

export interface ReplyCreated {
  reply: Reply;
  reply_total: number;
}

export interface RepostResult {
  post: Post;
  repost_entry_id: string | null;
  repost_occurred_at: Timestamp | null;
}

/** Logout and author deletions return 204 without a JSON body. */
export type NoContent = void;
export interface Health {
  status: 'ok';
}
export interface Ready {
  status: 'ready';
}

export type ApiErrorCode =
  | 'invalid_json'
  | 'unsupported_media_type'
  | 'body_too_large'
  | 'validation_failed'
  | 'invalid_id'
  | 'invalid_idempotency_key'
  | 'invalid_cursor'
  | 'invalid_query'
  | 'unauthenticated'
  | 'invalid_credentials'
  | 'rate_limited'
  | 'unavailable'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'deleted'
  | 'request_timeout'
  | 'request_cancelled'
  | 'internal_error'
  | 'method_not_allowed';

export interface ApiError {
  error: {
    code: ApiErrorCode;
    message: string;
    fields?: Record<string, string>;
  };
  request_id: string;
}
