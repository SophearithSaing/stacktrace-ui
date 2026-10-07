# Project: Stacktrace UI

## Design

For any design-related work, first read `DESIGN.md` and `design-system.css`.

Follow `DESIGN.md` as the source of truth for UI, UX, styling, layout, components, and interaction patterns.

Follow `design-system.css` as the source of truth for design tokens, variables, colors, spacing, typography, breakpoints, shadows, borders, and reusable style primitives.

Do not introduce new design patterns, hardcoded visual values, or duplicate style primitives unless explicitly requested.

### Design System Philosophy

The design system owns visual decisions. Product components should compose existing design tokens, primitives, components, and patterns instead of creating new styles locally.

### Rules

1. No hardcoded visual values in components.
   Use design tokens for color, spacing, typography, shadows, borders, radii, and breakpoints.

2. No one-off component styling when a reusable primitive or pattern would work.

3. If a visual pattern appears twice, promote it into the design system.

4. Components may define layout-specific styles only when the style is truly unique to that component.

5. Responsive behavior should be handled through design-system media queries, layout primitives, or documented patterns.

6. New variants must be added to the design system before being used in product components.

7. Component-local CSS is allowed only as an escape hatch, and it must still use design-system tokens.

8. The design system should describe intent, not raw CSS.
   Prefer `surface-card`, `text-muted`, `button-primary`, and `stack-md` over arbitrary values.

## Code Style

- **Indentation:** 2 spaces (no tabs).
- **Quotes:** Use single quotes `'` for strings unless double quotes are required for JSON.
- **Line Width:** Keep code blocks under 80 characters per line where possible.
- **Comment:** Every function MUST have a return type and TS Doc header. Body comments are forbidden, except for complex algorithmic logic in long functions or non-obvious workarounds for third-party bugs.
- **TS Doc Format:** Include `@param` for each parameter and `@returns` only when the function returns a value. Do not write `@returns Nothing.` for `void` functions.

```ts
/**
 * Finds an item by id.
 *
 * @param itemId Item id to find.
 * @returns Matching item, or null when no item exists.
 */
private findItem(itemId: string): Item | null {
  return null;
}

/**
 * Clears the current state.
 */
public clearState(): void {
  this.state.set(null);
}
```
