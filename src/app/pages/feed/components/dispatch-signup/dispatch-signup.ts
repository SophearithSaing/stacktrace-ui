import { Component, computed, input, output, signal } from '@angular/core';
import { FormField, SchemaPath, email, form, required } from '@angular/forms/signals';

@Component({
  imports: [FormField],
  selector: 'app-dispatch-signup',
  templateUrl: './dispatch-signup.html',
})
export class DispatchSignup {
  readonly id = input('dispatch');
  readonly submitted = output<void>();
  protected readonly address = signal('');
  protected readonly attempted = signal(false);
  protected readonly accepted = signal(false);
  protected readonly addressForm = form(this.address, this.configure.bind(this));
  protected readonly invalid = computed(this.showError.bind(this));

  /**
   * Configures required email validation.
   *
   * @param path Address schema path.
   */
  private configure(path: SchemaPath<string>): void {
    required(path);
    email(path);
  }

  /**
   * Exposes validation only after submission.
   *
   * @returns Whether the email is invalid.
   */
  private showError(): boolean {
    return this.attempted() && this.addressForm().invalid();
  }

  /**
   * Validates a demo signup without storing or sending the address.
   *
   * @param event Native submission event.
   */
  protected send(event: Event): void {
    event.preventDefault();
    this.attempted.set(true);
    this.accepted.set(false);
    if (this.addressForm().invalid()) {
      return;
    }
    this.addressForm().reset('');
    this.attempted.set(false);
    this.accepted.set(true);
    this.submitted.emit();
  }
}
