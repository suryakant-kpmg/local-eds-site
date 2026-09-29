# Splash Popup Block Template

The splash-popup block displays a two-panel promotional modal dialog on first visit.

## Content Location

The splash popup content is authored in a fragment file:
`/content/fragments/splash-popup.plain.html`

This file is loaded automatically by `scripts.js` on pages where the splash should appear.

## Authoring Structure

| splash-popup |
| --- | --- |
| **Left Panel Content** | **Right Panel Content** |

Each panel cell should contain (in order):
1. **Logo** - First image (picture element)
2. **Background/Circle Image** - Second image (optional, used as panel background for left panel, circle image for right panel)
3. **Heading** - First paragraph text
4. **Subheading** - Second paragraph text
5. **CTA Link** - Link element with button text

## Example HTML Structure

```html
<div class="splash-popup" data-mobile-bg="/eds/content/images/splash-popup/mobile-bg.webp">
  <div>
    <!-- Left Panel -->
    <div>
      <p><picture><img src="/eds/content/images/splash-popup/logo-left.webp" alt="Logo" width="135" height="40"></picture></p>
      <p><picture><img src="/eds/content/images/splash-popup/background.webp" alt=""></picture></p>
      <p>Heading Text</p>
      <p>Subheading Text</p>
      <p><a href="https://example.com">CTA Button Text</a></p>
    </div>
    <!-- Right Panel -->
    <div>
      <p><picture><img src="/eds/icons/logo-right.svg" alt="Logo" width="154" height="29"></picture></p>
      <p><picture><img src="/eds/content/images/splash-popup/circle-image.webp" alt=""></picture></p>
      <p>Heading Text</p>
      <p>Subheading Text</p>
      <p><a href="https://example.com">CTA Button Text</a></p>
    </div>
  </div>
</div>
```

## Image Locations

- **SVG logos/icons**: `/eds/icons/` (for vector icons)
- **Webp/jpg images**: `/eds/content/images/splash-popup/` (for photos, backgrounds)

## Optional Configuration

Add `data-mobile-bg` attribute to the block for a different mobile background:

```html
<div class="splash-popup" data-mobile-bg="/eds/content/images/splash-popup/mobile-home-decor-image.webp">
```

## Behavior

- Shows modal on first visit only (stored in localStorage)
- Closes on X button click or clicking outside the dialog
- Remembers dismissal across sessions
- Left panel uses second image as background
- Right panel shows second image as a circular overlay
