# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Marketing site for Sari Hills Bali, a five-room guesthouse in Kutuh, South Kuta, Bali. It is a brochure site: its single conversion goal is direct bookings (no third-party booking platform): visitors are sent to the owner's Telegram booking bot or to WhatsApp.

## Tech stack

Hand-written static site — HTML + CSS + vanilla ES6 DOM JavaScript. No build step, no package manager, no dependencies, no framework, no tests. The only external resources are Google Fonts (Nunito for headings and body: rounded, weight 800 for headings; Cormorant Garamond via `--font-brand` for the logo and the hero title only) and an embedded Google Maps iframe.

Everything ships as-is from the repo root:

```
index.html      the entire page
css/style.css   all styles
js/script.js    all behavior
images/*.jpg    all photography
```

## Running it

Open [index.html](index.html) directly in a browser, or serve the root over HTTP if you need same-origin behavior:

```sh
python -m http.server 8000    # then http://localhost:8000
```

There is nothing to build, lint, or test. "Verifying a change" means loading the page and checking it at desktop width, under 860px, and under 520px (the two main breakpoints at the end of [style.css](css/style.css); the gallery also drops from 3 to 2 columns at 700px).

## Architecture

**One page, section-anchored.** [index.html](index.html) is a linear sequence of `<section>` elements whose `id`s are the only routing the site has — the header nav, the hero buttons, and smooth scrolling (`html { scroll-behavior: smooth }`) all rely on them. Adding a section means adding both the `<section id="...">` and its `<li>` in `#nav-links`; renaming an `id` silently breaks the nav.

**All content is hardcoded in the markup.** Reviews, amenities, room features, stats, distances, and the "200+ positive reviews" figure (hero badge and About stat, change both together) are literal HTML, not data. There is no CMS, JSON, or template layer — content edits are HTML edits. The booking links each appear twice (hero and `#contact` booking card) and must be changed together: the Telegram bot `https://t.me/SariHillsBookingBot`, and WhatsApp `https://wa.me/6281770859996?text=...` (digits only, country code first, no `+`). The WhatsApp number is also shown as text in `.booking-note`. The header "Book Direct" button is an in-page link to `#contact`. Do not add Airbnb or other platform booking links; the goal is to keep bookings direct.

**CSS is a single token-driven stylesheet.** The top of [style.css](css/style.css) defines the whole design system as custom properties on `:root`. The look is a "pool and lagoon" palette: `--aqua`/`--aqua-deep` (pool turquoise, buttons on cream), `--ice` (pale aqua accent used on dark surfaces such as the hero photo and dark panels), `--sky` (light blue accent), `--lagoon-mid`/`--lagoon`/`--lagoon-deep` (teals for labels, the booking panel and footer), `--jungle`/`--jungle-deep` (emerald, the gallery panel gradient), `--aqua-soft` (icon badges), and warm neutrals `--bg` (cream) / `--bg-soft` (sand) / `--surface` (white cards), plus `--ink`, `--muted`, `--border`, `--radius`/`--radius-lg`, `--shadow`/`--shadow-lg`, `--font-display`/`--font-body`. Use these tokens rather than literal colors, radii or font stacks (the only literals are translucent overlays and the SVG mask for the hero wave). `--accent` aliases `--aqua`. Sections are styled by semantic class (`.section-label`, `.section-title`, `.section-intro`) reused across the page; section backgrounds are set in the stylesheet by id (`#gallery` is the dark lagoon panel, `#rooms` and `#location` are sand, the rest cream), not inline. Light theme only — there is no dark-mode variant.

The primary button (`.btn-primary`) is a turquoise pill with dark text; over the hero photo (the pool sits right behind the buttons), on the transparent header and inside the dark-teal `.booking-card` it flips to pale `--ice` with dark text, because a turquoise button would blend into the pool water. Keep the header booking button visible on phones too; it is the site's whole purpose.

**[script.js](js/script.js) runs unguarded at end of `<body>`.** There is no `DOMContentLoaded` wrapper and no null checks: it reaches for `#year`, `#site-header`, `#nav-toggle`, `#nav-links`, `#lightbox`, `#lightbox-img`, `#lightbox-close`, `#lightbox-prev`, `#lightbox-next` by id and will throw on the first missing one, killing every later handler. The `<script>` tag must stay last in the body, and those ids must not be renamed without updating the script.

