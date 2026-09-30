# Image Banner

Full-width image with centred heading, description and a yellow pill CTA; the whole banner links
to the CTA. Migrated from the `imagebanner` component on asianpaints.com
(`/paint-products/exterior-wall-paints.html`, "Exterior Wall Paints").

## Authoring

Place a **Breadcrumb** block directly before the Image Banner (same section) to show it over the
top of the banner, as on the source:

| Breadcrumb | |
|---|---|
| Home | / |
| Exterior Paints | [/paint-products/exterior-wall-paints.html](/paint-products/exterior-wall-paints.html) |

| Image Banner | |
|---|---|
| *(desktop image, 1440×640)* | *(mobile image, 1236×1374 — optional)* |
| **Exterior Wall Paints** *(heading)*<br>Explore the versatile range of exterior paint products for your home!<br>[Explore Now](https://www.asianpaints.com/paint-products/exterior-wall-paints/plain-finishes.html) | |
| CTA target | Same tab |

- **Image row**: desktop image, optional mobile image (shown below 992px). Alt text comes from the
  image. The frame keeps each image's own ratio, so nothing shifts while it loads.
- **Content row**: a heading, description and a link. The last link becomes the CTA and makes the
  whole banner clickable (one tab stop; the breadcrumb links stay separately clickable).
- **Settings row** (optional): `CTA target | Same tab / New tab`.
- The site's SEO script turns the page's first heading into a hidden H1 and shows visible H1s as
  H2, so the banner title renders as an H2. Set a Metadata `h1` to override the H1 text.

## Options

- `left` — *Image Banner (left)*: text on the left half (desktop).
- `dark-text` — *Image Banner (dark-text)*: dark text for light images.

## Behaviour notes

- In the first section, the image loads eagerly with `fetchpriority="high"` (it's the LCP);
  elsewhere it's lazy.
- The breadcrumb stays its own block (authored as before); the banner moves it into its top-left
  corner and recolours it to the source browns. It's hidden below 992px by the breadcrumb block,
  as on the source.
- Analytics: CTA/banner clicks use `triggerCTAClickWithLinkAndTitle`.
