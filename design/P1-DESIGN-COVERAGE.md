# Beauty Trainer — P1 design coverage

Status: design preparation only. The production UI is not changed by this document.

The shared visual foundation is documented in `design/DESIGN-SYSTEM.md`. Its
standalone responsive specimen is `design/design-system-preview.html`.

## Chosen direction

The selected direction is a calm professional workspace for company employees aged 25+.
The home screen prioritizes three practical jobs:

1. Continue the current learning route.
2. Find trustworthy product information quickly.
3. Repeat a short set of due material.

XP and streak remain secondary motivation. Broad self-analysis, charts, rankings, and
decorative gamification must not compete with the next useful action.

## Screen families

### 1. Public entry and account access

- Welcome page
- Sign in
- Registration with optional corporate invitation code
- First-owner setup
- Forced password change and recovery states

The welcome page explains that the service is both a product-learning tool and a
working catalog that replaces scattered presentations.

### 2. Home workspace

- Continue current line
- Three-stage route: cards, normal test, hard test
- Product catalog search and brand shortcuts
- Assigned lines
- Due repetition
- Empty state when an account has no assigned materials

### 3. Product knowledge catalog

- All brands
- Lines within a selected brand
- Search and filters
- Brand knowledge page
- Line page with learning route and products
- Product detail page
- Missing-image and unavailable-content states

The catalog must remain useful during a client consultation: search is prominent,
filters are easy to reset, and product facts can be scanned without reading a long
article.

### 4. Learning and testing

- Flashcard front and revealed answer
- Confidence rating
- Difficulty choice
- Standard multiple-choice question
- Image recognition
- Multiple-answer question
- Matching products to purposes
- Client scenario and reasoning question
- Three-life state
- Failed and completed result screens

The question itself is always the strongest element. Navigation and motivation
remain visible but quiet.

### 5. Repetition and progress

- Due today
- Weak topics
- Recently mistaken products
- Learning history and line-level completion
- Empty and completed states

This area explains what to repeat and why. It avoids personality-like scoring or
large analytical dashboards.

### 6. Personal account

- Account menu
- Password settings
- Theme
- Sign out
- Help and privacy

### 7. Administration

- Admin overview
- User list and user detail
- Brand and line access permissions
- Password reset and account deletion
- Product management/import
- Content quality report
- Registration and invitation-code settings

Admin screens use the same tokens and controls, but favor density, clear status,
safe destructive actions, and readable tables.

## Responsive behavior

Design and verification widths:

| Range             | Layout behavior                                                                                                                   |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| 320–479 px        | Single column; compact top bar; drawer navigation; sticky primary action when useful; filters in a sheet; minimum 44 px controls. |
| 480–767 px        | Single column with larger cards; two-column chip and metadata groups where space allows.                                          |
| 768–1023 px       | Tablet layout; collapsible sidebar; two-column catalog and admin cards; training content stays centered.                          |
| 1024–1439 px      | Desktop sidebar; 12-column content grid; restrained maximum reading width.                                                        |
| 1440 px and wider | Content stops growing at a controlled max width; whitespace increases instead of stretching text and images.                      |

Rules shared by all widths:

- No horizontal page scrolling at 320 px.
- Product images use a fixed aspect-ratio container and `object-fit: contain`.
- Text may wrap without overlapping controls or being truncated where meaning matters.
- Tables become stacked records or gain a deliberate internal scroll region.
- Hover is never the only way to discover or perform an action.
- Keyboard focus is visible and follows the visual order.
- Dialogs, drawers, and account menus remain inside the viewport.
- Training answers and primary actions are reachable with one thumb on common phones.

## Browser and device verification

Required before production rollout:

| Target  | Coverage                                         |
| ------- | ------------------------------------------------ |
| Chrome  | Latest desktop and Android viewport set          |
| Edge    | Latest desktop                                   |
| Firefox | Latest desktop                                   |
| Safari  | Latest macOS and iOS viewport set through WebKit |

Playwright projects should cover Chromium, Firefox, and WebKit at 320, 390, 768,
1024, and 1440 px. Visual checks focus on navigation, catalog filters, product images,
flashcards, every question type, result screens, account menus, dialogs, and admin
tables. Native Safari/iPhone smoke testing remains part of release review because
emulated WebKit cannot reproduce every device behavior.

## Design sequence

1. Foundation: color, typography, spacing, elevation, icons, focus and states.
2. Learner shell: sidebar, top bar, mobile navigation, page header.
3. Catalog flow: brand, line, product, search, filters.
4. Learning flow: cards, mode choice, all question types, results.
5. Public/account flow: welcome, sign-in, registration, settings.
6. Repetition and progress.
7. Administration.
8. Responsive variants and browser QA matrix.

Each family is approved as desktop and mobile mockups before the production styles
are changed. Implementation will then be incremental and preserve existing routes,
data contracts, Cloudflare compatibility, and working behavior.

## Concept files

The current approved direction and supporting screen concepts are stored in
`design/concepts/`:

- `home-desktop.png`
- `catalog-desktop.png`
- `test-desktop.png`
- `line-desktop.png`
- `product-desktop.png`
- `flashcards-desktop.png`
- `results-desktop.png`
- `welcome-desktop.png`
- `review-desktop.png`
- `settings-desktop.png`
- `admin-desktop.png`
- `core-mobile.png`
- `learning-mobile.png`
- `account-review-mobile.png`
- `admin-mobile.png`

These images define hierarchy and interaction direction. Product names, exact copy,
counts, and packshots must still come from application data during implementation.

## Concepts that require new functionality

The mockups include a few useful additions that are not guaranteed to exist in the
current application. They must be estimated and implemented separately rather than
treated as visual-only work:

- active-session list and “end other sessions” action;
- password-recovery entry point;
- richer user filters and account-status summaries in administration;
- side drawer for quick user administration on desktop;
- grouped product-comparison cards in repetition;
- per-issue editing shortcut from the quality report.

The initial visual migration can ship without these additions. Existing behavior
must remain available until each replacement is implemented and tested.
