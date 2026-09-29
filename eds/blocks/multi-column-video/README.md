# Multi Column Video

Intro text beside a horizontally scrolling row of video cards. Selecting a card plays
the video in a modal dialog. Migrated from the `multicolumnVideo` component on
asianpaints.com (e.g. `/paint-products/exterior-wall-paints.html`, "Homework by Asian Paints").

## Authoring

| Multi Column Video | | |
|---|---|---|
| Discover *(paragraph, optional eyebrow)*<br>**Homework by Asian Paints** *(Heading 2)*<br>A first of its kind digital content led initiative… *(paragraph)* | | |
| *(thumbnail image)* | https://www.youtube.com/watch?v=_wZy_bKndwc | **Tips to choose the correct paint for exterior walls.** *(Heading 3)*<br>The Asian Paints paint range is diverse and vast… |
| *(thumbnail image)* | https://www.youtube.com/watch?v=4EzuiKVskRE | **Understand Exterior Paint Warranty easily.** *(Heading 3)*<br>Understanding Exterior Paint warranty made easy… |

- **Intro row** (optional): any row with no image and no video link. Paragraphs before the
  heading become the eyebrow; content after it becomes the description.
- **Video rows**: thumbnail, video link, text. Cells may be in any order; the block finds the
  image, the link and the text. The title is the first heading in the text cell, or its first
  paragraph if there is no heading.
- **Video links**: YouTube (`watch`, `youtu.be`, `embed`, `shorts`), Vimeo, or a direct
  `.mp4`/`.webm`. Any other link renders the card as a plain link that opens in a new tab.
- **Thumbnails**: landscape, about 325×222 (≈1.46:1). Images are cropped to that ratio.

## Options / variants

None yet. The layout switches at 992px: stacked with swipe and dots below, side-by-side with
prev/next arrows above.

## Behaviour notes

- Slider uses native CSS scroll-snap (no library); arrows/dots update from scroll position.
- The dialog is a native `<dialog>` (focus trap, Escape, focus return); the player is removed
  on close so playback stops. YouTube/Vimeo players only load when a video is opened.
- Analytics: prev/next via `bindCarouselNavigationTracking`, video opens via
  `triggerCTAClickWithLinkAndTitle`.
