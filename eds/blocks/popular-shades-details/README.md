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

- Auto-rotates every 3s and loops, as on the source. Choosing a shade shows it and the rotation
  carries on from there. It idles only while the block is off screen or the tab is hidden. With
  `prefers-reduced-motion` the image swaps without the fade. Use `no-autoplay` to turn it off.
- All house images are stacked and cross-faded, and the frame's size is reserved up front so
  nothing shifts while images load. On desktop the frame copies the source (988×538 at 1440px),
  with the house right-aligned, running off the left edge and stretched to fill (as the source
  does). On mobile the frame takes the first mobile image's own ratio.
- Swatches are `<button aria-pressed>` labelled "{name} {code}".
- Analytics: shade clicks fire `natural_wood_shade_click` (same as `popular-shades`); the CTA
  uses `triggerCTAClickWithLinkAndTitle`.
