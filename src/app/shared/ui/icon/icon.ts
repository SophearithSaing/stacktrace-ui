import { Component, computed, input } from '@angular/core';
import { ICONS, IconDefinition, IconName, IconSize } from './icon-data';

@Component({
  selector: 'app-icon',
  templateUrl: './icon.html',
})
export class Icon {
  readonly name = input.required<IconName>();
  readonly size = input<IconSize>('standard');
  readonly label = input('');
  protected readonly definition = computed(this.resolveIcon.bind(this));

  /**
   * Resolves the current icon's trusted geometry.
   *
   * @returns SVG definition for the requested icon.
   */
  private resolveIcon(): IconDefinition {
    return ICONS[this.name()];
  }
}
