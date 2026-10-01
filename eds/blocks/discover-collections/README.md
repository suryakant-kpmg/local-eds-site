# Discover Collections

A centred two-part title (the second part in the brand gradient) above one or two collections.
Each collection is a text column (heading or logo, description, Download PDF, optional View
link) beside a staggered collage of up to 8 images that grow in when the block scrolls into view.
The left collection has its text on the left; the right one is mirrored.

## Authoring

| Discover Collections | | |
|---|---|---|
| Discover | Collections | *(optional line below the title)* |
| *(left text)* | *(right text)* | |
| *(left images)* | *(right images)* | |

- **Row 1**: title, gradient part of the title, and an optional third cell shown as a line below.
- **Row 2**: per side, a heading (or a picture, shown as the collection **logo**), a description,
  the Download PDF link and an optional View link.
- **Row 3**: per side, up to 8 images (1-3 sit beside the text, 4-8 form the second group).
- A side whose text and image cells are both **empty is left out**, so one collection can be
  shown on either side.

## Variant: single — `Discover Collections (single)`

One collection led by a logo with an outlined **Download PDF** button, as in the LuxIndica
section of asianpaints.com `/paint-products/exterior-wall-paints.html` (RTE "banner-desc-text"
title + `imageCollageGrid`).

| Discover Collections (single) | | |
|---|---|---|
| LuxIndica | shades of luxurious Indian Heritage | Harmonise and guide your life with this chromatic array |
| | *(logo image)*<br>Colors are emerged not merely as embellishments …<br>[Download PDF](https://www.asianpaints.com/content/dam/asian_paints/products/exterior/ultima-heritage-luxury-luxindica-shade-booklet.pdf) | |
| | *(8 images)* | |

- Left cells empty → the collection sits on the right (images left, text right), as on the source.
- Images go through `createOptimizedPicture`, lazy-load and keep square tiles, so nothing shifts
  while they load; 4 images show on mobile.
- The logo needs alt text; the collage images are decorative (empty alt is fine).
- The Download PDF link opens in a new tab and fires the existing PDF download analytics.
- The grow-in animation is skipped with `prefers-reduced-motion`.
- Section spacing comes from the variant; keep the section's `Style | cream` metadata for the
  source background.
