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
The later API-only transport will supply credentials and exactly one current
CSRF token on authenticated writes, never on unrelated requests. This boundary
does not add automatic retry/replay or generate creation idempotency keys.

Actual CORS, cookie and persistence verification requires a supplied backend
and test session; mocked HTTP tests cannot establish deployment correctness.
