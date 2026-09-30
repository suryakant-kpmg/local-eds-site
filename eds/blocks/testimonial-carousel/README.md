# Testimonial Carousel

A Swiper carousel of video cards; the play button opens the video in a popup. Settings are
labelled two-cell rows (`Title | …`, `Subtitle | …`, `Play icon | <image>`), then one row per
card. Variants share the parsing, Swiper setup and video popup; each has its own card body and
CSS section.

| Variant | Block name | Cards |
|---|---|---|
| Default | `Testimonial Carousel` | thumbnail, quote, name, place |
| Stories | `Testimonial Carousel (stories-variant)` | thumbnail, bold quote, name, views |
| Home-work | `Testimonial Carousel (home-work)` | thumbnail, video title, description |

## Variant: home-work

Migrated from the `multicolumnVideo` component on asianpaints.com
(`/paint-products/exterior-wall-paints.html`, "Discover / Homework by Asian Paints").

### Authoring

| Testimonial Carousel (home-work) | | | |
|---|---|---|---|
| Eyebrow | Discover | | |
| Title | Homework by Asian Paints | | |
| Subtitle | A first of its kind digital content led initiative, … | | |
| Play icon | *(play icon image)* | | |
| *(thumbnail)* | https://www.youtube.com/embed/_wZy_bKndwc | Tips to choose the correct paint for exterior walls. | The Asian Paints paint range is diverse and vast. … |
| *(thumbnail)* | https://www.youtube.com/embed/4EzuiKVskRE | Understand Exterior Paint Warranty easily. | … |

- **Eyebrow** (new, home-work only), **Title** and **Subtitle** (shown as the description) are
  optional; labels are case-insensitive.
- **Video rows**: thumbnail (give it alt text), a YouTube **embed** link, the title and the
  description. Thumbnails go through `createOptimizedPicture` and lazy-load.
- Put the block in its own section: EDS names the section `testimonial-carousel-container`, the
  same class as the block's inner container, so other blocks in that section would be laid out
  beside it on desktop.

### Behaviour

- Mobile: text above a swipeable row of 253px cards and faded dots. Desktop (≥992px): text in the
  left 40%, 325px cards bleeding off the right edge, round arrows below (disabled at either end).
- Play buttons are named "Play video: {title}". The popup is a modal dialog labelled with the
  video title; focus moves to its close button and returns to the play button on close
  (Escape, close button or backdrop). Closing removes the player, which stops the video.
- Swiper starts when the block is 300px from the viewport; until then the first card is shown in
  place.
