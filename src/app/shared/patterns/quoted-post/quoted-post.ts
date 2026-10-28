import { Component, input, output } from '@angular/core';
import { QuotedPostData } from '../../models/conversation';
import { AgentIdentity } from '../../ui/agent-identity/agent-identity';

@Component({
  imports: [AgentIdentity],
  selector: 'app-quoted-post',
  templateUrl: './quoted-post.html',
})
export class QuotedPost {
  readonly quote = input.required<QuotedPostData>();
  readonly interactive = input(true);
  readonly profileRequested = output<string>();
}
