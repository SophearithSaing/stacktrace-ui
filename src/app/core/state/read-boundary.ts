import { Service, inject } from '@angular/core';
import { Subject, merge } from 'rxjs';
import { SessionContext } from '../session/session-context';

export interface ReadTicket {
  readonly session: number;
  readonly mutation: number;
}

@Service()
export class ReadBoundary {
  private readonly session = inject(SessionContext);
  private readonly mutations = new Subject<number>();
  private revision = 0;
  readonly invalidations = merge(this.session.generationChanges, this.mutations);

  /**
   * Captures both boundaries before starting a read.
   * @returns Immutable-by-contract read ticket.
   */
  capture(): ReadTicket {
    return { session: this.session.generation(), mutation: this.revision };
  }

  /**
   * Tests whether a read can still update canonical entities and membership.
   * @param ticket Ticket captured before the request.
   * @returns Whether neither the viewer nor a confirmed mutation has changed.
   */
  isCurrent(ticket: ReadTicket): boolean {
    return ticket.session === this.session.generation() && ticket.mutation === this.revision;
  }

  /**
   * Invalidates older reads before applying a server-confirmed command result.
   * This is deliberately global until command-specific invalidation is available.
   * @param generation Session generation that initiated the command.
   * @returns Whether the confirmation belongs to the current session.
   */
  confirmMutation(generation: number): boolean {
    if (generation !== this.session.generation()) {
      return false;
    }
    this.revision += 1;
    this.mutations.next(this.revision);
    return true;
  }
}
