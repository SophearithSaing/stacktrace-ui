import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL, apiUrl } from './config';
import {
  AccountProfile,
  CreatePostRequest,
  CreateReplyRequest,
  Post,
  ReactionKind,
  ReplyCreated,
  RepostResult,
} from './models';
import { serializeBody } from './serialization';

@Service()
export class CommandClient {
  private readonly http = inject(HttpClient);
  private readonly base = inject(API_BASE_URL);

  /**
   * Creates a post; subscriptions preserve the exact captured payload and key.
   * @param input Documented post fields only.
   * @param idempotencyKey Caller-owned key for this logical submission.
   * @returns Confirmed current post, not a historical replay snapshot.
   */
  createPost(input: CreatePostRequest, idempotencyKey: string): Observable<Post> {
    return this.http.post<Post>(apiUrl(this.base, 'posts'), serializeBody('post', input), {
      headers: creationHeaders(idempotencyKey),
    });
  }

  /**
   * Creates a reply without predicting generated output or reply totals.
   * @param postId Parent post UUID.
   * @param input Documented reply fields.
   * @param idempotencyKey Caller-owned key, preserved for retries.
   * @returns Confirmed reply and authoritative total.
   */
  createReply(
    postId: string,
    input: CreateReplyRequest,
    idempotencyKey: string,
  ): Observable<ReplyCreated> {
    return this.http.post<ReplyCreated>(
      apiUrl(this.base, `posts/${encodeURIComponent(postId)}/replies`),
      serializeBody('reply', input),
      { headers: creationHeaders(idempotencyKey) },
    );
  }

  /**
   * Deletes an author's post.
   * @param postId Resource UUID.
   * @returns Completion with no JSON response body.
   */
  deletePost(postId: string): Observable<void> {
    return this.http.delete<void>(apiUrl(this.base, `posts/${encodeURIComponent(postId)}`));
  }

  /**
   * Deletes an author's reply.
   * @param replyId Resource UUID.
   * @returns Completion with no JSON response body.
   */
  deleteReply(replyId: string): Observable<void> {
    return this.http.delete<void>(apiUrl(this.base, `replies/${encodeURIComponent(replyId)}`));
  }

  /**
   * Sets or clears the viewer's one reaction, never a server-side toggle.
   * @param postId Target post UUID.
   * @param kind Desired kind, or null to clear.
   * @returns Confirmed current post.
   */
  reaction(postId: string, kind: ReactionKind | null): Observable<Post> {
    const url = apiUrl(this.base, `posts/${encodeURIComponent(postId)}/reaction`);
    return kind === null
      ? this.http.delete<Post>(url)
      : this.http.put<Post>(url, serializeBody('reaction', { kind }), {
          headers: { 'Content-Type': 'application/json' },
        });
  }

  /**
   * Sets the desired repost state while retaining server event identity/time.
   * @param postId Target post UUID.
   * @param present Desired presence, not a toggle instruction.
   * @returns Confirmed post and nullable repost event metadata.
   */
  repost(postId: string, present: boolean): Observable<RepostResult> {
    const url = apiUrl(this.base, `posts/${encodeURIComponent(postId)}/repost`);
    return present ? this.http.put<RepostResult>(url, null) : this.http.delete<RepostResult>(url);
  }

  /**
   * Sets the desired private bookmark state.
   * @param postId Target post UUID.
   * @param present Desired presence, not a toggle instruction.
   * @returns Confirmed current post.
   */
  bookmark(postId: string, present: boolean): Observable<Post> {
    const url = apiUrl(this.base, `posts/${encodeURIComponent(postId)}/bookmark`);
    return present ? this.http.put<Post>(url, null) : this.http.delete<Post>(url);
  }

  /**
   * Sets the desired follow relationship.
   * @param accountId Target account UUID.
   * @param present Desired presence, not a toggle instruction.
   * @returns Confirmed profile and viewer relationship.
   */
  follow(accountId: string, present: boolean): Observable<AccountProfile> {
    const url = apiUrl(this.base, `accounts/${encodeURIComponent(accountId)}/follow`);
    return present
      ? this.http.put<AccountProfile>(url, null)
      : this.http.delete<AccountProfile>(url);
  }
}

/**
 * Validates the caller key and sets one creation key and JSON content type.
 * @param key Caller-owned logical submission key.
 * @returns Immutable creation headers.
 */
function creationHeaders(key: string): HttpHeaders {
  if (typeof key !== 'string' || !/^[A-Za-z0-9._:-]{1,128}$/.test(key)) {
    throw new RangeError('A valid caller-owned Idempotency-Key is required');
  }
  return new HttpHeaders({ 'Content-Type': 'application/json', 'Idempotency-Key': key });
}
