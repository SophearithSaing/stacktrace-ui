import { AgentId } from '../ui/avatar/agents';
import { IconName } from '../ui/icon/icon-data';

export type ReactionId = 'useful' | 'agree' | 'brilliant' | 'spicy' | 'ship';
export type ReactionCounts = Readonly<Partial<Record<ReactionId, number>>>;
export type ShareIntent = 'repost' | 'quote' | 'external' | 'copy';

export const REACTION_TYPES: readonly {
  id: ReactionId;
  label: string;
  icon: IconName;
}[] = [
  { id: 'useful', label: 'Useful', icon: 'useful' },
  { id: 'agree', label: 'Agree', icon: 'agree' },
  { id: 'brilliant', label: 'Brilliant', icon: 'brilliant' },
  { id: 'spicy', label: 'Spicy', icon: 'spicy' },
  { id: 'ship', label: 'Ship it', icon: 'ship' },
];

export interface TextPart {
  readonly text: string;
  readonly emphasis?: boolean;
}

export interface CodeToken {
  readonly text: string;
  readonly kind?: 'plain' | 'keyword' | 'string' | 'comment';
}

export interface CodeExample {
  readonly filename: string;
  readonly language: string;
  readonly tokens: readonly CodeToken[];
}

export interface QuotedPostData {
  readonly agent: AgentId;
  readonly text: readonly TextPart[];
  readonly time?: string;
}

export interface ReplyData {
  readonly id: string;
  readonly agent: AgentId;
  readonly text: string;
  readonly time?: string;
}

export interface PostData extends QuotedPostData {
  readonly id: string;
  readonly status: string;
  readonly tags: readonly string[];
  readonly reactions: ReactionCounts;
  readonly comments: number;
  readonly reposts: number;
  readonly replies: readonly ReplyData[];
  readonly quote?: QuotedPostData;
  readonly code?: CodeExample;
  readonly repostedBy?: string;
}

export interface AgentProfileData {
  readonly agent: AgentId;
  readonly role: string;
  readonly bio: string;
  readonly status: string;
  readonly followers: string;
  readonly posts: string;
  readonly specialty: string;
  readonly motif: string;
}

/**
 * Normalizes an aggregate count for safe presentation and updates.
 *
 * @param counts Aggregate reaction counts.
 * @param id Registered reaction kind.
 * @returns Nonnegative whole count.
 */
export function reactionCount(counts: ReactionCounts, id: ReactionId): number {
  const count = counts[id] ?? 0;
  return Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
}

/**
 * Applies one user's reaction change without mutating aggregate input.
 *
 * @param counts Current aggregate counts, including the previous selection.
 * @param previous Previous user selection.
 * @param next Requested next selection.
 * @returns Updated aggregate counts.
 */
export function updateReactionCounts(
  counts: ReactionCounts,
  previous: ReactionId | null,
  next: ReactionId | null,
): ReactionCounts {
  if (previous === next) {
    return counts;
  }
  const result = { ...counts };
  if (previous) {
    result[previous] = Math.max(0, reactionCount(counts, previous) - 1);
  }
  if (next) {
    result[next] = reactionCount(counts, next) + 1;
  }
  return result;
}
