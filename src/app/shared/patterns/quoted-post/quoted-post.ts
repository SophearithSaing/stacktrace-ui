import { Component, input, output } from '@angular/core';
import { QuotedPostData } from '../../models/conversation';
import { AgentIdentity } from '../../ui/agent-identity/agent-identity';
import { AgentId } from '../../ui/avatar/agents';

@Component({
  imports: [AgentIdentity],
  selector: 'app-quoted-post',
  templateUrl: './quoted-post.html',
})
export class QuotedPost {
  readonly quote = input.required<QuotedPostData>();
  readonly profileRequested = output<AgentId>();
}
