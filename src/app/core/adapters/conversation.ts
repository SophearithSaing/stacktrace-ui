import { AccountProfile, AccountSummary, Post, Quote, Reply } from '../api/models';
import {
  AgentProfileData,
  PostData,
  QuotedPostData,
  ReplyData,
} from '../../shared/models/conversation';
import { AccountIdentity, isAgentId } from '../../shared/models/identity';
import { AgentTheme } from '../../shared/ui/avatar/agents';
import { PROFILE_MOTIFS } from '../../shared/ui/avatar/themes';

/**
 * Resolves only registered local themes and motifs.
 * @param key Untrusted API appearance key.
 * @returns Known appearance, or neutral styling without fabricated artwork.
 */
export function resolveAppearance(key: string | null): { theme: AgentTheme; motif: string } {
  const theme = key !== null && isAgentId(key) ? key : 'observer';
  return { theme, motif: theme === 'observer' ? '' : PROFILE_MOTIFS[theme] };
}

/**
 * Maps arbitrary account metadata while retaining canonical identity.
 * @param account Server account summary.
 * @returns Presentation-only identity.
 */
export function toIdentity(account: AccountSummary): AccountIdentity {
  return {
    id: account.id,
    name: account.display_name,
    initials: account.initials,
    handle: `@${account.handle}`,
    status: account.status_text,
    verified: account.is_verified,
    type: account.type,
    theme: resolveAppearance(account.appearance_key).theme,
  };
}

/**
 * Maps a bounded quote without retaining content on a deleted representation.
 * @param quote Server quote preview, never a complete canonical post.
 * @returns Available preview or explicit unavailable placeholder data.
 */
export function toQuote(quote: Quote): QuotedPostData {
  if (quote.availability === 'deleted') {
    return { id: quote.id, availability: 'deleted' };
  }
  return {
    id: quote.id,
    availability: 'available',
    agent: quote.author?.id,
    identity: quote.author ? toIdentity(quote.author) : undefined,
    text: quote.body === undefined ? [] : [{ text: quote.body }],
  };
}

/**
 * Preserves literal reply text, provenance and timestamp.
 * @param reply Server reply.
 * @returns Safe shared reply data.
 */
export function toReply(reply: Reply): ReplyData {
  return {
    id: reply.id,
    agent: reply.author.id,
    identity: toIdentity(reply.author),
    text: reply.body,
    time: reply.created_at,
    generated: reply.is_generated,
  };
}

/**
 * Maps complete content to safe text/token rendering without parsing HTML.
 * @param post Complete server post.
 * @returns Shared presentation data, keeping source IDs and authoritative counts.
 */
export function toPost(post: Post): PostData {
  return {
    id: post.id,
    agent: post.author.id,
    identity: toIdentity(post.author),
    text: [{ text: post.body }],
    time: post.created_at,
    status: post.author.status_text,
    tags: post.tags.map(toTagLabel),
    reactions: post.counts.reactions_by_kind,
    comments: post.counts.replies,
    reposts: post.counts.reposts,
    replies: post.reply_preview.items.map(toReply),
    generated: post.is_generated,
    quote: post.quote ? toQuote(post.quote) : undefined,
    code: post.code
      ? {
          filename: post.code.filename,
          language: post.code.language,
          tokens: [{ text: post.code.source, kind: 'plain' }],
        }
      : undefined,
  };
}

/**
 * Maps server profile fields and local-only artwork.
 * @param profile Complete server profile.
 * @param viewerId Current viewer ID, if known, for self-follow suppression.
 * @returns Shared presentation profile without using its theme as identity.
 */
export function toProfile(profile: AccountProfile, viewerId?: string): AgentProfileData {
  return {
    agent: profile.id,
    identity: toIdentity(profile),
    canFollow: profile.id !== viewerId,
    role: profile.role_label,
    bio: profile.bio,
    status: profile.status_text,
    followers: String(profile.follower_count),
    posts: String(profile.post_count),
    specialty: profile.specialty,
    motif: resolveAppearance(profile.appearance_key).motif,
  };
}

/**
 * Formats the server's tag display label without extracting synthetic tags.
 * @param tag Server tag.
 * @returns Visible hashtag label.
 */
function toTagLabel(tag: Post['tags'][number]): string {
  return `#${tag.display_name}`;
}
