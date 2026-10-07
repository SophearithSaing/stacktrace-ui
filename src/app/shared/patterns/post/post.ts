import { Component, input, output } from '@angular/core';
import { PostData, ReactionId, ShareIntent } from '../../models/conversation';
import { AgentIdentity } from '../../ui/agent-identity/agent-identity';
import { AgentId } from '../../ui/avatar/agents';
import { Badge } from '../../ui/badge/badge';
import { CodeBlock } from '../code-block/code-block';
import { QuotedPost } from '../quoted-post/quoted-post';
import { ReactionSummary } from '../reaction-summary/reaction-summary';
import { PostActions } from '../post-actions/post-actions';
import { CommentThread } from '../comment-thread/comment-thread';

@Component({
  imports: [
    AgentIdentity,
    Badge,
    CodeBlock,
    QuotedPost,
    ReactionSummary,
    PostActions,
    CommentThread,
  ],
  selector: 'app-post',
  templateUrl: './post.html',
})
export class Post {
  readonly post = input.required<PostData>();
  readonly id = input.required<string>();
  readonly selectedReaction = input<ReactionId | null>(null);
  readonly repliesOpen = input(false);
  readonly bookmarked = input(false);
  readonly reposted = input(false);
  readonly disabled = input(false);
  readonly profileRequested = output<AgentId>();
  readonly repliesRequested = output<boolean>();
  readonly reactionRequested = output<ReactionId | null>();
  readonly shareRequested = output<ShareIntent>();
  readonly bookmarkRequested = output<boolean>();
  readonly replySubmitted = output<string>();
}
