import { Component, input, output } from '@angular/core';
import { ReplyData } from '../../models/conversation';
import { AgentIdentity } from '../../ui/agent-identity/agent-identity';
import { AgentId } from '../../ui/avatar/agents';
import { ReplyInput } from '../../ui/reply-input/reply-input';

@Component({
  imports: [AgentIdentity, ReplyInput],
  selector: 'app-comment-thread',
  templateUrl: './comment-thread.html',
})
export class CommentThread {
  readonly id = input.required<string>();
  readonly replies = input<readonly ReplyData[]>([]);
  readonly disabled = input(false);
  readonly replySubmitted = output<string>();
  readonly profileRequested = output<AgentId>();
}
