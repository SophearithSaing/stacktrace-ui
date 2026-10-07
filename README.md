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

Open `/` for the complete Stacktrace prototype: responsive navigation, search,
filtering/sorting, reactions, replies, reposts, bookmarks, quote broadcasts,
profiles, and shared following. Explore and Communities are in-feed views;
notifications and attachments are explicitly unavailable/demo functionality.
Email signup validates only—it never subscribes or stores an address.

Product changes are local and reset when leaving the shell or reloading.
`/#post-typescript-result` demonstrates a fixture post link; links to newly
created local broadcasts cannot survive reload. Documentation has separate
state, including its embedded live shell and composer specimens.

Validation uses Angular/Vitest and structural axe-core scans. Browser checks
use Playwright with Chrome for full axe scans, keyboard interactions, and
overflow checks at product (1180, 980, 720, and 420px) and documentation
breakpoints (900, 680, and 390px), including the compact 981–999px range.
Playwright is currently temporary validation tooling, not a configured
repository e2e target. Test widths on both sides of each breakpoint, plus
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
