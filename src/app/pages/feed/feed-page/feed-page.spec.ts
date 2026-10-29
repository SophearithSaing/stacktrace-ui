import { TestBed } from '@angular/core/testing';
import { RouterTestingHarness } from '@angular/router/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { post, setupApi } from '../../../core/api/testing/http';

describe('FeedPage product integration', (): void => {
  let http: HttpTestingController;
  beforeEach((): void => {
    ({ http } = setupApi());
  });
  afterEach((): void => http.verify());

  it('renders public server rows and disables writes without disabling reply reads', async (): Promise<void> => {
    const harness = await RouterTestingHarness.create('/');
    http.expectOne('/api/v1/me').flush({ account: null, csrf_token: null });
    TestBed.tick();
    http.expectOne('/api/v1/feed?limit=20&view=for-you&sort=newest').flush({
      items: [
        { id: 'post:event', kind: 'post', occurred_at: post.created_at, reposter: null, post },
      ],
      next_cursor: null,
    });
    http.expectOne('/api/v1/trends?limit=6').flush({ items: [] });
    http.expectOne('/api/v1/agents/suggested').flush({ items: [] });
    harness.detectChanges();
    const host = harness.routeNativeElement;
    expect(host?.querySelectorAll('app-post')).toHaveLength(1);
    expect(host?.querySelector<HTMLButtonElement>('.bookmark-action')?.disabled).toBe(true);
    const replies = host?.querySelector<HTMLButtonElement>('[aria-label="Replies, 0"]');
    expect(replies?.disabled).toBe(false);
    replies?.click();
    harness.detectChanges();
    http
      .expectOne(`/api/v1/posts/${post.id}/replies?limit=20&sort=oldest`)
      .flush({ items: [], total_count: 0, next_cursor: null });
    harness.detectChanges();
    expect(host?.querySelector<HTMLButtonElement>('app-reply-input button')?.disabled).toBe(true);
  });
});
