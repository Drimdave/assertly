# Design foundations

How Assertly looks and why. Informed by the Atlassian Design System foundations (typography, spacing, elevation, color) and adapted to our own palette, font and radius. Tokens live in `app/globals.css` and `tailwind.config.ts`.

## Type

One family for the app (currently IBM Plex Sans) plus JetBrains Mono for keys, IDs and code. The font is a single CSS variable (`--font-sans` in `app/layout.tsx`), so swapping it is a one-line change. Candidates were compared in `docs/design/font-lab.html` (decision: keep IBM Plex Sans and JetBrains Mono).

Weights are Regular 400, Medium 500, Bold 700. There is no semibold.

| Token | Size / line height | Use |
|---|---|---|
| `text-display` | 56 / 60, tight tracking | Landing page hero title only |
| `text-display-sm` | 36 / 40, tight tracking | Landing page section titles, and the hero title on a phone |
| `text-heading-xl` | 28 / 32 | Large titles inside the app |
| `text-heading-lg` | 24 / 28 | **Page titles** |
| `text-heading-md` | 20 / 24 | Drawer and dialog titles |
| `text-heading-sm` | 16 / 20 | Section titles on a page |
| `text-heading-xs` | 14 / 20 | Panel and form section headings |
| `text-heading-xxs` | 12 / 16 | Rare, fine print |
| `text-metric-lg/md/sm` | 28 / 24 / 16 | Headline numbers (`MetricStrip`) |
| `text-sm` (body) | 14 / 20 | Default text, table cells |
| `text-xs` (body small) | 12 / 16 | Secondary text, hints |
| `text-body-lg` | 16 / 24 | Long-form reading |

Rules:
- Regular for paragraphs; **Medium** for components and anything beside an icon; **Bold** for headings and metrics only.
- One `h1` per page, and heading levels never skip. Do not fake a heading with bold or a bigger size.
- `lib/utils.ts` teaches `tailwind-merge` the custom sizes. Without it, `text-heading-md text-foreground` loses the size.

## Spacing

Tailwind's scale equals the Atlassian 8px-based steps (2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80 px).

- 0 to 8px: dense UI (table cells, badges, icon gaps, input padding, button groups).
- 12 to 24px: card and panel padding, vertical space inside components.
- 32px and up: page padding and gaps between major sections.
- Related items sit closer than unrelated ones. Lists and tables keep an even rhythm.

## Elevation

| Level | Where | Tokens |
|---|---|---|
| Sunken | Board columns, table header band | `bg-subtle` |
| Default | Page, static cards (flat with a hairline border) | `bg-background` + `border` |
| Raised | Movable cards only (board cards) | `bg-raised shadow-raised` |
| Overlay | Drawer, dialogs, menus, popovers; a card while it is being dragged | `bg-popover shadow-overlay` |

In dark mode higher levels get lighter surfaces (shadows barely show). Sticky headers and footers use a border, not a shadow.

## Color and shape

- Neutral surfaces. Blue (`primary`) only for primary actions, selection and links.
- Status colors only for meaning: success, warning, danger, info. Lozenges are small uppercase bold labels.
- Radius: 4px controls, 6px, 8px panels and overlays. Full rounding is for avatars only.

### Color of actions

Color on a button tells people how careful to be. Few colors, used the same way everywhere:

| Action | Look | Examples |
|---|---|---|
| The main thing to do on this screen | Solid blue (`default`) | Create test case, Save plan, Start session, Report bug, Next |
| Anything else | Outline or ghost, no color | Cancel, Back, Revert, Add step, Sign out, Skip tour |
| Deletes, discards or cannot be taken back | Solid red (`destructive`) in the confirmation; red text or red outline on the button that opens it | Delete, Discard, Reset progress, Revoke, End session |

Rules:
- Red is for **consequences, not for leaving**. Sign out is neutral: you can sign straight back in, nothing is lost, and painting it red would make people afraid of an ordinary action. GitHub, Jira, Google and Linear all do the same.
- **Stopping something live is red.** End session, like ending a call or stopping a recording, cannot be undone (the clock cannot be restarted), so the button that opens it is a red outline and its confirmation is solid red.
- A destructive action is **confirmed in a dialog** whose confirm button is red and whose cancel button is not, so the wrong one is never the colored one by habit. Where Undo exists (delete a test case) the dialog still asks, and Undo remains after.
- One solid blue button per screen or dialog. Two blue buttons side by side means the page has not decided what matters.
- Color is never the only signal: red actions also say what they do in words (Delete, Discard), and meet 4.5:1 contrast in light and dark (5.6:1 and 7.6:1).
- Red text next to a field is an error, not a button: it states what to fix.

## Explaining terms

This is a tool for learning a craft, so some words on screen will be new to the reader (severity, priority, exit criteria, coverage, acceptance criteria). They are explained where they appear.

- **A visible line of text beside the control**, in `text-xs text-muted-foreground`, one sentence or two. Not a tooltip: a tooltip cannot be read on a phone or without a mouse, and it disappears when the pointer moves. If it is worth saying, it is worth showing.
- **Say what it is and what it is for**, in plain words, using the screen's own terms ("Priority: how important it is to run this check. Not the same as a bug's severity"). Where two words are easy to confuse, say which is which.
- **One word for one thing, everywhere.** The same idea is not "Area" in one form and "Requirement" in the next: the label, the table heading, the empty option ("No requirement") and the notes all use the same word.
- **Wire the note to the control** with `aria-describedby` where the control is a lone field, so a screen reader hears it with the label. Shared wording (the coverage legend) lives in one exported string so two pages cannot drift apart.
- **Keep it short enough to be skimmed.** A note that needs a paragraph belongs in the Fundamentals section, with a link.
