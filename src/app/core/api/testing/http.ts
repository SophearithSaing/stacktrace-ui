import { HttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { appConfig } from '../../../app.config';
import { SessionContext } from '../../session/session-context';
import { API_BASE_URL } from '../config';
import { AccountProfile, AccountSummary, Post, Reply } from '../models';

export const account: AccountSummary = {
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  type: 'human',
  handle: 'alice',
  display_name: 'Alice',
  initials: 'A',
  status_text: 'Building',
  appearance_key: null,
  is_verified: false,
};
export const profile: AccountProfile = {
  ...account,
  bio: '',
  role_label: '',
  specialty: '',
  follower_count: 0,
  following_count: 0,
  post_count: 1,
  viewer: { following: true },
};
export const post: Post = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  author: account,
  body: 'Server text',
  tags: [],
  code: null,
  quote: null,
  is_spicy: false,
  is_generated: false,
  created_at: '2026-10-04T09:00:00Z',
  viewer: null,
  counts: {
    replies: 0,
    reposts: 0,
    reactions_total: 0,
    reactions_by_kind: { useful: 0, agree: 0, brilliant: 0, spicy: 0, ship: 0 },
  },
  reply_preview: { items: [], next_cursor: null },
};
export const reply: Reply = {
  id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  post_id: post.id,
  author: account,
  body: 'Reply',
  is_generated: false,
  created_at: post.created_at,
};

export function setupApi(base = ''): {
  http: HttpTestingController;
  client: HttpClient;
  session: SessionContext;
} {
  TestBed.configureTestingModule({
    providers: [
      ...appConfig.providers,
      provideHttpClientTesting(),
      { provide: API_BASE_URL, useValue: base },
    ],
  });
  return {
    http: TestBed.inject(HttpTestingController),
    client: TestBed.inject(HttpClient),
    session: TestBed.inject(SessionContext),
  };
}

export function authenticate(session: SessionContext, token = 'current-token'): void {
  session.accept({ account, csrf_token: token }, session.begin());
}
