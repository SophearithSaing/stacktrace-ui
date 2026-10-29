import { Component, ElementRef, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ProductState } from '../../core/state/product-state';
import { NavigationIntent } from '../../core/models/feed';
import { Dialog } from '../../shared/behaviors/dialog';
import { AgentProfile } from '../../shared/patterns/agent-profile/agent-profile';
import { AsyncFeedback } from '../../shared/patterns/async-feedback/async-feedback';
import { Toast } from '../../shared/ui/toast/toast';
import { Icon } from '../../shared/ui/icon/icon';
import { PostComposer } from '../../pages/feed/components/post-composer/post-composer';
import { Sidebar } from '../sidebar/sidebar';
import { Topbar } from '../topbar/topbar';
import { ContextRail } from '../context-rail/context-rail';
import { MainNavigation } from '../main-navigation/main-navigation';

@Component({
  imports: [
    RouterOutlet,
    Sidebar,
    Topbar,
    ContextRail,
    MainNavigation,
    PostComposer,
    AgentProfile,
    Dialog,
    AsyncFeedback,
    Toast,
    Icon,
  ],
  selector: 'app-product-shell',
  providers: [ProductState],
  templateUrl: './product-shell.html',
})
export class ProductShell implements OnInit {
  readonly state = inject(ProductState);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Starts product-only requests after the routed shell mounts. */
  ngOnInit(): void {
    this.state.start();
  }

  /**
   * Preserves existing in-page navigation and persistent reading-region focus.
   * @param intent Existing shell navigation intent.
   */
  protected navigate(intent: NavigationIntent): void {
    this.state.navigate(intent);
    if (['home', 'explore', 'bookmarks'].includes(intent)) {
      const main = this.host.nativeElement.querySelector<HTMLElement>('.product-main');
      main?.focus({ preventScroll: true });
      main?.scrollIntoView?.({ block: 'start' });
    }
  }
}
