/**
 * Splash Popup Block
 *
 * Content structure (authored as block table):
 * | splash-popup |
 * | --- | --- |
 * | Left Panel | Right Panel |
 *
 * Each panel cell contains:
 * - Logo image (first <picture> element)
 * - Optional background/circle image (second <picture> element)
 * - Heading (first <p> or text)
 * - Subheading (second <p> or text)
 * - CTA link (<a> element)
 *
 * Panel-specific data attributes can be added via block variants or metadata.
 */

import { loadCSS } from '../../scripts/aem.js';
import { trackEvent, pushAdobeCtaClickEvent, pushAdobeSingleEvent } from '../../scripts/analytics_1.js';

const STORAGE_KEY = 'splash-popup-shown';

/**
 * Creates an element with attributes and children
 */
function createElement(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([key, value]) => {
    if (key === 'className') node.className = value;
    else node.setAttribute(key, value);
  });
  children.forEach((child) => {
    if (typeof child === 'string') node.append(document.createTextNode(child));
    else if (child) node.append(child);
  });
  return node;
}

/**
 * Extracts panel content from authored cell
 */
function extractPanelContent(cell) {
  const pictures = cell.querySelectorAll('picture');
  const links = cell.querySelectorAll('a');
  const paragraphs = cell.querySelectorAll('p');

  // Get logo from first picture
  const logoImg = pictures[0]?.querySelector('img');

  // Get background/circle image from second picture (if exists).
  // Prefer the WebP <source> srcset over the PNG <img> src — WebP is
  // typically 10-15× smaller, which avoids heavy PNG loads.
  const bgPicture = pictures[1];
  const bgImg = bgPicture?.querySelector('img');
  const webpSource = bgPicture?.querySelector('source[type="image/webp"]');
  if (bgImg && webpSource?.srcset) {
    bgImg.src = webpSource.srcset;
  }

  // Get text content - look for paragraphs or direct text
  const texts = [];
  paragraphs.forEach((p) => {
    // Skip paragraphs that only contain pictures or links
    const hasOnlyPicture = p.querySelector('picture') && p.textContent.trim() === '';
    const hasOnlyLink = p.querySelector('a') && p.textContent.trim() === p.querySelector('a')?.textContent.trim();
    if (!hasOnlyPicture && !hasOnlyLink) {
      texts.push(p.textContent.trim());
    }
  });

  // Get CTA link
  const ctaLink = links[0];

  return {
    logo: logoImg,
    backgroundImage: bgImg,
    heading: texts[0] || '',
    subheading: texts[1] || '',
    ctaText: ctaLink?.textContent.trim() || '',
    ctaHref: ctaLink?.href || '#',
  };
}

/**
 * Builds a panel element from authored content
 */
function buildPanel(side, content, mobileBgUrl) {
  const panel = createElement('div', { className: `splash-${side}` });

  // Background image for left panel — use <img> with WebP source (19KB vs 286KB PNG).
  if (side === 'left' && content.backgroundImage) {
    const isMobile = window.matchMedia('(max-width: 719px)').matches;
    const bgSrc = isMobile && mobileBgUrl ? mobileBgUrl : content.backgroundImage.src;
    const bgImg = createElement('img', {
      className: 'splash-bg-img',
      src: bgSrc,
      alt: '',
      'aria-hidden': 'true',
    });
    panel.append(bgImg);
  }

  // Add logo
  if (content.logo) {
    const logoClass = side === 'left' ? 'splash-logo splash-logo-bh' : 'splash-logo splash-logo-ap';
    const logo = createElement('img', {
      className: logoClass,
      src: content.logo.src,
      alt: content.logo.alt || '',
      width: content.logo.width || 'auto',
      height: content.logo.height || 'auto',
      'aria-hidden': 'true',
    });
    panel.append(logo);
  }

  // Add circle image for right panel
  if (side === 'right' && content.backgroundImage) {
    const circleImg = createElement('img', {
      className: 'splash-circle-image',
      src: content.backgroundImage.src,
      alt: content.backgroundImage.alt || '',
      'aria-hidden': 'true',
    });
    panel.append(circleImg);
  }

  // Build text content
  const arrow = createElement('span', { className: 'splash-arrow' });
  const cta = createElement('a', {
    className: 'splash-cta',
    href: content.ctaHref,
    target: '_self',
  }, content.ctaText, arrow);

  // e132 - Custom CTA Click (Splash "Visit Beautiful Homes" / "Visit Asian Paints")
  cta.addEventListener('click', () => {
    trackEvent('custom_cta_click', {
      cta_: content.ctaText,
      parentTitle: content.heading || 'splash',
      // redirectionLink maps to eVar86; passing it as param1 would land in
      // contextData instead of the mapped eVar.
      redirectionLink: content.ctaHref,
    });

    pushAdobeCtaClickEvent({
      cta: content.ctaText,
      parentTitle: content.heading || 'splash',
      destinationUrl: content.ctaHref,
      event: 'custom_cta_click'
    });

  });

  const textDiv = createElement('div', { className: 'splash-text' });
  textDiv.append(
    createElement('div', { className: 'splash-heading-one' }, content.heading),
    createElement('div', { className: 'splash-heading-two' }, content.subheading),
    cta,
  );
  panel.append(textDiv);

  return panel;
}

