import { Type } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

export async function render<T>(
  component: Type<T>,
  inputs: Record<string, unknown> = {},
): Promise<ComponentFixture<T>> {
  await TestBed.configureTestingModule({
    imports: [component],
    providers: [provideRouter([])],
  }).compileComponents();
  const fixture = TestBed.createComponent(component);
  for (const [key, value] of Object.entries(inputs)) {
    fixture.componentRef.setInput(key, value);
  }
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture;
}

export function element<T extends Element = HTMLElement>(
  fixture: ComponentFixture<unknown>,
  selector: string,
): T {
  const match = (fixture.nativeElement as HTMLElement).querySelector<T>(selector);
  if (!match) {
    throw new Error(`Missing test element: ${selector}`);
  }
  return match;
}

export function press(target: EventTarget, key: string): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
  target.dispatchEvent(event);
  return event;
}

export function type(input: HTMLInputElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}
