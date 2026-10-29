import {
  Component,
  ElementRef,
  afterRenderEffect,
  computed,
  input,
  linkedSignal,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormField, SchemaPath, disabled, form, maxLength, required } from '@angular/forms/signals';
import { AccountIdentity } from '../../../../shared/models/identity';
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
  readonly remote = input(false);
  readonly account = input<AccountIdentity | null>(null);
  readonly disabled = input(false);
  readonly pending = input(false);
  readonly serverError = input('');
  readonly fieldError = input('');
  readonly focusFallback = input<HTMLElement | null>(null);
  readonly published = output<BroadcastDraft>();
  readonly quoteRemoved = output<void>();
  readonly closed = output<void>();
  private readonly field = viewChild<ElementRef<HTMLTextAreaElement>>('draftField');
  private readonly waiting = signal(false);
  private readonly focusEffect = afterRenderEffect(this.restoreFailedDraftFocus.bind(this));
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
    maxLength(path, this.nativeLimit.bind(this));
    disabled(path, this.isDisabled.bind(this));
  }

  /** @returns Whether editing/submission is currently blocked by the container. */
  private isDisabled(): boolean {
    return this.disabled() || this.pending();
  }

  /** @returns The legacy demo's native limit, or no UTF-16 cap for Unicode API text. */
  private nativeLimit(): number | undefined {
    return this.remote() ? undefined : 320;
  }

  /** Restores the existing draft field after a recoverable remote attempt settles. */
  private restoreFailedDraftFocus(): void {
    const waiting = this.waiting();
    const open = this.open();
    const disabled = this.isDisabled();
    if (!waiting) {
      return;
    }
    if (!open) {
      this.waiting.set(false);
    } else if (!disabled) {
      this.field()?.nativeElement.focus();
      this.waiting.set(false);
    }
  }

  /**
   * Counts remaining characters without silently accepting overlength text.
   *
   * @returns Signed remaining character count.
   */
  private charactersRemaining(): number {
    return 320 - (this.remote() ? [...this.value()].length : this.value().length);
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
    if (this.isDisabled()) {
      return;
    }
    this.attempted.set(true);
    if (this.error()) {
      return;
    }
    if (this.remote()) {
      this.waiting.set(true);
    }
    this.published.emit({
      text: this.remote() ? this.value() : this.value().trim(),
      quote: this.quote() ?? undefined,
    });
  }
}