/**
 * Marks the splash as shown in localStorage
 */
function markShown() {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    /* localStorage not available */
  }
}

/**
 * Checks if splash was already shown
 */
export function wasShown() {
  try {
    return !!localStorage.getItem(STORAGE_KEY);
  } catch {
    return false;
  }
}

/**
 * Creates and shows the splash dialog from block content
 */
async function showSplashDialog(leftContent, rightContent, mobileBgUrl) {
  // Load the CSS
  await loadCSS(`${window.hlx.codeBasePath}/blocks/splash-popup/splash-popup.css`);

  const leftPanel = buildPanel('left', leftContent, mobileBgUrl);
  const rightPanel = buildPanel('right', rightContent);

  const body = createElement('div', { className: 'splash-body' }, leftPanel, rightPanel);
  const closeBtn = createElement('button', {
    className: 'splash-close-btn',
    'aria-label': 'Close',
    type: 'button',
  });
  const dialog = createElement('dialog', {
    className: 'splash-dialog',
    role: 'dialog',
    'aria-label': 'Splash Popup',
  }, closeBtn, body);

  const isHome = window.location.pathname === '/' || window.location.pathname === '/index.html';
  const isDesktop = window.innerWidth > 991;

  if (!isHome && isDesktop) {
    dialog.classList.add('splash-small');
  }

  document.body.append(dialog);

  closeBtn.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => {
    markShown();
    dialog.remove();
    document.body.classList.remove('splash-open');
    // e18 - Splash Close
    trackEvent('splash_close');
    pushAdobeSingleEvent("splash_close");
  });

  document.body.classList.add('splash-open');
  dialog.showModal();

  // e6 - Splash Impressions
  trackEvent('splash_view');
  pushAdobeSingleEvent("splash_view");
}

/**
 * Standard EDS block decorator.
 * Reads content from the authored block table and creates a modal dialog.
 * @param {Element} block The splash-popup block element
 */
export default async function decorate(block) {
  // Hide the block - content will be shown in modal
  block.style.display = 'none';

  // Don't show if already seen
  if (wasShown()) {
    return;
  }

  // Get the row with panel content
  const rows = block.querySelectorAll(':scope > div');
  if (rows.length === 0) {
    return;
  }

  // First row contains left and right panel cells
  const cells = rows[0].querySelectorAll(':scope > div');
  if (cells.length < 2) {
    return;
  }

  // Extract content from authored cells
  const leftContent = extractPanelContent(cells[0]);
  const rightContent = extractPanelContent(cells[1]);

  // Check for mobile background URL in metadata or data attribute
  const mobileBgUrl = block.dataset.mobileBg || null;

  // Show the dialog
  await showSplashDialog(leftContent, rightContent, mobileBgUrl);
}
