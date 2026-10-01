import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

/**
 * Image block: the source's "trending articles" grid of image items (AEM image component with
 * optional text and CTA). One row per item:
 *   | image (desktop, optional second image below 768px) | link only                  |
 *   | image                                              | text paragraphs + CTA link |
 * With only a link, the whole image is that link, named by the image's alt text (or the link
 * text). With text, the text sits under the image and the last link is a "View Collection" style
 * button. Items sit side by side on desktop (up to 3 per row) and stack on mobile.
 */
const NARROW_MEDIA = '(min-width: 768px)';

// the images carry width/height; expose the ratios so the space is reserved before loading
const ratio = (img) => {
  const w = Number(img.getAttribute('width'));
  const h = Number(img.getAttribute('height'));
  return w && h ? `${w} / ${h}` : '';
};

function buildPicture(wide, narrow, alt, eager) {
  const small = narrow || wide;
  const picture = createOptimizedPicture(small.src, alt, eager, [{ width: '750' }]);
  if (narrow) {
    const big = createOptimizedPicture(wide.src, '', eager, [
      { media: NARROW_MEDIA, width: '1500' },
      { width: '750' },
    ]);
    picture.prepend(...big.querySelectorAll(`source[media="${NARROW_MEDIA}"]`));
  }
  const img = picture.querySelector('img');
  if (eager) img.setAttribute('fetchpriority', 'high');
  moveInstrumentation(wide, img);
  return picture;
}

// text under the image; the last link becomes the CTA button
function buildBody(cell, name) {
  const body = document.createElement('div');
  body.className = 'image-block-body';
  body.append(...cell.childNodes);
  const cta = [...body.querySelectorAll('a[href]')].pop();
  if (cta) {
    cta.classList.remove('button', 'primary', 'secondary');
    cta.classList.add('image-block-cta');
    cta.closest('.button-container')?.classList.remove('button-container');
    // several items share the CTA text ("View Collection"); name the item for screen readers
    if (name && !cta.textContent.includes(name)) {
      const context = document.createElement('span');
      context.className = 'image-block-sr-only';
      context.textContent = `: ${name}`;
      cta.append(context);
    }
  }
  return body;
}

function buildItem(row, eager) {
  const cells = [...row.children];
  const imageCell = cells.find((cell) => cell.querySelector('img'));
  const [wide, narrow] = imageCell ? [...imageCell.querySelectorAll('img')] : [];
  if (!wide) return null;
  const contentCell = cells.find((cell) => cell !== imageCell && cell.textContent.trim());
  const links = contentCell ? [...contentCell.querySelectorAll('a[href]')] : [];
  const linkText = links.map((a) => a.textContent).join('');
  // only a link and no other text: the whole image is that link
  const imageLink = links.length === 1
    && contentCell.textContent.trim() === linkText.trim() ? links[0] : null;
  const alt = wide.alt || imageLink?.textContent.trim() || '';

  const item = document.createElement(imageLink ? 'a' : 'div');
  item.className = 'image-block-item';
  if (imageLink) {
    item.href = imageLink.href;
    if (imageLink.target) item.target = imageLink.target;
    moveInstrumentation(imageLink, item);
  }
  moveInstrumentation(row, item);
  if (ratio(wide)) item.style.setProperty('--image-block-ratio', ratio(wide));
  if (ratio(narrow || wide)) item.style.setProperty('--image-block-ratio-small', ratio(narrow || wide));
  item.append(buildPicture(wide, narrow, alt, eager));
  if (contentCell && !imageLink) {
    item.classList.add('image-block-card');
    item.append(buildBody(contentCell, wide.alt));
  }
  return item;
}

export default function decorate(block) {
  const main = block.closest('main');
  // eager (and high priority) only when the block opens the page, as the likely LCP
  const eager = Boolean(main) && block.closest('.section') === main.querySelector('.section');
  const items = [...block.children].map((row) => buildItem(row, eager)).filter(Boolean);
  block.style.setProperty('--image-block-columns', Math.min(items.length, 3) || 1);
  block.classList.toggle('image-block-cards', items.some((item) => item.classList.contains('image-block-card')));
  block.replaceChildren(...items);
}
