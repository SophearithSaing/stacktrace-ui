# API and state boundaries

`refs/openapi.yaml` owns the wire contract. `models.ts` uses its field names,
nullability and response envelopes; IDs and timestamps stay strings, counts
are JSON numbers. `serialization.ts` allowlists fields, validates endpoint
queries and checks the UTF-8 size of the exact serialized body (64 KiB).
Clients must send that returned string as `application/json`, not stringify
it again. Body semantics and safe field errors remain server-authoritative.

## Dependency direction and planned homes

- `core/api`: wire types, destination, serializers, HTTP endpoint clients and
  API-scoped credential/CSRF transport. No presentation or fixture imports.
- `core/session`: in-memory account/token and session generation, independent
  of presentation. Never persist credentials or private data in web storage.
- `core/adapters`: wire-to-presentation mapping and registered appearance
  resolution; unknown appearances use the neutral theme.
- `core/state`: canonical entities keyed by resource UUID, viewer state and
  separately keyed cursor collections. Feed event IDs are not post IDs;
  bounded quote previews must not replace complete posts. Reads and commands
  use session/request generations before committing server-confirmed state.
- Product facade in `core/state`: coordinates session, clients, adapters and
  entities. `ProductShell` provides the product scope; `FeedPage` consumes feed,
  bookmarks, replies and commands; `Topbar` consumes search/session/profile;
  `ContextRail` consumes discovery. Shared components receive presentation
  inputs and emit intents, never importing clients or product stores.
- Documentation retains explicit local `FeedState` providers and fixtures in
  `DesignSystemPage` and its embedded specimen shell. Registering HttpClient
  does not start requests. `AppShell` is documentation-only; product startup
  begins only when its routed `ProductShell` mounts.

## Deployment

`API_BASE_URL` defaults to `''`, producing `/api/v1/...` regardless of document
base, route or `/design-system` location. Serve/proxy `/api/v1` at the UI origin
for same-origin deployments. No backend host or development port is guessed.
To use another origin, provide `{ provide: API_BASE_URL, useValue: apiOrigin }`
in application configuration, where `apiOrigin` is deployment-supplied. Only
absolute HTTP(S) origins (optional trailing slash) are supported, not paths,
credentials, query strings or fragments. Clients pass relative resource paths
to `apiUrl` and encode individual dynamic segments, never an external URL.

Cross-origin deployments must configure the backend's exact UI Origin and
credentialed CORS. The browser supplies Origin and HttpOnly cookies; clients
must not manufacture these headers. Angular's generic cookie XSRF mechanism
is disabled because the API uses an in-memory token from session responses.
`sessionInterceptor` supplies credentials and exactly one current CSRF token
on authenticated writes, never on unrelated requests; public reads and credential
exchanges carry no CSRF header. Authenticated writes fail locally if the session
has no token. `AuthClient` owns session exchange effects and guards late results
using `SessionContext` generations. Session operations invalidate the previous
viewer immediately; canceled loading operations return to uninitialized, failed
reads remain failed, and logout clears only on confirmed success. This deliberately
conservative policy blocks writes during session refresh rather than reusing a
potentially stale token. No service starts requests merely by being injected.

`ContentClient`, `DiscoveryClient` and `CommandClient` expose cold, typed HTTP
operations without presentation mapping or state reconciliation. Desired-state
booleans select PUT/DELETE for bookmarks, reposts and follows; reaction null selects
DELETE. Creation requires a caller-owned idempotency key and captures serialized
payload/key when the operation is constructed, so explicit resubscriptions retain
both even if caller input changes. No client or interceptor automatically retries
or replays writes. Failed logout does not clear the current session.

Actual CORS, cookie and persistence verification requires a supplied backend
and test session; mocked HTTP tests cannot establish deployment correctness.

## Canonical state and presentation

`core/adapters/conversation.ts` maps wire accounts/content to shared presentation
models, retaining canonical IDs and literal body/code text. Registered local
themes/motifs are separate from account identity; unknown/null appearance keys
use neutral styling. Deleted quotes retain only their source ID and availability.
Legacy demo keys continue through the shared local identity resolver, not through
API clients or API fixture fallbacks.

`core/state/EntityStore` holds canonical accounts, full posts and replies, feed
events, viewer state and ordered membership references in separate maps. Quote
previews remain embedded bounded values and never enter the canonical post map.
Full profile fields survive subsequent account summaries. Event projections resolve
the current canonical post while preserving their own event ID/time/reposter.
Reply totals come from server counts, never the number of embedded preview rows.

Every commit requires a generation captured before its request started. The
store synchronously resets **all** canonical state and memberships on any session
generation change (including loading/failure/clear), not just private data. This
conservative invalidation requires fresh public reads as well and prevents stale
viewer representations from crossing epochs. It owns no network subscriptions;
obsolete results are rejected at commit time. Cancellation, cursor chains and
refresh belong to the collection boundary below; command-specific ordering and
reconciliation belong to the guarded command boundary.
The product facade uses the store/adapters; documentation retains local state.

