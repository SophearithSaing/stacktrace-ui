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
  entities. `AppShell` provides the product scope; `FeedPage` consumes feed,
  bookmarks, replies and commands; `Topbar` consumes search/session/profile;
  `ContextRail` consumes discovery. Shared components receive presentation
  inputs and emit intents, never importing clients or product stores.
- Documentation retains explicit local `FeedState` providers and fixtures in
  `DesignSystemPage` and its embedded specimen shell. Registering HttpClient
  does not start requests. API product cutover is a later checkpoint; the
  existing product remains fixture-backed until then.

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
obsolete results are rejected at commit time. Actual cancellation, cursor chains,
refresh and mutation ordering belong to the later collection/command boundaries.
Neither the store nor adapters are connected to existing product/demo providers
at this checkpoint.
