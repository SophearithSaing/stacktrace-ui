import { Component, computed, input, output, signal } from '@angular/core';
import { Menu } from '../../behaviors/menu';
import { REACTION_TYPES, ReactionId } from '../../models/conversation';
import { Icon } from '../../ui/icon/icon';

@Component({
  imports: [Icon, Menu],
  selector: 'app-reaction-picker',
  templateUrl: './reaction-picker.html',
})
export class ReactionPicker {
  readonly id = input.required<string>();
  readonly selected = input<ReactionId | null>(null);
  readonly disabled = input(false);
  readonly variant = input<'menu' | 'inline'>('menu');
  readonly selectionRequested = output<ReactionId | null>();
  protected readonly types = REACTION_TYPES;
  protected readonly open = signal(false);
  protected readonly choice = computed(this.resolveChoice.bind(this));

  /**
   * Resolves the selected reaction's presentation.
   *
   * @returns Selected vocabulary entry, or undefined when unselected.
   */
  private resolveChoice(): (typeof REACTION_TYPES)[number] | undefined {
    return this.types.find(this.matchesSelection.bind(this));
  }

  /**
   * Matches the externally controlled selection.
   *
   * @param type Registered reaction entry.
   * @returns Whether this entry is selected.
   */
  private matchesSelection(type: (typeof REACTION_TYPES)[number]): boolean {
    return type.id === this.selected();
  }

  /**
   * Requests add, change, or removal without retaining product state.
   *
   * @param id Chosen reaction kind.
   */
  protected choose(id: ReactionId): void {
    if (!this.disabled()) {
      this.selectionRequested.emit(this.selected() === id ? null : id);
    }
  }
}