It owns exactly four behaviors:

- **Header state** — toggles `.is-top` on `#site-header` while `window.scrollY < 40`. The header is `position: fixed`: transparent with light text over the hero at the top, solid cream once scrolled. The default (no class) is the solid look, so if the script ever fails the header stays readable.
- **Mobile nav** — toggles `.open` on `#nav-links` (a `max-height` transition in the 860px media query) and mirrors state into `aria-expanded`, which also drives the hamburger-to-X animation via the `[aria-expanded="true"]` CSS selectors. Closes on link click and on outside click.
- **Gallery lightbox** — builds an array from `.gallery-grid figure` in DOM order and navigates by index. Supports Escape / ArrowLeft / ArrowRight while open.
- **Backdrop collage** — builds the tile layer behind the gallery (see Gallery backdrop below). It is the last block so a failure there cannot break the rest.

**Reviews layout.** On desktop `.reviews-grid` is a 6-column grid with each card spanning 2, so a partly filled last row is centred; reviews can be added or removed freely. Reviews should not name the host.

**Gallery backdrop.** The `#gallery` panel background is a live collage built by the last block of [script.js](js/script.js): it inserts a `.collage` layer (aria-hidden, `position: absolute`, behind the `.container`) full of `.collage-tile` images from `images/collage-tiles/` (`p1`-`p8` portrait, `l1`-`l7` landscape, 15 photos, about 1.2 MB in total, downsized copies of the originals in `images/collage/`). Portrait photos go in tall tiles (2 grid rows) and landscape photos in wide tiles (1 row), and the script picks the column and row counts from the panel size (via a ResizeObserver) so whole tiles fit exactly with an even margin: no cut-off photos or slivers at the edges. With only 15 photos the panel needs 34-72 tiles (about 55 on a laptop), so photos repeat; the script assigns each tile the matching photo that is farthest from every copy already placed, so identical photos end up at least about 2.5 tile-widths apart. More photos in `images/collage-tiles/` would need matching `pN`/`lN` names added to the `portraits`/`landscapes` lists in script.js. Tiles are `object-fit: cover`, so a photo can lose a thin strip when its shape differs slightly from the tile. On top of the tiles, `.collage::after` paints the green film; `#gallery` itself is only a plain green gradient, which is all you see if JavaScript is off. To change the photos, replace files in `images/collage-tiles/` keeping the same names (and orientation). The photos in the grid itself are deliberately untinted so they stand out. `images/collage/` (about 32 MB of originals) is not referenced by the site and exists only for rebuilding the tiles. Two agency-licensed (Getty/Alamy-credited) files in it were deliberately not used. The bottom caption shade on each gallery photo is `figure::after`.

**Gallery layout.** `.gallery-grid` is a dense CSS grid, 3 columns on desktop and 2 at 700px and below (`--cols`), with large rounded tiles (30px radius, 22px gap). The row unit is exactly 16:9 of a column width (computed from the container width with `cqw`, so `#gallery .container` must keep `container-type: inline-size`). A landscape figure takes 1 row; a portrait figure needs `class="tall"` and takes 3 rows (about 9:16); `class="mid"` takes 2 rows (a landscape photo shown at about 4:5, used once on Pool & Garden). Each photo lands in the shortest column, so there are no holes, but the total row count decides whether the bottom edge ends level: currently 15 tall + 1 mid + 7 landscape = 54 rows, which divides evenly into both 3 and 2 columns, and the order is arranged so no two neighbours show the same subject. If you add or remove photos, re-check the bottom edge at desktop and phone width (adjust with `mid`/`tall` or reorder). New photos need `width`/`height` attributes matching the file and `loading="lazy"`.

## Conventions

- Two-space indent; double-quoted strings in JS; kebab-case class names and ids.
- Semantic HTML with accessibility attributes carried through (`aria-label`, `aria-expanded`, `aria-controls`, descriptive `alt` on every image, `title` on the map iframe). Keep this when adding markup.
- External links use `target="_blank" rel="noopener"`.
- Images are plain `<img>` with fixed filenames in `images/`; full-bleed ones use `object-fit: cover`. Gallery photos carry both a `figcaption` and a `data-caption` attribute — only the `figcaption` is rendered today.
- HTML entities for typographic characters (`&amp;`, `&ldquo;`/`&rdquo;`).
