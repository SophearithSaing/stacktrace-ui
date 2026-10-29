import {
  Component,
  ElementRef,
  afterRenderEffect,
  computed,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormField, SchemaPath, disabled, form, required } from '@angular/forms/signals';

@Component({
  imports: [FormField],
  selector: 'app-reply-input',
  templateUrl: './reply-input.html',
})
export class ReplyInput {
  readonly id = input.required<string>();
  readonly label = input('Write a reply');
  readonly placeholder = input('Join the conversation…');
  readonly disabled = input(false);
  readonly managed = input(false);
  readonly error = input('');
  readonly value = model('');
  readonly submitted = output<string>();
  private readonly field = viewChild<ElementRef<HTMLInputElement>>('replyField');
  private readonly waiting = signal(false);
  private readonly focusEffect = afterRenderEffect(this.restoreDraftFocus.bind(this));
  protected readonly attempted = signal(false);
  protected readonly replyForm = form(this.value, this.configureSchema.bind(this));
  protected readonly showError = computed(this.hasError.bind(this));

  /**
   * Configures native field validation and disabled state.
   *
   * @param path Signal form schema for the reply text.
   */
  private configureSchema(path: SchemaPath<string>): void {
    required(path);
    disabled(path, this.isDisabled.bind(this));
  }

  /**
   * Reads the externally controlled disabled state.
   *
   * @returns Whether reply entry is disabled.
   */
  private isDisabled(): boolean {
    return this.disabled();
  }

  /** Keeps managed reply focus with its existing field after pending/cooldown ends. */
  private restoreDraftFocus(): void {
    const waiting = this.waiting();
    const disabled = this.disabled();
    if (waiting && !disabled) {
      this.field()?.nativeElement.focus();
      this.waiting.set(false);
    }
  }

  /**
   * Determines whether an attempted reply is blank.
   *
   * @returns Whether inline validation should be displayed.
   */
  private hasError(): boolean {
    return this.attempted() && !this.value().trim();
  }

  /**
   * Clears previous submission feedback when editing resumes.
   */
  protected clearError(): void {
    this.attempted.set(false);
  }

  /**
   * Submits trimmed nonblank text and resets the reply field.
   *
   * @param event Native form submission event.
   */
  protected send(event: Event): void {
    event.preventDefault();
    if (this.disabled()) {
      return;
    }
    this.attempted.set(true);
    this.replyForm().markAsTouched();
    const text = this.value().trim();
    if (!text) {
      return;
    }
    if (!this.managed()) {
      this.replyForm().reset('');
    }
    this.attempted.set(false);
    if (this.managed()) {
      this.waiting.set(true);
    }
    this.submitted.emit(this.managed() ? this.value() : text);
  }
}
