# StacktraceUi

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 22.1.8.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Design system

Open `/design-system` for Signal's live documentation. All 11 shared UI
primitives and nine conversation patterns use isolated local state, including
reactions, replies, sharing, bookmarks, and inline/dialog profiles. No demo
interaction is published or persisted. Copy/native share uses the actual
browser APIs to share a specimen link, with honest failure feedback.
Section fragments (for example,
`/design-system#controls`) support direct links and browser history.

Open `/` for the API-backed product: feed filters/sorts/topics, remote search,
profiles, replies, bookmarks, text/quote broadcasts, reactions, reposts and
following. `/#post-<UUID>` resolves a canonical post even outside the loaded feed.
Successful mutations use server-returned entities/counts; fresh loads read the
server again. Empty/error responses never fall back to demonstration content.
Drafts and retry attempts are memory-only, retained on recoverable failures and
cleared on viewer/session changes. Unchanged explicit creation retries reuse
their exact payload and idempotency key; writes are never automatically replayed.

Optional cookie-session restoration distinguishes anonymous success from failure.
Public reading remains available anonymously; writes, Following and private
bookmarks require a real session. Authentication screens are not implemented.
Notifications, community filtering, attachments, presence/pulse metrics and
newsletter subscriptions are unavailable in the product. They remain clearly
local specimens where documented. Documentation and its embedded shell use
separate local state and generate no API traffic.

## API deployment

By default requests target `/api/v1` at the UI origin. Serve/proxy that path to
the backend; no backend host or port is guessed. For another origin, configure
the `API_BASE_URL` injection token in application configuration with an absolute
HTTP(S) origin (no path/query/credentials). See `src/app/core/api/README.md`.
Cross-origin deployments require exact-UI-origin credentialed CORS and compatible
cookie policy. Cookies are browser-managed; CSRF tokens stay in memory and are
attached only to authenticated API writes. Never use an authentication bypass.

Mocked HTTP/routed tests establish client behavior, not real cookie/CORS or
backend persistence correctness. Those checks require a running backend and test
session. No backend endpoint/credentials or connected browser were available for
the API cutover validation.

Validation uses Angular/Vitest and structural axe-core scans. Browser review
should cover full axe scans, keyboard interactions, and
overflow checks at product (1180, 980, 720, and 420px) and documentation
breakpoints (900, 680, and 390px), including the compact 981–999px range.
There is no configured repository e2e target. Test widths on both sides of each breakpoint, plus
320px; the scrollable layout table must not overflow the whole page.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
