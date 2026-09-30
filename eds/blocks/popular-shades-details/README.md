# Popular Shades Details

House preview beside a heading and CTA; picking a shade swatch repaints the house. Migrated
from the `productdetailscta` component on asianpaints.com
(`/paint-products/exterior-wall-paints.html`, "Popular Shades").

## Authoring

| Popular Shades Details | | | | |
|---|---|---|---|---|
| **Popular *Shades*** *(Heading 2, italic = gradient)*<br>From elegant neutrals to rich, vibrant hues… | | | | |
| CTA label | View Catalogue | | | |
| CTA link | https://www.asianpaints.com/catalogue/colour-catalogue.html | | | |
| CTA target | Same tab | | | |
| Autoplay | Yes | | | |
| Autoplay interval | 3000 | | | |
| *(desktop image)* | *(mobile image)* | #FCDAB7 | Marigold | #7986 |
| *(desktop image)* | *(mobile image)* | #EFDFCE | Memories | #8580 |

- **Intro row**: the first row that has no image and isn't a setting. Words in *italic* inside
  the heading get the brand gradient (`--gradient-brand`).
- **Settings rows** (optional, any order, two cells: name | value; names are case-insensitive):

  | Setting | Values | Default | Source equivalent |
  |---|---|---|---|
  | CTA label | any text | the CTA link's text | CTA label |
  | CTA link | a link or URL | last link in the intro, if any | CTA link |
  | CTA target | Same tab / New tab (or `_self` / `_blank`) | Same tab | target |
  | Autoplay | Yes / No | Yes | `autoswitch` |
  | Autoplay interval | milliseconds (`3000`) or seconds (`3s`), minimum 1000ms | 3000 | `autoplaytimeout` |

  Aliases: "CTA text", "Button label", "CTA URL", "Button link", "Open link in", "Autoswitch",
  "Autoplay timeout", "Interval". Without a CTA link row, the last link in the intro becomes
  the CTA (older content keeps working). "New tab" adds `rel="noopener noreferrer"` and tells
  screen-reader users the link opens in a new tab.
- **Shade rows**: desktop image, optional mobile image (shown below 992px), swatch colour,
  name, code. Same column order as the `popular-shades` block. The colour is the text cell that
  looks like a hex/rgb/hsl colour; the remaining text cells are name then code.
- **Alt text**: the image's alt, or "House exterior painted in {name}".

## Options

- `no-autoplay` — *Popular Shades Details (no-autoplay)* turns off auto-rotation, the same as
  an `Autoplay | No` settings row.

## Behaviour notes

- Auto-rotates every 3s (or the configured interval) and loops, as on the source. Choosing a
  shade shows it and the rotation carries on from there. It idles only while the block is off
  screen or the tab is hidden. With `prefers-reduced-motion` the image swaps without the fade.
- The CTA is a pill with the source's hover (light cream fill, dark text).
- All house images are stacked and cross-faded, and the frame's size is reserved up front so
  nothing shifts while images load. On desktop the frame copies the source (988×538 at 1440px),
  with the house right-aligned, running off the left edge and stretched to fill (as the source
  does). On mobile the frame takes the first mobile image's own ratio.
- Swatches are `<button aria-pressed>` labelled "{name} {code}".
- Analytics: shade clicks fire `natural_wood_shade_click` (same as `popular-shades`); the CTA
  uses `triggerCTAClickWithLinkAndTitle`.
