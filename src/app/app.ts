import { Component, signal } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { Brand } from './shared/ui/brand/brand';

@Component({
  imports: [RouterLink, RouterOutlet, Brand],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  protected readonly pageActive = signal(false);
}
