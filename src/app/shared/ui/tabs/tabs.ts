import { Component, ElementRef, computed, effect, input, model, viewChildren } from '@angular/core';

export interface TabItem {
  readonly id: string;
  readonly label: string;
  readonly panelId?: string;
  readonly disabled?: boolean;
}

@Component({
  selector: 'app-tabs',
  templateUrl: './tabs.html',
})
export class Tabs {
  readonly id = input.required<string>();
  readonly label = input('Feed filters');
  readonly items = input.required<readonly TabItem[]>();
  readonly selected = model('');
  private readonly buttons = viewChildren<ElementRef<HTMLButtonElement>>('tab');
  protected readonly active = computed(this.resolveActive.bind(this));
  private readonly selectionEffect = effect(this.syncSelection.bind(this));

  /**
   * Keeps consumer selection aligned with the available enabled tabs.
   */
  private syncSelection(): void {
    const active = this.active();
    if (this.selected() !== active) {
      this.selected.set(active);
    }
  }

  /**
   * Finds the selected enabled item or the first available tab.
   *
   * @returns Active tab id, or an empty string for no enabled tabs.
   */
  private resolveActive(): string {
    let first = '';
    for (const item of this.items()) {
      if (!item.disabled) {
        first ||= item.id;
        if (item.id === this.selected()) {
          return item.id;
        }
      }
    }
    return first;
  }

  /**
   * Selects an enabled tab through the controlled model.
   *
   * @param item Tab chosen by pointer or keyboard.
   */
  protected select(item: TabItem): void {
    if (!item.disabled) {
      this.selected.set(item.id);
    }
  }

  /**
   * Handles horizontal automatic-activation tab navigation.
   *
   * @param event Keyboard event from a tab.
   * @param currentId Id of the currently focused tab.
   */
  protected onKeydown(event: KeyboardEvent, currentId: string): void {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
      return;
    }
    const enabled: TabItem[] = [];
    for (const item of this.items()) {
      if (!item.disabled) {
        enabled.push(item);
      }
    }
    if (!enabled.length) {
      return;
    }
    event.preventDefault();
    let index = 0;
    for (let position = 0; position < enabled.length; position++) {
      if (enabled[position].id === currentId) {
        index = position;
      }
    }
    switch (event.key) {
      case 'Home':
        index = 0;
        break;
      case 'End':
        index = enabled.length - 1;
        break;
      case 'ArrowRight':
        index = (index + 1) % enabled.length;
        break;
      case 'ArrowLeft':
        index = (index - 1 + enabled.length) % enabled.length;
        break;
    }
    const next = enabled[index];
    this.select(next);
    for (const button of this.buttons()) {
      if (button.nativeElement.id === this.id() + '-tab-' + next.id) {
        button.nativeElement.focus();
      }
    }
  }
}
