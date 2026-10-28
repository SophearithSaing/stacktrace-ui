import { HttpParams } from '@angular/common/http';
import {
  CreatePostRequest,
  CreateReplyRequest,
  LoginRequest,
  ReactionRequest,
  RegisterRequest,
} from './models';

export const MAX_JSON_BYTES = 64 * 1024;

export interface RequestBodies {
  register: RegisterRequest;
  login: LoginRequest;
  post: CreatePostRequest;
  reply: CreateReplyRequest;
  reaction: ReactionRequest;
}

export interface PageQuery {
  limit?: number;
  cursor?: string;
}

export interface FeedQuery extends PageQuery {
  view?: 'for-you' | 'following' | 'spicy';
  sort?: 'newest' | 'relevant' | 'reacted';
  tag?: string;
}

export interface RepliesQuery extends PageQuery {
  sort?: 'oldest' | 'newest';
}

export interface SearchQuery extends PageQuery {
  q: string;
}

export interface RequestQueries {
  feed: FeedQuery;
  replies: RepliesQuery;
  bookmarks: PageQuery;
  accountFeed: PageQuery;
  search: SearchQuery;
  suggested: { limit?: number };
  trends: { limit?: number };
}

/**
 * Builds only documented body fields before measuring the exact JSON bytes.
 * Semantic field validation remains server-owned; text is never normalized.
 * @param kind Body contract to serialize.
 * @param input Typed caller payload, potentially containing extra properties.
 * @returns Exact JSON to send with Content-Type application/json.
 */
export function serializeBody<K extends keyof RequestBodies>(
  kind: K,
  input: RequestBodies[K],
): string {
  let body: object;
  switch (kind) {
    case 'register': {
      const value = input as RegisterRequest;
      body = {
        username: value.username,
        password: value.password,
        display_name: value.display_name,
      };
      break;
    }
    case 'login': {
      const value = input as LoginRequest;
      body = { username: value.username, password: value.password };
      break;
    }
    case 'post': {
      const value = input as CreatePostRequest;
      body = {
        body: value.body,
        ...(value.quoted_post_id !== undefined ? { quoted_post_id: value.quoted_post_id } : {}),
        ...(value.code !== undefined
          ? {
              code:
                value.code === null
                  ? null
                  : {
                      language: value.code.language,
                      filename: value.code.filename,
                      source: value.code.source,
                    },
            }
          : {}),
      };
      break;
    }
    case 'reply':
      body = { body: (input as CreateReplyRequest).body };
      break;
    case 'reaction':
      body = { kind: (input as ReactionRequest).kind };
      break;
    default:
      throw new Error('Unknown request body contract');
  }
  const json = JSON.stringify(body);
  if (new TextEncoder().encode(json).byteLength > MAX_JSON_BYTES) {
    throw new RangeError('JSON body exceeds 64 KiB');
  }
  return json;
}

/**
 * Builds an endpoint-specific query with one value per documented key.
 * @param kind Endpoint query contract.
 * @param input Typed selection; unknown keys are never copied.
 * @returns Immutable Angular HTTP parameters.
 */
export function serializeQuery<K extends keyof RequestQueries>(
  kind: K,
  input: RequestQueries[K],
): HttpParams {
  let params = new HttpParams();
  const maximum = kind === 'trends' ? 6 : kind === 'suggested' || kind === 'search' ? 20 : 50;
  if (input.limit !== undefined) {
    if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > maximum) {
      throw new RangeError(`Limit must be an integer from 1 to ${maximum}`);
    }
    params = params.set('limit', input.limit);
  }
  if (kind !== 'suggested' && kind !== 'trends') {
    const cursor = (input as PageQuery).cursor;
    if (cursor !== undefined && cursor !== '') {
      if (typeof cursor !== 'string' || [...cursor].length > 2048) {
        throw new RangeError('Invalid cursor');
      }
      params = params.set('cursor', cursor);
    }
  }
  if (kind === 'feed') {
    const value = input as FeedQuery;
    params = enumParam(params, 'view', value.view, ['for-you', 'following', 'spicy']);
    params = enumParam(params, 'sort', value.sort, ['newest', 'relevant', 'reacted']);
    if (value.tag !== undefined && value.tag !== '') {
      if (typeof value.tag !== 'string' || !/^[A-Za-z0-9_]{1,64}$/.test(value.tag)) {
        throw new RangeError('Invalid tag');
      }
      params = params.set('tag', value.tag);
    }
  }
  if (kind === 'replies') {
    params = enumParam(params, 'sort', (input as RepliesQuery).sort, ['oldest', 'newest']);
  }
  if (kind === 'search') {
    const query = (input as SearchQuery).q;
    if (typeof query !== 'string') {
      throw new RangeError('Search query must be a string');
    }
    const normalized = query.trim();
    const length = [...normalized].length;
    if (length < 2 || length > 100 || normalized.includes('\0')) {
      throw new RangeError('Search requires 2–100 code points and no NUL');
    }
    params = params.set('q', normalized);
  }
  return params;
}

/**
 * Adds one nonempty documented enumeration value.
 * @param params Existing parameters.
 * @param key Documented query name.
 * @param value Optional caller selection.
 * @param allowed Accepted wire values.
 * @returns Updated parameters, or the unchanged parameters for empty input.
 */
function enumParam(
  params: HttpParams,
  key: string,
  value: string | undefined,
  allowed: readonly string[],
): HttpParams {
  if (value === undefined || value === '') {
    return params;
  }
  if (!allowed.includes(value)) {
    throw new RangeError(`Invalid ${key}`);
  }
  return params.set(key, value);
}
