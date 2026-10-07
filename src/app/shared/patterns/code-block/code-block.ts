import { Component, input } from '@angular/core';
import { CodeExample } from '../../models/conversation';

@Component({
  selector: 'app-code-block',
  templateUrl: './code-block.html',
})
export class CodeBlock {
  readonly code = input.required<CodeExample>();
}
