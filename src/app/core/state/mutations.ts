import { Service, inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { CommandClient } from '../api/command-client';
import { ApiFailure } from '../api/failure';
import {
  AccountProfile,
  CreatePostRequest,
  CreateReplyRequest,
  Post,
  ReactionKind,
  ReplyCreated,
  RepostResult,
} from '../api/models';
import { SessionContext } from '../session/session-context';
import { CommandExecutor, CommandResult } from './command-executor';
import { EntityStore } from './entity-store';

export type MutationTarget =
  { type: 'post' | 'account' | 'reply'; id: string } | { type: 'create-post' };

@Service()
export class Mutations {
  private readonly client = inject(CommandClient);
  private readonly executor = inject(CommandExecutor);
  private readonly entities = inject(EntityStore);
  private readonly session = inject(SessionContext);

  /**
   * Reads a resource lock shared by competing actions returning full snapshots.
   * @param target Canonical target, not a display theme or handle.
   * @returns Whether an action on this resource is pending.
   */
  pending(target: MutationTarget): boolean {
    return this.executor.pending(resourceKey(target));
  }

  /**
   * Reads normalized action feedback without private request payloads.
   * @param target Canonical resource target.
   * @returns Safe failure, or null.
   */
  failure(target: MutationTarget): ApiFailure | null {
    return this.executor.failure(resourceKey(target));
  }

  /**
   * Captures one logical post submission with a required caller-owned retry key.
   * @param input Draft content, never modified by the command.
   * @param key Idempotency key retained by the caller for uncertain retries.
   * @returns Explicit command attempt; only confirmation may clear a caller draft.
   */
  createPost(input: CreatePostRequest, key: string): Observable<CommandResult<Post>> {
    return this.attempt(
      { type: 'create-post' },
      'create-post',
      /** @returns Captured HTTP creation operation. */
      (): Observable<Post> => this.client.createPost(input, key),
      this.entities.reconcilePost.bind(this.entities),
    );
  }

  /**
   * Creates a reply under its parent lock, using the server's current total.
   * @param postId Parent canonical post ID.
   * @param input Reply draft, preserved on failure.
   * @param key Caller-owned logical submission key.
   * @returns Confirmed reply/total or a guarded failure outcome.
   */
  createReply(
    postId: string,
    input: CreateReplyRequest,
    key: string,
  ): Observable<CommandResult<ReplyCreated>> {
    return this.attempt(
      { type: 'post', id: postId },
      'create-reply',
      /** @returns Captured HTTP reply creation. */
      (): Observable<ReplyCreated> => this.client.createReply(postId, input, key),
      this.entities.reconcileReply.bind(this.entities),
    );
  }

  /**
   * Sets a desired reaction, never applying optimistic count deltas.
   * @param postId Canonical post ID.
   * @param kind Desired kind, or null to clear.
   * @returns Server-confirmed post state.
   */
  reaction(postId: string, kind: ReactionKind | null): Observable<CommandResult<Post>> {
    return this.attempt(
      { type: 'post', id: postId },
      'reaction',
      /** @returns Captured desired-state reaction operation. */
      (): Observable<Post> => this.client.reaction(postId, kind),
      this.entities.reconcilePost.bind(this.entities),
    );
  }

  /**
   * Sets private bookmark membership using the returned viewer state.
   * @param postId Canonical post ID.
   * @param present Desired bookmark presence.
   * @returns Server-confirmed post state.
   */
  bookmark(postId: string, present: boolean): Observable<CommandResult<Post>> {
    return this.attempt(
      { type: 'post', id: postId },
      'bookmark',
      /** @returns Captured desired-state bookmark operation. */
      (): Observable<Post> => this.client.bookmark(postId, present),
      this.entities.reconcilePost.bind(this.entities),
    );
  }

  /**
   * Sets repost state without synthesizing event IDs or occurrence times.
   * @param postId Canonical post ID.
   * @param present Desired repost presence.
   * @returns Server-confirmed post and event metadata.
   */
  repost(postId: string, present: boolean): Observable<CommandResult<RepostResult>> {
    return this.attempt(
      { type: 'post', id: postId },
      'repost',
      /** @returns Captured desired-state repost operation. */
      (): Observable<RepostResult> => this.client.repost(postId, present),
      this.applyRepost.bind(this),
    );
  }

  /**
   * Sets a relationship and reconciles the authoritative full profile.
   * @param accountId Canonical account ID.
   * @param present Desired follow presence.
   * @returns Confirmed profile, counts and viewer state.
   */
  follow(accountId: string, present: boolean): Observable<CommandResult<AccountProfile>> {
    return this.attempt(
      { type: 'account', id: accountId },
      'follow',
      /** @returns Captured desired-state follow operation. */
      (): Observable<AccountProfile> => this.client.follow(accountId, present),
      this.entities.putProfile.bind(this.entities),
    );
  }

  /**
   * Supplies deletion capability without introducing author-delete UI.
   * @param postId Canonical post ID.
   * @returns Confirmed 204 completion and cache invalidation.
   */
  deletePost(postId: string): Observable<CommandResult<void>> {
    return this.attempt(
      { type: 'post', id: postId },
      'delete-post',
      /** @returns Captured author-delete operation. */
      (): Observable<void> => this.client.deletePost(postId),
      /**
       * Invalidates the deleted post and every bounded quote.
       * @param _value Empty 204 response.
       * @param generation Command session ownership.
       */
      (_value: void, generation: number): void => this.entities.deletePost(postId, generation),
    );
  }

  /**
   * Deletes a reply without guessing the new parent total from a 204 response.
   * @param replyId Canonical reply ID.
   * @returns Confirmed completion; parent representations require a fresh read.
   */
  deleteReply(replyId: string): Observable<CommandResult<void>> {
    const parent = this.entities.reply(replyId)?.post_id;
    return this.attempt(
      parent ? { type: 'post', id: parent } : { type: 'reply', id: replyId },
      'delete-reply',
      /** @returns Captured author-delete operation. */
      (): Observable<void> => this.client.deleteReply(replyId),
      /**
       * Invalidates reply data and unavailable parent counts.
       * @param _value Empty 204 response.
       * @param generation Command session ownership.
       */
      (_value: void, generation: number): void => this.entities.deleteReply(replyId, generation),
    );
  }

  /**
   * Captures exact client serialization now, converting local errors into outcomes.
   * @param target Resource lock target.
   * @param action Action label for pending feedback.
   * @param capture Constructs a cold HTTP operation with captured payload/key.
   * @param reconcile Applies confirmed data only.
   * @returns Reusable explicit attempt preserving its exact serialized request.
   */
  private attempt<T>(
    target: MutationTarget,
    action: string,
    capture: () => Observable<T>,
    reconcile: (value: T, generation: number) => void,
  ): Observable<CommandResult<T>> {
    let request: Observable<T>;
    try {
      request = capture();
    } catch (error: unknown) {
      request = throwError(
        /** @returns Captured local failure without altering a draft. */
        (): unknown => error,
      );
    }
    return this.executor.run({
      generation: this.session.generation(),
      resource: resourceKey(target),
      action,
      request,
      reconcile,
      onDeleted:
        target.type === 'post'
          ? this.entities.deletePost.bind(this.entities, target.id)
          : undefined,
    });
  }

  /**
   * Reconciles repost metadata with the current canonical reposter account.
   * @param result Confirmed server result.
   * @param generation Command session ownership.
   */
  private applyRepost(result: RepostResult, generation: number): void {
    const session = this.session.state();
    if (session.status !== 'authenticated') {
      throw new Error('Session changed during reconciliation');
    }
    this.entities.reconcileRepost(result, session.account, generation);
  }
}

/**
 * Computes a private lock key, never a diagnostic containing a draft or retry key.
 * @param target Canonical resource or the single post-composer channel.
 * @returns Resource serialization key.
 */
function resourceKey(target: MutationTarget): string {
  return target.type === 'create-post' ? target.type : `${target.type}:${target.id}`;
}
