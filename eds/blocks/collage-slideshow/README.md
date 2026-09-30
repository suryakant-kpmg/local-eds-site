# Collage Slideshow

A slideshow of image (or video) collages beside an intro text panel with a CTA. Row 1 is the
intro; every following row is one slide. Uses the site's Swiper loader (`window.loadSwiper`).

## Default — `Collage Slideshow`

The original interior-page layout (e.g. Royale collections): slide 1 is a video collage
(logo + 4 video links), later slides are 9- or 5-cell image collages. Styling follows slide
position. Unchanged by the images variant.

## Variant: images — `Collage Slideshow (images)`

Image-only collages migrated from the `collageslideshow` component on asianpaints.com
(`/paint-products/exterior-wall-paints.html`, "Get inspired by our Exquisite Collections").
Each slide's layout follows the number of **filled** cells (empty cells are ignored), so slides
can come in any order:

| Filled cells | Layout |
|---|---|
| 9 | logo + 8 images in four staggered columns |
| 6 | logo + large image, then a wide image over two stacked images and a tall one |
| 5 | logo + large image, then a wide image over two images |
| any video link | falls back to the default video collage |

### Authoring

| Collage Slideshow (images) | | | | | | | | |
|---|---|---|---|---|---|---|---|---|
| Get inspired by our<br>**Exquisite Collections**<br>Elevate your style and imagination with the range of Texture Collections.<br>[Get inspired](https://www.asianpaints.com/texture-paints/exterior-textures/inspiration.html) | | | | | | | | |
| *(logo)* | *(image)* | *(image)* | *(image)* | *(image)* | *(image)* | *(image)* | *(image)* | *(image)* |
| *(logo)* | *(large)* | *(wide)* | *(small)* | *(small)* | *(tall)* | | | |

| Section Metadata | |
|---|---|
| Id | collage_slides_how |

- **Intro row**: one paragraph each for the eyebrow, the **bold** title (rendered with the
  brand gradient), the description and the CTA link.
- **Slide rows**: cell 1 is the logo (give it alt text); the other images are decorative on the
  source, so an empty alt is fine. Images are served through `createOptimizedPicture` and
  lazy-loaded; every tile has a fixed size, so nothing shifts while they load.
- **Section Metadata `Id`** gives the section an `id`, the target of the Cards (tabs)
  "Texture Collection" jump link.
- **`no-autoplay`**: add it to the block name, e.g. `Collage Slideshow (images, no-autoplay)`.

### Behaviour

- Auto-rotates every 3s (as on the source) and rewinds after the last slide; only while the block
  is on screen and the tab is visible. Not at all with `prefers-reduced-motion`.
- No pause button, as on the source; the dots are keyboard buttons ("Go to slide N") from
  Swiper's a11y module. Use `no-autoplay` where a static collage is needed.
- Sizes are fractions of the collage width (container query units), measured from the source at
  705px (desktop, ≥992px) and 355px (mobile), so the collage scales with the viewport.
- On mobile the text sits above the collage and the CTA moves below the dots, as on the source.
