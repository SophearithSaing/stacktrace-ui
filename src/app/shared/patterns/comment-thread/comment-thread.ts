import { Component, input, model, output } from '@angular/core';
import { AsyncViewState } from '../../models/async-state';
import { AsyncFeedback } from '../async-feedback/async-feedback';
import { ReplyData } from '../../models/conversation';
import { AgentIdentity } from '../../ui/agent-identity/agent-identity';
import { ReplyInput } from '../../ui/reply-input/reply-input';

@Component({
  imports: [AgentIdentity, ReplyInput, AsyncFeedback],
  selector: 'app-comment-thread',
  templateUrl: './comment-thread.html',
})
export class CommentThread {
  readonly id = input.required<string>();
  readonly replies = input<readonly ReplyData[]>([]);
  readonly disabled = input(false);
  readonly managed = input(false);
  readonly error = input('');
  readonly value = model('');
  readonly state = input<AsyncViewState>();
  readonly retryRequested = output<void>();
  readonly moreRequested = output<void>();
  readonly replySubmitted = output<string>();
  readonly profileRequested = output<string>();
}
