/*
** Authoring format **
Store Banner Block

Row 1 (Banner Content)
Col 1 → Desktop banner image (picture)
Col 2 → Mobile banner image (picture)
Col 3 → CTA link (anchor) (optional)

----------------------------------------

Field Details:

Desktop Image:
- Used for screens > 768px
- Should be wide format (e.g., 2880 × 1200)
- Prefer optimized formats (WebP / AVIF)

Mobile Image:
- Used for screens ≤ 768px
- Should be mobile-friendly ratio (e.g., taller or square)
- Avoid using same desktop image to prevent cropping issues

CTA Link (optional):
- If omitted (or the cell is empty), the banner renders as a plain, non-clickable image
- When provided, the entire banner becomes clickable
- Use anchor (<a>) with proper URL
- Link text is not displayed (image acts as CTA)
- Accessible via aria-label (taken from image alt)

----------------------------------------

Behavior:

- Banner renders as a responsive <picture>
- Mobile image loads via media query
- Desktop image is default fallback
- Entire banner is wrapped in a clickable link (only when a CTA link is authored)

----------------------------------------

Important:

- Always provide alt text for accessibility
- Do NOT include text inside the block (image-only block)
- Ensure correct aspect ratios for both images
- Avoid very large file sizes (>300KB recommended)

----------------------------------------

Variants:

- Default → standard banner
- bg-cream → background wrapper applied via section

*/

import { triggerCTAClickWithLinkAndTitle } from '../../scripts/analytics_1.js';

export default function decorate(block) {
  const row = block.querySelector(':scope > div');
  if (!row) return;

  const columns = [...row.children];
  if (columns.length < 2) return;

  const desktopPicture = columns[0].querySelector('picture');
  const mobilePicture = columns[1].querySelector('picture');
  // CTA link is optional: without it the banner renders as a plain image
  const linkEl = columns[2]?.querySelector('a');

  if (!desktopPicture || !mobilePicture) return;

  const desktopImg = desktopPicture.querySelector('img');
  const mobileImg = mobilePicture.querySelector('img');
  const desktopSource = desktopPicture.querySelector('source');
  const mobileSource = mobilePicture.querySelector('source');

  if (!desktopImg || !mobileImg) return;

  const picture = document.createElement('picture');

  // Mobile source
  const mobileSrc = document.createElement('source');
  mobileSrc.media = '(max-width: 768px)';
  mobileSrc.srcset = mobileSource?.srcset || mobileImg.currentSrc || mobileImg.src;

  // Desktop source
  const desktopSrc = document.createElement('source');
  desktopSrc.media = '(min-width: 769px)';
  desktopSrc.srcset = desktopSource?.srcset || desktopImg.currentSrc || desktopImg.src;

  const img = document.createElement('img');
  img.src = desktopImg.currentSrc || desktopImg.src;
  img.alt = desktopImg.alt || mobileImg.alt || 'Banner';
  // Preserve authored `title` (used by analytics as the CTA label / eVar45).
  const authoredTitle = desktopImg.getAttribute('title') || mobileImg.getAttribute('title') || linkEl?.getAttribute('title') || '';
  if (authoredTitle) img.title = authoredTitle;

  // LCP-critical settings
  img.loading = 'lazy';
  img.decoding = 'async';
  img.setAttribute('fetchpriority', 'auto');
  img.setAttribute('sizes', '100vw');

  // Add intrinsic dimensions to reserve layout space
  if (desktopImg.getAttribute('width')) {
    img.setAttribute('width', desktopImg.getAttribute('width'));
  } else if (desktopImg.width) {
    img.width = desktopImg.width;
  }

  if (desktopImg.getAttribute('height')) {
    img.setAttribute('height', desktopImg.getAttribute('height'));
  } else if (desktopImg.height) {
    img.height = desktopImg.height;
  }

  picture.append(mobileSrc, desktopSrc, img);

  // no CTA authored: render the image in a plain wrapper (same class keeps the layout styles)
  if (!linkEl) {
    const bannerWrap = document.createElement('div');
    bannerWrap.className = 'store-banner-link';
    bannerWrap.appendChild(picture);
    block.textContent = '';
    block.appendChild(bannerWrap);
    return;
  }

  const bannerLink = document.createElement('a');
  bannerLink.href = linkEl.href;
  bannerLink.className = 'store-banner-link';
  bannerLink.setAttribute('aria-label', img.alt);
  bannerLink.appendChild(picture);

  // Per-banner analytics overrides keyed by a substring of the destination URL.
  // Used when the banner is image-only (no visible text in the DOM) so QA gets
  // meaningful eVar45 / eVar67 values without depending on the author's `alt`.
  const ANALYTICS_OVERRIDES = [
    {
      match: 'interior-texture-finder-tool',
      btnTitle: "Let's get started",
      parentTitle: 'Find your perfect interior texture',
    },
    {
      match: 'home-colour-guide',
      btnTitle: 'home-colour-guide-banner',
      parentTitle: 'Home Colour Guide',
    },
  ];

  bannerLink.addEventListener('click', () => {
    const ctaLink = bannerLink.getAttribute('href') || '';

    const override = ANALYTICS_OVERRIDES.find((o) => ctaLink.includes(o.match));

    // eVar45 (CTA label): override → image `title` → alt → default
    // Ignore title values that are URLs/paths (authoring mistake) — fall through to alt.
    const rawTitle = img.getAttribute('title')?.trim() || '';
    const titleIsUrl = rawTitle.startsWith('/') || rawTitle.startsWith('http');
    const btnTitle = override?.btnTitle
      || (!titleIsUrl ? rawTitle : '')
      || img.alt?.trim()
      || 'Store Banner';

    // eVar67 (parent title): override → section heading → alt → btnTitle
    const sectionHeading = block.closest('.section')
      ?.querySelector('h1, h2, h3, h4, h5, h6')
      ?.textContent.trim();
    const parentTitle = override?.parentTitle
      || sectionHeading
      || img.alt?.trim()
      || btnTitle;

    triggerCTAClickWithLinkAndTitle(ctaLink, btnTitle, parentTitle);
  });

  block.textContent = '';
  block.appendChild(bannerLink);
}
