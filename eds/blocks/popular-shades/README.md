# Popular Shades

A room/house preview that cross-fades to the chosen shade, with a row of shade swatches and an
intro panel (heading, description, CTA). Uses the site's Swiper loader (`window.loadSwiper`).

## Authoring

| Popular Shades | | | | |
|---|---|---|---|---|
| **Popular Shades** *(heading)*<br>description<br>[View Catalogue](https://www.asianpaints.com/catalogue/colour-catalogue.html) | | | | |
| *(desktop image)* | *(mobile image)* | #FCDAB7 | Marigold | #7986 |
| *(desktop image)* | *(mobile image)* | #EFDFCE | Memories | #8580 |

- **Row 1**: heading (the text "Popular Shades" gets the gradient on "Shades"), description and
  the CTA link (label and URL are authored here).
- **Shade rows**: desktop image, mobile image, swatch colour (hex), shade name, shade code. Give
  the images alt text (e.g. "House exterior painted in Marigold").

## Variant: exterior — `Popular Shades (exterior)`

Migrated from the `productdetailscta` component on asianpaints.com
(`/paint-products/exterior-wall-paints.html`).

- Desktop (≥992px): the house runs off the left edge of a 988×538 frame, with the text on the
  right and 96px rounded swatches below the picture. Mobile: the title and description sit over
  the top of the picture, the swatches overlap its foot and the CTA is centred below.
- Rotates to the next shade every 3s, as on the source, only while the block is on screen and the
  tab is visible; choosing a shade restarts the interval. No rotation with
  `prefers-reduced-motion`, or add `no-autoplay`: `Popular Shades (exterior, no-autoplay)`.
- Pictures go through `createOptimizedPicture` (desktop image from 992px, mobile image below),
  lazy-load, and their frame reserves space (no layout shift).
- Swatches are buttons with `aria-pressed`; the active one stays scrolled into view on mobile.
  Choosing one fires the existing shade-click analytics.

The default variant (e.g. `/paint-products/interior-wall-paints`) is unchanged.
