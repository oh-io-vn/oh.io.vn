# Interface design system

## Audit and direction

The original seven-page interface used a single 16px type size, a pale blue
background, an invisible home heading and form label, and individually boxed link
records. The primary action was usable but lacked context. Navigation had no
current-page indicator, and empty states provided little direction.

The redesign keeps the Vietnamese product voice and existing Space Grotesk
variable font. Its visual emphasis is the URL form and the links people manage.
Use a restrained neutral palette, blue for actions, generous space between
sections and compact spacing inside controls. Do not introduce gradients,
decorative charts, invented usage numbers or repeated marketing cards.

The frontend-design and UI UX Pro Max instructions informed this work. The
latter's initial SaaS recommendation suggested glassmorphism, which conflicts
with the brief. A focused style search returned Minimalism & Swiss Style, whose
functional layout, high contrast and minimal effects suit this product.

Skill sources: [frontend-design](https://github.com/anthropics/skills/blob/main/skills/frontend-design/SKILL.md)
and [ui-ux-pro-max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/blob/main/.claude/skills/ui-ux-pro-max/SKILL.md).

## Tokens

- Canvas `#fafafa`, surface `#ffffff`, text `#202124`, muted text `#61656e`.
- Divider `#e5e7eb`, input boundary `#858b96`, accent `#245bdb`.
- Success `#216443` on `#f0f8f3`; danger `#a53232` on `#fff4f3`.
- Type: 16px body and inputs, 14px supporting text, 20px section headings,
  36px page headings, 56px home heading. Home heading reduces to 36px on mobile.
- Spacing: 4, 8, 12, 16, 24, 32, 48, 64 and 80px.
- Radius: 6px badges, 8px controls, 12px functional surfaces, 16px dialogs.
- Layout: 1120px shell, 720px home workspace, 704px reading column.
- Motion: 150ms color/background/border transitions and a subtle 180ms content
  appearance (opacity 0.92 to 1), disabled for reduced motion. Dialog surfaces
  remain opaque; animate their inner content only.

## Components and behavior

### Current refinement brief

This is a Vietnamese utility for people sharing web addresses, with a secondary
workspace for link owners and service administrators. The URL field and its submit
button remain the focal point. Keep the existing blue brand, self-hosted Space
Grotesk, neutral canvas and divided link list. Avoid adding marketing sections.

- Keep the home heading and form left aligned within the same 720px column.
- Use 48px home headings on desktop, 32px on mobile, with tracking at -0.035em.
- Keep the URL field and submit button adjacent; put account guidance after them.
- Show the actual short URL, including its slash, in link records and dialogs.
- Keep search labels visible and loading/result feedback next to the list.
- Identify the affected record in edit, delete, statistics and admin dialogs.
- Confirm destructive admin actions before sending them. Keep API permissions intact.
- Show form feedback beside the originating action, including on narrow screens.
- Never reveal editable admin settings before their current values load successfully.
- Preserve legal wording, donation details, account limits and expiry calculations.

The review criteria are task clarity, readable Vietnamese, discoverable feedback,
keyboard focus continuity, and no overflow at 390, 768 and 1440px. The existing
palette, icon and list structure are deliberate choices, not defects to remove.

- Shared header, active navigation, keyboard skip link and shared footer.
- Keep the About link in the footer, outside the header's primary actions.
- Use SVG icons for dropdown arrows, selection marks and disclosure controls.
  Admin panels in the same row stretch to equal height. Keep the Cloudflare
  action next to usage data with normal spacing; remaining space stays below it.
- One prominent action per task; secondary buttons are neutral and outlined.
- Controls have visible labels, focus rings and at least 44px touch targets.
- Link records form a divided list, with aligned actions on desktop and wrapping
  actions on mobile. Long addresses and user content must wrap within the viewport.
- Empty states distinguish no saved links, no search matches and signed-out users.
  Give an actionable next step without inventing records.
- Use semantic notices for errors and results. Preserve live regions and pending
  states. Dialogs retain native focus handling, Escape and close controls.
- Charts show real API data only. Tables use subdued headers, consistent padding
  and visible row boundaries. Legal content uses a readable line length.
- Daily charts use a fixed 30-day calendar window from the API's `since` date.
  Unrecorded days have zero height; a single recorded day stays one narrow bar.
  Keep a numeric scale, date range, daily values and missing-data warnings.
- Long dialog bodies scroll independently of the header using `.scroll-dialog`
  and `.dialog-body`. Never overlay a sticky header inside padded scrolling content.
- Admin limit fields align their inputs at the bottom of each grid row. Use
  balanced wrapping for introductory paragraphs and avoid hardcoded line breaks.
- Select controls reserve room for the arrow. Use native `base-select` styling
  progressively for the picker, with an ordinary native picker as the fallback.
- At 680px, forms, link rows, statistics and admin sections become one column.
  At 420px, navigation wraps deliberately. Support 320px width and short screens.

## SVG icon system

Use Lucide 1.59.0 outlines via `src/web/icons.js` for both generated pages and
dynamic controls. Only named icon nodes are imported, so unused library icons do
not ship. `scripts/generate-pages.mjs` also generates the native select/disclosure
masks in `src/web/icon-masks.css`. The existing product logo is a brand exception.

| Surface                            | Render size | Stroke in the 24-unit viewBox | Placement                     |
| ---------------------------------- | ----------- | ----------------------------- | ----------------------------- |
| Buttons, feedback, account actions | 16px        | 2.25 (1.5px effective)        | Leading, 8px gap              |
| Compact link actions               | 16px        | 2.25 (1.5px effective)        | Leading, 6px gap              |
| Primary navigation, shorten action | 18px        | 2 (1.5px effective)           | Leading, 8px gap              |
| Empty state                        | 24px        | 1.75                          | Above its heading, 12px gap   |
| Native select/disclosure           | 20px        | 2                             | Trailing, with reserved space |

CSS size tokens use rem so icons grow with enlarged text. Inline SVG uses
`currentColor`, `aria-hidden="true"` and `focusable="false"`. Native control
pseudo-elements use the same Lucide shapes as CSS masks, inheriting the control's
color. Ordinary native select remains the fallback when `base-select` is absent.

Use icons to distinguish repeated link actions, main navigation, search, external
destinations, loading and feedback. Preserve visible action labels. Leave prose,
legal headings, form labels, data rows and footer information links unadorned.
The icon does not replace text or become the only indicator of state. Mobile link
actions use two columns to keep labels and touch targets intact.

Pending actions show LoaderCircle, successful copy shows Check, creation success
shows CircleCheck, and errors show CircleAlert. Restore the original icon and
accessible name afterward. Native dialogs retain keyboard behavior and focus return.

## Loading, risk and form alignment

Use `src/web/loading.js` for API-dependent placeholders in the shared account
header, home connection hint, dashboard list, admin and statistics. Skeletons
have a status label, hide decorative bars from assistive technology, and contain
no focusable controls. Do not insert fake delays or block static information pages.
Pulse opacity gently over two 1.8s cycles, then stay still; disable it under reduced motion. End the
placeholder on success, denial and failure. Pending stats can be dismissed and a
late response must not reopen the dialog. Disable export until stats are ready.

Use danger red for logout, delete, locking, disabling and adding/removing blocks.
Keep text labels and confirmations. An edited link code requires acknowledgment
that the previous URL stops working; analytics and expiry remain with the new code.

Slug prefixes use the same font size/line height as their input, without inherited
field margins. Leave 12px below dividers before help text and 16px between search
feedback and results. Use pretty wrapping for prose and short help text; split a
standalone reference into its own paragraph instead of leaving an orphan word.

Review at 1440/768/390px, 320px and 200% text. Inspect rendered weight, spacing,
alignment, clipping, empty/error states and all changed controls before shipping.

## Scope

The admin workspace uses three native navigation links: Link, Tài khoản and
Vận hành. The selected view and filters live in the URL. Directories use divided
rows with owner, status, expiry and labeled actions, capped at 25 records per page.
Long destinations are limited to two lines in the list; the detail dialog shows
the complete value. Account rows show the total retained links and lead to an
owner-filtered list. Keep loading, retry and empty feedback beside that list.
Reuse the edit/statistics dialogs across owner and admin views. Keep expiry hold,
guest analytics limitations and removed ownership information explicit.

Page content is generated by `scripts/generate-pages.mjs`; do not edit generated
HTML independently. CSS is shared in `src/web/styles.css`. Preserve form IDs,
field names, API contracts, authentication, quota, expiry, verification, redirect,
search, clipboard, edit/delete and export behavior. Local visual fixtures are
separate from production and must never be bundled into the application.
