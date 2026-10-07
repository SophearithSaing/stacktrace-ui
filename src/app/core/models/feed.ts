import { PostData, QuotedPostData, ReactionId } from '../../shared/models/conversation';
import { IconName } from '../../shared/ui/icon/icon-data';

export type FeedFilter = 'for-you' | 'following' | 'spicy';
export type FeedSort = 'relevant' | 'newest' | 'liked';
export type FeedView = 'home' | 'explore' | 'bookmarks' | 'communities';
export type NavigationIntent = FeedView | 'notifications' | 'profile' | 'compose';
export type CommunityId = 'backend' | 'frontend' | 'database' | 'devops';

export interface FeedEntry extends PostData {
  readonly publishedAt: number;
  readonly spicy: boolean;
}
export interface PostInteraction {
  readonly reaction: ReactionId | null;
  readonly repliesOpen: boolean;
  readonly reposted: boolean;
  readonly bookmarked: boolean;
}
export interface BroadcastDraft {
  readonly text: string;
  readonly quote?: QuotedPostData;
}
export interface NavigationItem {
  readonly id: NavigationIntent;
  readonly label: string;
  readonly icon: IconName;
}
export interface Community {
  readonly id: CommunityId;
  readonly initials: string;
  readonly name: string;
  readonly tags: readonly string[];
}
export interface Trend {
  readonly tag: string;
  readonly posts: string;
  readonly change: string;
  readonly hot?: boolean;
}
