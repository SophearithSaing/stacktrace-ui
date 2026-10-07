import { Component, computed, input, linkedSignal, model, output } from '@angular/core';
import { FormField, SchemaPath, form, maxLength, required } from '@angular/forms/signals';
import { BroadcastDraft } from '../../../../core/models/feed';
import { Dialog } from '../../../../shared/behaviors/dialog';
import { QuotedPostData } from '../../../../shared/models/conversation';
import { QuotedPost } from '../../../../shared/patterns/quoted-post/quoted-post';
import { Avatar } from '../../../../shared/ui/avatar/avatar';
import { Icon } from '../../../../shared/ui/icon/icon';

@Component({
  imports: [FormField, Dialog, QuotedPost, Avatar, Icon],
  selector: 'app-post-composer',
  templateUrl: './post-composer.html',
})
export class PostComposer {
  readonly id = input.required<string>();
  readonly open = model(false);
  readonly value = model('');
  readonly quote = input<QuotedPostData | null>(null);
  readonly published = output<BroadcastDraft>();
  readonly closed = output<void>();
  protected readonly attempted = linkedSignal(this.resetAttempt.bind(this));
  protected readonly textForm = form(this.value, this.configure.bind(this));
  protected readonly remaining = computed(this.charactersRemaining.bind(this));
  protected readonly error = computed(this.validationMessage.bind(this));

  /**
   * Resets submission feedback for each modal session.
   *
   * @returns Initial attempt state.
   */
  private resetAttempt(): boolean {
    this.open();
    return false;
  }

  /**
   * Registers native text validation.
   *
   * @param path Schema path for the draft.
   */
  private configure(path: SchemaPath<string>): void {
    required(path);
    maxLength(path, 320);
  }

  /**
   * Counts remaining characters without silently accepting overlength text.
   *
   * @returns Signed remaining character count.
   */
  private charactersRemaining(): number {
    return 320 - this.value().length;
  }

  /**
   * Provides human validation for blank and overlength drafts.
   *
   * @returns Error text or an empty string.
   */
  private validationMessage(): string {
    if (this.remaining() < 0) {
      return 'Keep your broadcast within 320 characters.';
    }
    return this.attempted() && !this.value().trim() ? 'Write something before broadcasting.' : '';
  }

  /**
   * Emits a validated draft; the container owns publication and closure.
   *
   * @param event Native form submission.
   */
  protected send(event: Event): void {
    event.preventDefault();
    this.attempted.set(true);
    if (this.error()) {
      return;
    }
    this.published.emit({ text: this.value().trim(), quote: this.quote() ?? undefined });
  }
}
