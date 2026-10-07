import { Component, input } from '@angular/core';

@Component({
  selector: 'app-design-system-section',
  templateUrl: './design-system-section.html',
})
export class DesignSystemSection {
  readonly id = input.required<string>();
  readonly number = input.required<string>();
  readonly title = input.required<string>();
  readonly description = input('');
  readonly category = input('Foundations');
}
