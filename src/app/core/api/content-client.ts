import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL, apiUrl } from './config';
import { AccountProfile, FeedPage, Post, PostPage, ReplyPage } from './models';
import { FeedQuery, PageQuery, RepliesQuery, serializeQuery } from './serialization';

@Service()
export class ContentClient {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);

  /**
   * Lists global feed events, not canonical post identities.
   * @param query Supported feed selection and cursor.
   * @returns Unmapped server feed page.
   */
  feed(query: FeedQuery = {}): Observable<FeedPage> {
    return this.http.get<FeedPage>(apiUrl(this.base, 'feed'), {
      params: serializeQuery('feed', query),
    });
  }

  /**
   * Reads a complete canonical post.
   * @param postId Resource UUID.
   * @returns Server post representation.
   */
  post(postId: string): Observable<Post> {
    return this.http.get<Post>(apiUrl(this.base, `posts/${encodeURIComponent(postId)}`));
  }

  /**
   * Lists replies with an authoritative visible total.
   * @param postId Parent post UUID.
   * @param query Reply ordering and cursor.
   * @returns Unmapped server reply page.
   */
  replies(postId: string, query: RepliesQuery = {}): Observable<ReplyPage> {
    return this.http.get<ReplyPage>(
      apiUrl(this.base, `posts/${encodeURIComponent(postId)}/replies`),
      {
        params: serializeQuery('replies', query),
      },
    );
  }

  /**
   * Lists the current viewer's private bookmarks.
   * @param query Viewer-bound pagination options.
   * @returns Server post page.
   */
  bookmarks(query: PageQuery = {}): Observable<PostPage> {
    return this.http.get<PostPage>(apiUrl(this.base, 'me/bookmarks'), {
      params: serializeQuery('bookmarks', query),
    });
  }

  /**
   * Reads a profile by canonical account ID.
   * @param accountId Resource UUID.
   * @returns Server profile representation.
   */
  profile(accountId: string): Observable<AccountProfile> {
    return this.http.get<AccountProfile>(
      apiUrl(this.base, `accounts/${encodeURIComponent(accountId)}`),
    );
  }

  /**
   * Reads a profile by its handle, without using it as a canonical ID.
   * @param handle Raw handle input accepted by the server.
   * @returns Server profile representation.
   */
  profileByHandle(handle: string): Observable<AccountProfile> {
    return this.http.get<AccountProfile>(
      apiUrl(this.base, `accounts/by-handle/${encodeURIComponent(handle)}`),
    );
  }

  /**
   * Lists account activity events.
   * @param accountId Target account UUID.
   * @param query Viewer/target-bound pagination options.
   * @returns Server feed event page.
   */
  accountFeed(accountId: string, query: PageQuery = {}): Observable<FeedPage> {
    return this.http.get<FeedPage>(
      apiUrl(this.base, `accounts/${encodeURIComponent(accountId)}/feed`),
      {
        params: serializeQuery('accountFeed', query),
      },
    );
  }
}
