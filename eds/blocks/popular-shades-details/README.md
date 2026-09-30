# Popular Shades Details

House preview beside a heading and CTA; picking a shade swatch repaints the house. Migrated
from the `productdetailscta` component on asianpaints.com
(`/paint-products/exterior-wall-paints.html`, "Popular Shades").

## Authoring

| Popular Shades Details | | | | |
|---|---|---|---|---|
| **Popular *Shades*** *(Heading 2, italic = gradient)*<br>From elegant neutrals to rich, vibrant hues…<br>[View Catalogue](https://www.asianpaints.com/catalogue/colour-catalogue.html) | | | | |
| *(desktop image)* | *(mobile image)* | #FCDAB7 | Marigold | #7986 |
| *(desktop image)* | *(mobile image)* | #EFDFCE | Memories | #8580 |

- **Intro row**: any row without an image. Words in *italic* inside the heading get the brand
  gradient (`--gradient-brand`). The last link becomes the pill CTA.
- **Shade rows**: desktop image, optional mobile image (shown below 992px), swatch colour,
  name, code. Same column order as the `popular-shades` block. The colour is the text cell that
  looks like a hex/rgb/hsl colour; the remaining text cells are name then code.
- **Alt text**: the image's alt, or "House exterior painted in {name}".

## Options

- `no-autoplay` — *Popular Shades Details (no-autoplay)* turns off auto-rotation.

## Behaviour notes

- Auto-rotates every 3s (as on the source) only while ≥30% visible; pauses on hover/focus and
  when the tab is hidden; a visible pause/play button satisfies WCAG 2.2.2. Choosing a shade
  stops the rotation. Off by default for `prefers-reduced-motion`.
- All house images are stacked and cross-faded; the frame's aspect ratio comes from the first
  image's intrinsic size, so nothing shifts while images load.
- Swatches are `<button aria-pressed>` labelled "{name} {code}".
- Analytics: shade clicks fire `natural_wood_shade_click` (same as `popular-shades`); the CTA
  uses `triggerCTAClickWithLinkAndTitle`.
