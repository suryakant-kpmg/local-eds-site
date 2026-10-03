import { createOptimizedPicture } from '../../scripts/aem.js';
import removeLabelRows from '../../scripts/block-labels.js';

// author label rows in the DA table (see scripts/block-labels.js)
const LABELS = [
  'Section title',
  'Product image',
  'Step label',
  'Step type',
  'Product name',
  'Coats',
  'Product URL',
];

const URL_TEXT = /^(https?:\/\/|\/)\S+$/i;

function optimize(picture) {
  const img = picture?.querySelector('img');
  if (!img) return null;
  // only media bus (same-origin) images support the optimization params
  if (new URL(img.src, window.location.href).origin !== window.location.origin) return picture;
  return createOptimizedPicture(img.src, img.alt, false, [{ width: '320' }]);
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

// a cell holding only a URL: a link whose text is the URL, or plain URL text
function urlOf(cell) {
  const text = cell.textContent.trim();
  if (!URL_TEXT.test(text)) return '';
  const a = cell.querySelector('a');
  return a ? a.href : new URL(text, window.location.href).href;
}

function buildHeader(cells) {
  const cell = cells.find((c) => c.textContent.trim());
  if (!cell) return null;
  const heading = cell.querySelector('h1, h2, h3, h4, h5, h6')
    || el('h2', '', cell.textContent.trim());
  heading.classList.add('applicationprocess-title');
  return heading;
}

function buildStep(row, index) {
  const cells = [...row.children];
  const imageCell = cells.find((cell) => cell.querySelector('picture'));
  const linkCell = cells.find((cell) => cell !== imageCell && urlOf(cell));
  const [stepCell, typeCell, nameCell, coatsCell] = cells
    .filter((cell) => ![imageCell, linkCell].includes(cell));

  const text = (cell) => cell?.textContent.trim() || '';
  const step = text(stepCell) || `Step ${String(index + 1).padStart(2, '0')}`;
  const type = text(typeCell);
  const name = text(nameCell);
  const coats = text(coatsCell);
  const url = linkCell ? urlOf(linkCell) : '';

  const item = el('li', 'applicationprocess-step');

  const top = el('div', 'applicationprocess-top');
  top.append(el('p', 'applicationprocess-label', step));
  if (type) top.append(el('h3', 'applicationprocess-type', type));

  // grey circle with the product image (linked to the product page)
  const media = el('div', 'applicationprocess-media');
  const picture = optimize(imageCell?.querySelector('picture'));
  if (picture) {
    const img = picture.querySelector('img');
    if (img && (!img.alt || img.alt === 'Product Image') && name) img.alt = name;
    if (url) {
      const a = el('a', 'applicationprocess-link');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener';
      a.setAttribute('aria-label', `${name || type || step} (opens in a new tab)`);
      a.append(picture);
      media.append(a);
    } else {
      media.append(picture);
    }
  }

  const info = el('div', 'applicationprocess-info');
  if (name) info.append(el('p', 'applicationprocess-name', name));
  if (coats) info.append(el('p', 'applicationprocess-coats', coats));

  item.append(top, media, info);
  return item;
}

/**
 * applicationprocess – migrated from the AEM "applicationProc" component
 * ("How to apply"): a heading and numbered steps, each with a product image in
 * a grey circle (linked to the product page), product name and number of coats.
 * Desktop/tablet (>= 768px): steps side by side.
 * Mobile (< 768px): one step per row, image and text alternating sides.
 *
 * Authoring (DA table):
 * Label rows (the LABELS above, e.g. "Section title") may sit above any row
 * to guide authors; they are removed before rendering.
 *
 * | applicationprocess |        |        |               |        |              |
 * | ------------------ | ------ | ------ | ------------- | ------ | ------------ |
 * | Section title      |        |        |               |        |              |
 * | Image              | Step   | Type   | Product name  | Coats  | Product URL  |
 * | ...one row per step...                                                       |
 *
 * - Row 1: block name only ("applicationprocess").
 * - Row 2 – Header (optional, no image): section title, rendered as an h2,
 *   e.g. "How to apply". AEM: title
 * - Rows 3+ – Steps (one row per step, in order):
 *   - Column 1 – Image (required): product packshot, transparent PNG
 *     (about 154 x 184). Its alt text is used for accessibility; when it is
 *     empty or "Product Image", the product name is used.
 *   - Column 2 – Step (optional): step label, e.g. "Step 01". Leave empty to
 *     number steps automatically (Step 01, Step 02, ...).
 *   - Column 3 – Type (optional): what the step applies, e.g. "PRIMER",
 *     "PUTTY", "TOP COAT".
 *   - Column 4 – Product name (optional), e.g. "Royale Wall Base Coat".
 *   - Column 5 – Coats (optional), e.g. "1 COAT", "2 COATS".
 *   - Column 6 – Product URL (optional): product page the image links to,
 *     as plain text or a link; opens in a new tab like the original.
 * - Add or remove step rows to change the number of steps.
 *
 * @param {Element} block
 */
export default function decorate(block) {
  removeLabelRows(block, LABELS);
  const rows = [...block.children].filter((row) => row.textContent.trim() || row.querySelector('picture'));

  let header;
  if (rows[0] && !rows[0].querySelector('picture')) {
    header = buildHeader([...rows.shift().children]);
  }

  const list = el('ol', 'applicationprocess-steps');
  rows.forEach((row, i) => list.append(buildStep(row, i)));

  block.replaceChildren(...(header ? [header] : []), list);
}
