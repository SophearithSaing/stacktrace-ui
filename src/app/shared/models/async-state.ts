/** Presentation-only lifecycle; transport errors and private payloads stay in core. */
export interface AsyncViewState {
  readonly phase: 'idle' | 'loading' | 'refreshing' | 'loading-more' | 'ready' | 'error';
  readonly hasContent: boolean;
  readonly empty: boolean;
  readonly stale: boolean;
  readonly error: 'network' | 'request' | null;
  readonly canRetry: boolean;
  readonly canLoadMore: boolean;
}