## Collection ownership and read safety

`ApiCollections` builds immutable-by-contract endpoint definitions; `CursorCollection`
owns one active chain and must be disposed by its container. A new selection always
starts at the first page. Refresh replaces first-page membership while retaining
previous rows during loading/failure; load-more appends/deduplicates by event ID
for feeds and resource ID for posts/replies. Cursors are opaque, never decoded or
shared between definitions. Invalid empty continuations fail instead of silently
restarting a chain. No request retries automatically.

Selection keys include canonical endpoint options/page size, plus viewer/session
for viewer-bound endpoints. Replies bind to post/sort and still enforce session
ownership even though their server cursors are viewer-independent. Only a matching
oldest-order reply preview with current read provenance can seed a chain; newest
starts a separate first-page read. Search snippets remain collection-local metadata,
not canonical post content. Each collection owner namespaces its membership so two
containers with the same selection cannot mix independent continuation chains.
Selection replacement/disposal releases those references, not shared entities.

`ReadBoundary.capture()` supplies the session/mutation ticket used by every
collection entity/membership commit. Selection/refresh/disposal also advance a
request generation and cancel transport subscriptions. Session invalidation is
synchronous: active reads cancel and rows/cursors clear before another epoch can
commit. Confirmed commands must call `ReadBoundary.confirmMutation(commandSession)`
**before** writing confirmed entities; stale command sessions are rejected. This
globally cancels older reads and marks collections stale without dropping rows,
invalidates their cursors, and requires a new first-page read. `Mutations` and
`CommandExecutor` wire this seam before confirmed reconciliation, then broadcast
`refreshCollections` so active owners read fresh first pages after canonical state
is updated. Recoverable failures do not advance it. A definitive 410 on a known
post path also invalidates reads and tombstones that post, but remains a failed
command outcome, never fake write success. Creation 410 responses do not guess
which post is unavailable. There is no automatic write replay.

`AsyncViewState`/`AsyncFeedback` provide transport-independent loading/empty/error/
retry affordances. Network errors (HTTP status zero) do not pretend to prove browser
offline status. Normalized failures remain in core for action/diagnostic use. Drafts
are caller-owned and untouched by collection reads. This is neither snapshot
consistency nor live-stream support; mutable reacted ordering remains best effort.

## Failures, cooldown and diagnostics

`normalizeFailure` maps HTTP status/code semantics to `ApiFailure` without keeping
the original body, URL, headers or server message. Only documented request fields
receive bounded plain-text 422 messages; non-JSON and unexpected failures use fixed
safe feedback. Both body/header request IDs are retained when bounded and
diagnostic-safe. Diagnostics must use `failureDiagnostic`, never log a raw request,
error, normalized field messages, password, cookie, token or private draft.

`RetryGate` conservatively shares rate/service cooldown across API operations and
session changes (rate limits can be IP-scoped). It respects supplied Retry-After
seconds/HTTP dates, including 503 hints; missing/invalid 429 hints use a one-second
fallback. Long waits use bounded timer chunks without shortening the delay. Timers
only enable explicit retry, never send requests or replay writes. Collection retry,
refresh, load-more and command execution all enforce the gate. Non-collection read
consumers must normalize failures and report them to the same gate during cutover.
Current authenticated 401 failures clear the session; 403 does not mean logout.

## Guarded command reconciliation

Product callers use `Mutations`, not raw `CommandClient`. Each logical attempt
captures serialization/key and session ownership at construction. Resubscription
is an explicit retry of those exact bytes/key, never rebound to another viewer.
One post lock covers reactions/bookmarks/reposts/replies/deletion, since different
actions return overlapping full snapshots. Follow writes lock the account; post
creation has one composer channel even if duplicate clicks supply different keys.
Competing pending actions are blocked, not queued or simulated. There is no optimism
or count arithmetic. A view unsubscribing detaches observation, while the service
owns the uncertain write and resource lock until completion/session invalidation.

Confirmed posts/profiles update every canonical projection. Bookmark/suggestion
memberships are explicitly classified, never inferred from arbitrary key strings.
Reposts retain server event identity/time and remove only the current viewer's
obsolete event. Replies use the returned total, never preview length or a local
increment. Deleted posts remove events/replies/memberships/snippets and strip every
cached quote author/body; session-local tombstones prevent overlapping older command
snapshots from restoring that content. Reply deletion returns no total, so its
parent representation is invalidated for a fresh read instead of guessing counts.
Active collections refresh first pages after reconciliation. The product
facade also observes refresh notifications for active non-collection detail/profile/
discovery reads, using read tickets for their canonical commits.

Caller-owned drafts change only when their UI chooses to handle confirmation; all
failed/blocked/stale outcomes preserve them. Network failure cannot prove whether a
server write committed; caller-owned creation keys and exact payloads remain the
retry contract. No client-side scheme promises ordering of unseen backend work or
snapshot consistency beyond the documented server API.
