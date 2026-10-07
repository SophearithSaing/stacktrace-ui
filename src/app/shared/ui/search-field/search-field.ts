import { DOCUMENT } from '@angular/common';
import {
  Component,
  ElementRef,
  computed,
  inject,
  input,
  linkedSignal,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { Avatar } from '../avatar/avatar';
import { AgentId } from '../avatar/agents';
import { Icon } from '../icon/icon';
import { EmptyState } from '../empty-state/empty-state';

export interface SearchResult {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly agent?: AgentId;
}

@Component({
  imports: [Avatar, Icon, EmptyState],
  selector: 'app-search-field',
  templateUrl: './search-field.html',
  host: {
    '(document:keydown)': 'onShortcut($event)',
    '(document:pointerdown)': 'onOutsidePointer($event)',
  },
})
export class SearchField {
  readonly id = input.required<string>();
  readonly label = input('Search stacks, posts, or hot takes');
  readonly placeholder = input('Search stacks, posts, or hot takes');
  readonly results = input<readonly SearchResult[]>([]);
  readonly disabled = input(false);
  readonly loading = input(false);
  readonly shortcut = input(false);
  readonly value = model('');
  readonly resultSelected = output<SearchResult>();
  private readonly document = inject(DOCUMENT);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly field = viewChild.required<ElementRef<HTMLInputElement>>('field');
  protected readonly opened = signal(false);
  protected readonly activeIndex = linkedSignal(this.resetActiveIndex.bind(this));
  protected readonly expanded = computed(this.isExpanded.bind(this));

  /**
   * Resets keyboard selection when the query or results change.
   *
   * @returns Initial unselected result index.
   */
  private resetActiveIndex(): number {
    this.value();
    this.results();
    return -1;
  }

  /**
   * Determines whether the result panel should be exposed.
   *
   * @returns Whether the panel is open and searchable.
   */
  private isExpanded(): boolean {
    return this.opened() && !!this.value().trim() && !this.disabled();
  }

  /**
   * Updates the query from native input.
   *
   * @param event Input event from the search field.
   */
  protected updateQuery(event: Event): void {
    this.value.set((event.target as HTMLInputElement).value);
    this.opened.set(true);
  }

  /**
   * Opens results when focus enters the search field.
   */
  protected open(): void {
    this.opened.set(true);
  }

  /**
   * Dismisses results and keyboard selection.
   */
  protected dismiss(): void {
    this.opened.set(false);
    this.activeIndex.set(-1);
  }

  /**
   * Dismisses results when focus leaves the component.
   *
   * @param event Focus transition from the native input.
   */
  protected onBlur(event: FocusEvent): void {
    if (!this.host.nativeElement.contains(event.relatedTarget as Node | null)) {
      this.dismiss();
    }
  }

  /**
   * Emits a selected result and returns focus to search.
   *
   * @param result Result chosen by pointer or keyboard.
   */
  protected selectResult(result: SearchResult): void {
    if (this.disabled() || this.loading()) {
      return;
    }
    this.field().nativeElement.focus();
    this.dismiss();
    this.resultSelected.emit(result);
  }

  /**
   * Handles combobox navigation without moving focus into the list.
   *
   * @param event Keyboard event from the search input.
   */
  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.dismiss();
      return;
    }
    const results = this.results();
    if (this.disabled() || this.loading() || !results.length) {
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      this.opened.set(true);
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      const previous = this.activeIndex();
      this.activeIndex.set(
        previous < 0
          ? direction > 0
            ? 0
            : results.length - 1
          : (previous + direction + results.length) % results.length,
      );
    } else if (event.key === 'Enter' && this.expanded()) {
      const result = results[this.activeIndex()];
      if (result) {
        event.preventDefault();
        this.selectResult(result);
      }
    }
  }

  /**
   * Handles the optional global search shortcut outside editable controls.
   *
   * @param event Document keyboard event.
   */
  protected onShortcut(event: KeyboardEvent): void {
    const active = this.document.activeElement;
    if (
      !this.shortcut() ||
      this.disabled() ||
      event.defaultPrevented ||
      event.key !== '/' ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      active?.closest(
        'input, textarea, select, [contenteditable]:not([contenteditable="false"])',
      ) ||
      this.document.querySelector('dialog[open]')
    ) {
      return;
    }
    event.preventDefault();
    this.field().nativeElement.focus();
  }

  /**
   * Dismisses results on pointer interaction outside the component.
   *
   * @param event Document pointer event.
   */
  protected onOutsidePointer(event: PointerEvent): void {
    if (!this.host.nativeElement.contains(event.target as Node | null)) {
      this.dismiss();
    }
  }
}
