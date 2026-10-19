# Beauty Trainer Design System

Version: P1 draft 1
Status: design specification only; production styles are unchanged.

## Product principles

1. **Work first.** The interface helps an employee learn a product or find an answer quickly.
2. **One clear next step.** Every learning screen has one dominant action.
3. **Product facts over self-analysis.** Progress is shown near a line, deck, or test; broad analytics stay secondary.
4. **Readable for 25+ and 35+.** Body text starts at 16 px, controls at 44 px, and layouts do not depend on tiny captions.
5. **Calm confidence.** Motivation comes from visible progress and useful feedback rather than playful decoration.
6. **Catalog consistency.** Product images always use a controlled container and `object-fit: contain`.

## Current-system audit

| Measure             | Current state |                                     P1 target |
| ------------------- | ------------: | --------------------------------------------: |
| CSS lines           |         3,578 | Migrate incrementally; do not rewrite at once |
| Unique hex values   |           120 |                        Semantic token palette |
| Unique pixel values |           121 |  4 px spacing scale and documented exceptions |
| Media queries       |            17 |  Five responsive ranges plus user preferences |
| Base typeface       |      Segoe UI |                 Manrope with system fallbacks |

The current UI already has useful component classes and working responsive behavior.
P1 should replace values through aliases first, then migrate screen families one at a
time. Existing routes and behavior remain unchanged during the migration.

## Color tokens

### Brand and neutral

| Token                 | Value     | Use                                          |
| --------------------- | --------- | -------------------------------------------- |
| `--color-ink-950`     | `#102B36` | Sidebar, strongest headings, dark theme base |
| `--color-ink-800`     | `#23434D` | Secondary dark surfaces and icons            |
| `--color-emerald-700` | `#176B53` | Primary action, active state, success        |
| `--color-emerald-600` | `#218064` | Hover on light backgrounds                   |
| `--color-emerald-100` | `#DDECE3` | Selected and success backgrounds             |
| `--color-cream-50`    | `#F7F6F1` | App background                               |
| `--color-white`       | `#FFFFFF` | Primary surface                              |
| `--color-slate-700`   | `#405860` | Body text                                    |
| `--color-slate-500`   | `#66787E` | Secondary text                               |
| `--color-slate-300`   | `#CBD5D7` | Strong border and disabled icon              |
| `--color-slate-200`   | `#DEE5E5` | Default border                               |
| `--color-slate-100`   | `#EEF2F1` | Quiet surface                                |

### Supporting and semantic

| Token                 | Value     | Use                                       |
| --------------------- | --------- | ----------------------------------------- |
| `--color-sage-100`    | `#E6EFE5` | Product memory and calm success panels    |
| `--color-sky-100`     | `#E0EEF5` | Standard-test and information panels      |
| `--color-sky-700`     | `#246F91` | Information text and focus accents        |
| `--color-apricot-100` | `#F4E6D8` | Product-card variety and gentle attention |
| `--color-amber-100`   | `#FAEBCB` | Review-needed background                  |
| `--color-amber-700`   | `#8A5A08` | Review-needed text                        |
| `--color-red-100`     | `#F8E4E1` | Error and destructive background          |
| `--color-red-700`     | `#A84235` | Error and destructive action              |

### Semantic aliases

```css
--bg-canvas: var(--color-cream-50);
--bg-surface: var(--color-white);
--bg-subtle: var(--color-slate-100);
--text-strong: var(--color-ink-950);
--text-body: var(--color-slate-700);
--text-muted: var(--color-slate-500);
--border-default: var(--color-slate-200);
--action-primary: var(--color-emerald-700);
--action-primary-hover: var(--color-emerald-600);
--focus-ring: var(--color-sky-700);
--status-success: var(--color-emerald-700);
--status-review: var(--color-amber-700);
--status-danger: var(--color-red-700);
```

Color never carries meaning alone. Statuses pair color with text and an icon.

## Dark theme

| Alias          | Value                   |
| -------------- | ----------------------- |
| Canvas         | `#0E252F`               |
| Surface        | `#173641`               |
| Raised surface | `#1E414C`               |
| Strong text    | `#F5F7F3`               |
| Body text      | `#D4DDDC`               |
| Muted text     | `#AABABC`               |
| Border         | `#35545E`               |
| Primary action | `#70C6A5` with ink text |

Dark theme preserves hierarchy and product-photo backgrounds; it does not invert
photographs or turn every surface green.

## Typography

Primary family: `Manrope Variable`. Fallbacks: `Inter`, `Segoe UI`, Arial, sans-serif.
The font should be self-hosted in WOFF2 during implementation to avoid an external
runtime dependency.

| Style       | Desktop | Mobile | Weight | Line height |
| ----------- | ------: | -----: | -----: | ----------: |
| Display     |   44 px |  34 px |    700 |        1.08 |
| H1          |   36 px |  30 px |    700 |        1.15 |
| H2          |   26 px |  24 px |    700 |         1.2 |
| H3          |   20 px |  19 px |    700 |         1.3 |
| Lead        |   18 px |  18 px |    400 |        1.55 |
| Body        |   16 px |  16 px |    400 |         1.6 |
| Body strong |   16 px |  16 px |    650 |         1.5 |
| Small       |   14 px |  14 px |    400 |         1.5 |
| Label       |   12 px |  12 px |    650 |         1.4 |

Labels may use uppercase and `0.12em` tracking. Paragraph measure is limited to
70 characters where practical.

