/*
** Authoring format **
Image row - Col 1: desktop image, Col 2: mobile image (optional)
Content row - heading, description, CTA link (the whole banner links to the CTA)
Settings rows (optional, two cells: name | value):
  CTA target | Same tab (default) or New tab

Options: "left" (text on the left), "dark-text" (for light images).
A breadcrumb block placed directly before this block (same section) is shown
over the top of the banner, as on the source site.
*/

import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';
import { triggerCTAClickWithLinkAndTitle } from '../../scripts/analytics_1.js';

const DESKTOP_MEDIA = '(width >= 992px)';

const SETTINGS = {
  'cta target': 'ctaTarget',
  'open link in': 'ctaTarget',
};

const settingKey = (row) => {
  const cols = [...row.children];
  if (cols.length !== 2 || row.querySelector('img')) return null;
  return SETTINGS[cols[0].textContent.trim().toLowerCase().replace(/\s+/g, ' ')] || null;
};

function isSameOrigin(img) {
  return new URL(img.src, window.location.href).origin === window.location.origin;
}

/**
 * Builds one art-directed picture from the authored desktop and mobile images.
 */
function buildPicture(desktopImg, mobileImg, eager) {
  const fallbackImg = mobileImg || desktopImg;
  const alt = desktopImg.alt || mobileImg?.alt || '';
  let picture;
  if (isSameOrigin(fallbackImg)) {
    picture = createOptimizedPicture(fallbackImg.src, alt, eager, [{ width: mobileImg ? '750' : '2000' }]);
    if (mobileImg) {
      const desktop = createOptimizedPicture(desktopImg.src, alt, eager, [{ media: DESKTOP_MEDIA, width: '2000' }]);
      picture.prepend(...desktop.querySelectorAll('source[media]'));
    }
  } else {
    // media hosted elsewhere cannot be resized by the media bus
    picture = document.createElement('picture');
    if (mobileImg) {
      const source = document.createElement('source');
      source.media = DESKTOP_MEDIA;
      source.srcset = desktopImg.src;
      picture.append(source);
    }
    const img = document.createElement('img');
    img.src = fallbackImg.src;
    img.alt = alt;
    img.loading = eager ? 'eager' : 'lazy';
    picture.append(img);
  }
  const img = picture.querySelector('img');
  if (eager) img.setAttribute('fetchpriority', 'high');
  moveInstrumentation(fallbackImg, img);
  return picture;
}

/**
 * Moves a breadcrumb block authored directly before this block into the banner.
 */
function adoptBreadcrumb(block) {
  const previous = block.parentElement?.previousElementSibling;
  if (previous?.querySelector(':scope > .breadcrumb')) block.prepend(previous);
}

export default function decorate(block) {
  const rows = [...block.children];
  const settingRows = rows.filter(settingKey);
  const imageRow = rows.find((row) => row.querySelector('img'));
  const contentRow = rows.find((row) => row !== imageRow && !settingRows.includes(row));
  const newTab = settingRows.some((row) => /^(_blank|new( tab| window)?|yes|true)$/i
    .test(row.children[1].textContent.trim()));

  const section = block.closest('.section');
  const eager = !!section && section === document.querySelector('main .section');

  const media = document.createElement('div');
  media.className = 'image-banner-media';
  const [desktopImg, mobileImg] = imageRow ? [...imageRow.querySelectorAll('img')] : [];
  if (desktopImg) {
    moveInstrumentation(imageRow, media);
    media.append(buildPicture(desktopImg, mobileImg, eager));
    // reserve the image area per breakpoint before it loads
    [[desktopImg, '--ib-desktop-ratio'], [mobileImg || desktopImg, '--ib-mobile-ratio']].forEach(([img, prop]) => {
      const width = img.getAttribute('width');
      const height = img.getAttribute('height');
      if (width && height) block.style.setProperty(prop, `${width} / ${height}`);
    });
  }

  const content = document.createElement('div');
  content.className = 'image-banner-content';
  if (contentRow) {
    moveInstrumentation(contentRow, content);
    [...contentRow.children].forEach((col) => content.append(...col.childNodes));
  }
  const heading = content.querySelector('h1, h2, h3, h4, h5, h6');
  heading?.classList.add('image-banner-title');

  const link = [...content.querySelectorAll('a[href]')].pop();
  if (link) {
    const wrapper = link.closest('p');
    const cta = document.createElement('p');
    cta.className = 'image-banner-cta';
    link.className = '';
    cta.append(link);
    content.append(cta);
    if (wrapper && !wrapper.textContent.trim()) wrapper.remove();
    link.insertAdjacentHTML('beforeend', '<span class="image-banner-cta-arrow" aria-hidden="true"></span>');
    if (newTab) {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.setAttribute('aria-label', `${link.textContent.trim()} (opens in a new tab)`);
    }
    link.addEventListener('click', () => {
      triggerCTAClickWithLinkAndTitle(link.href, link.textContent.trim(), heading?.textContent.trim() || '');
    });
    block.classList.add('is-linked');
  }

  block.replaceChildren(media, content);
  adoptBreadcrumb(block);
}
