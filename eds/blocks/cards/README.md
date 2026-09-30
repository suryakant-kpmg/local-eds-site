# Cards

Card lists. The variant is set in the block name, e.g. `Cards (grid, interior-hero)`; existing
variants: `grid`, `interior-hero`, `benefits`, `stats`, `services`, `room`, `gallery`, `cta`.

## Variant: tabs — `Cards (tabs)`

Tabbed rows of product cards: each card is a background image with a centred title, warranty
line and an Explore pill; a tab can end with a centred CTA (e.g. a jump link). Migrated from the
`bannerAccordian` component on asianpaints.com (`/paint-products/exterior-wall-paints.html`,
"Wall Paints | Textures"). Card rows use the same columns as `Cards (grid, interior-hero)`
(desktop image | mobile image | text), so content moves between them; the difference is that the
card text is real HTML here rather than baked into the image.

### Authoring

| Cards (tabs) | | |
|---|---|---|
| Wall Paints | | |
| *(desktop image)* | *(mobile image)* | **Ultima** *(Heading 3)*<br>Upto **15** Years<br>Performance Warranty<br>[Explore](https://www.asianpaints.com/paint-products/exterior-wall-paints/ultima.html) |
| *(desktop image)* | *(mobile image)* | **Apex** … |
| Textures | | |
| *(desktop image)* | *(mobile image)* | **Allura** … |
| *(desktop image)* | *(mobile image)* | **All Products** *(no warranty lines)*<br>[Explore](…) |
| Tab CTA | Texture Collection | collage_slides_how |

- **Tab row**: one text cell (the tab label). Every row below it belongs to that tab until the
  next tab row. With a single unnamed tab, no tab bar is shown.
- **Card row**: desktop image, optional mobile image (shown below 992px), then the text cell.
  **Bold** text in the warranty line becomes the large number. The last link is the card CTA and
  makes the whole card clickable; its accessible name is "{label} {title}".
- **Tab CTA row**: `Tab CTA | label | jump id`. The jump id is a **placeholder you configure**:
  it scrolls to the element with that id, or to a section whose Section Metadata sets
  `Id | collage_slides_how`. Until such a target exists it is a plain `#id` anchor. Instead of a
  jump id, put a link in the label cell to make it a normal link.

### Behaviour notes

- Tabs follow the WAI-ARIA tabs pattern (`tablist`/`tab`/`tabpanel`, arrow keys, Home/End,
  roving tabindex). Hidden panels are `hidden`, so their lazy images load when first shown.
- Desktop (≥992px): 294×550 cards centred in a row. Mobile: 152×352 cards in a swipeable row;
  the card CTA collapses to a 28px arrow button (label kept for screen readers).
- The jump scroll lands the target just below the fixed site header and moves focus to it.
- The variant uses its own `cards-tabs-*` classes, so the generic `.cards > ul` card styles and
  the other variants' rules don't apply to it.
- Analytics: card CTAs fire `product_cards` (GA4) and `triggerCTAClickWithLinkAndTitle`; the
  tab CTA fires `triggerCTAClickWithLinkAndTitle`.
