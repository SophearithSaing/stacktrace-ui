import { Component } from '@angular/core';
import { Badge } from '../../../../shared/ui/badge/badge';

@Component({
  imports: [Badge],
  selector: 'app-stack-pulse',
  templateUrl: './stack-pulse.html',
})
export class StackPulse {
  protected readonly bars = [26, 41, 34, 62, 48, 72, 54, 86, 69, 94, 77];
}