## Spacing and layout

Spacing scale: `4, 8, 12, 16, 24, 32, 40, 48, 64, 80` px.

- Desktop content maximum: 1,280 px excluding the 230 px sidebar.
- Reading content maximum: 760 px.
- Standard card padding: 24 px desktop, 16 px mobile.
- Section gap: 32 px desktop, 24 px mobile.
- Grid gap: 16 or 24 px.
- Page side padding: 32 px desktop, 24 px tablet, 16 px mobile.

## Shape, border, elevation, motion

| Token         | Value                             | Use                            |
| ------------- | --------------------------------- | ------------------------------ |
| Radius small  | 8 px                              | Inputs, tags, compact controls |
| Radius medium | 12 px                             | Cards and panels               |
| Radius large  | 16 px                             | Hero and learning workspaces   |
| Radius pill   | 999 px                            | Status chips only              |
| Border        | 1 px solid                        | Default separation             |
| Shadow 1      | `0 2px 8px rgb(16 43 54 / 6%)`    | Menus and subtle raised cards  |
| Shadow 2      | `0 12px 32px rgb(16 43 54 / 12%)` | Dialogs and drawers            |

Motion durations: 120 ms for control feedback, 180 ms for menus, 240 ms for
drawers/dialogs. Use ease-out on entry and ease-in on exit. Disable nonessential
movement under `prefers-reduced-motion: reduce`.

## Core components

### Buttons

| Variant   | Use                          | Visual                                |
| --------- | ---------------------------- | ------------------------------------- |
| Primary   | One next action per region   | Emerald fill, white text              |
| Secondary | Supporting action            | White surface, default border         |
| Ghost     | Navigation and quiet actions | Transparent, subtle hover             |
| Danger    | Confirmed destructive action | Red fill or red outlined confirmation |

Sizes: 36 px compact, 44 px default, 52 px prominent/mobile sticky. Buttons support
default, hover, active, focus, disabled, and loading states. Loading keeps the same
width and announces progress with `aria-live` where needed.

### Inputs and search

- Default height: 48 px; mobile search may be 52 px.
- Label remains visible outside the field when the meaning is not obvious.
- Help and error text appear below without moving unrelated content.
- Search uses a real label for assistive technology and a clear button when populated.
- Filters become a bottom sheet below 768 px.

### Status chips

| Status   | Color family | Label example |
| -------- | ------------ | ------------- |
| New      | Slate/sage   | Нове          |
| Learning | Amber        | Вивчається    |
| Review   | Sky/amber    | Час повторити |
| Mastered | Emerald      | Засвоєно      |

Chips describe state; they are not used as decorative tags.

### Product imagery

- Line image ratio: 16:9 desktop, 4:3 mobile.
- Product detail ratio: 4:5 desktop, max 420 px tall on initial mobile viewport.
- Product thumbnail ratio: 1:1.
- Always use `object-fit: contain`, centered, with 8–12% internal padding.
- Never upscale a raster asset beyond its useful source resolution.
- Missing images use a neutral branded placeholder with the product category.

### Learning route

Three fixed stages: Cards, Normal test, Hard test. States: available, active,
complete, locked. A locked stage explains the concrete prerequisite. On mobile the
route becomes stacked rows; on desktop it can be horizontal.

### Feedback

- Correct: concise explanation plus the next action.
- Incorrect: explain the distinction; do not only expose the right answer.
- Lives: three hearts on wider screens, `2 ♥` on mobile.
- Result: outcome, local route progress, one review target, then next action.

### Tables and administration

Desktop tables use a sticky header when long. Below 768 px, important records become
stacked cards; data that must remain tabular uses an explicitly labeled horizontal
scroll region. Destructive controls stay behind a confirmation step.

## Responsive breakpoints

| Name    | Width        | Main behavior                                           |
| ------- | ------------ | ------------------------------------------------------- |
| Compact | 320–479 px   | Single column, drawer navigation, sticky action         |
| Mobile  | 480–767 px   | Single column, roomier metadata groups                  |
| Tablet  | 768–1023 px  | Collapsible sidebar, two-column supporting content      |
| Desktop | 1024–1439 px | Persistent sidebar, 12-column grid                      |
| Wide    | 1440 px+     | Max-width content; added whitespace, not stretched text |

Container queries should be preferred for reusable product and admin cards; media
queries remain responsible for the application shell.

## Accessibility baseline

- WCAG 2.1 AA contrast for text and controls.
- Visible 3 px focus ring with 2 px offset.
- Logical heading order and landmark structure.
- Full keyboard operation; Escape closes menus and dialogs.
- Minimum target 44 by 44 px.
- Errors use `role="alert"`; nonurgent updates use `aria-live="polite"`.
- Images have useful alt text; decorative images use empty alt text.
- Selected, expanded, current, and disabled states use native semantics or ARIA.
- Zoom to 200% must not hide content or actions.

## Browser verification

Automated visual and interaction checks: Chromium, Firefox, and WebKit at 320, 390,
768, 1024, and 1440 px. Manual smoke checks: current Chrome, Edge, Firefox, macOS
Safari, and one physical iPhone/Android phone before company launch.

## Migration order

1. Add tokens and fonts without changing component appearance.
2. Migrate the shared shell and primitive controls.
3. Migrate home and catalog.
4. Migrate line, product, cards, test, and result screens.
5. Migrate public/account screens.
6. Migrate progress and administration.
7. Remove obsolete hardcoded values only after screenshots and tests pass.
