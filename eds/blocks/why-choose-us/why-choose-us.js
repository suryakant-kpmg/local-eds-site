/*
** Authoring format **
Row 1: Title | block heading (e.g. Why Choose Us?)
Row 2: Description | text below the heading
Row 3: CTA | link (optional, no button when empty)
Row 4: Open in new tab | true/false
Row 5: Image | Title | Subtitle (header row, skipped)
Rows 6+: Col 1 contains the icon, Col 2 contains the item title, Col 3 contains the item subtitle
*/
import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';
import { triggerCTAClickWithLinkAndTitle } from '../../scripts/analytics_1.js';

const URL_PATTERN = /^(https?:\/\/|\/)\S*$/;
const HEADINGS = 'h1, h2, h3, h4, h5, h6';

// Labels authors write in the first column of a settings row (label | value)
const SETTING_LABELS = {
  title: ['title', 'heading'],
  description: ['description', 'sub title', 'subtitle'],
  cta: ['cta', 'cta link'],
  ctaNewTab: ['open in new tab', 'cta open in new tab'],
};

const cellText = (cell) => cell?.textContent.trim() || '';

/**
 * Matches a cell's text against the settings labels.
 * @param {Element} [cell] The cell
 * @returns {string|undefined} The matching label key
 */
function labelOf(cell) {
  const text = cellText(cell).toLowerCase().replace(/[:*]/g, '').replace(/\s+/g, ' ');
  return Object.keys(SETTING_LABELS).find((key) => SETTING_LABELS[key].includes(text));
}

/**
 * Whether a row is the Image | Title | Subtitle header row.
 * @param {Element} row The authored row
 * @returns {boolean}
 */
function isHeaderRow(row) {
  return !row.querySelector('picture') && /^image$/i.test(cellText(row.children[0]));
}

/**
 * Builds an optimized icon; media hosted elsewhere is used as-is.
 * @param {HTMLImageElement} img The authored image
 * @returns {HTMLPictureElement} The picture
 */
function buildPicture(img) {
  let picture;
  if (new URL(img.src, window.location.href).origin === window.location.origin) {
    picture = createOptimizedPicture(img.src, '', false, [{ width: '120' }]);
  } else {
    picture = document.createElement('picture');
    const external = document.createElement('img');
    external.src = img.src;
    external.loading = 'lazy';
    picture.append(external);
  }
  const optimized = picture.querySelector('img');
  // the title next to the icon says what it means, so the icon is decorative
  optimized.alt = '';
  if (img.width) optimized.width = img.width;
  if (img.height) optimized.height = img.height;
  moveInstrumentation(img, optimized);
  return picture;
}

/**
 * Builds one feature item from an Image | Title | Subtitle row.
 * @param {Element} row The authored row
 * @returns {HTMLLIElement} The item
 */
function buildItem(row) {
  const [imageCell, titleCell, subtitleCell] = [...row.children];
  const li = document.createElement('li');
  li.className = 'why-choose-us-item';
  moveInstrumentation(row, li);

  const img = imageCell?.querySelector('img');
  if (img) {
    const icon = document.createElement('div');
    icon.className = 'why-choose-us-icon';
    icon.append(buildPicture(img));
    li.append(icon);
  }

  const body = document.createElement('div');
  body.className = 'why-choose-us-body';
  const title = cellText(titleCell);
  if (title) {
    const h3 = document.createElement('h3');
    h3.className = 'why-choose-us-item-title';
    h3.textContent = title;
    body.append(h3);
  }
  const subtitle = cellText(subtitleCell);
  if (subtitle) {
    const p = document.createElement('p');
    p.className = 'why-choose-us-item-text';
    p.textContent = subtitle;
    body.append(p);
  }
  li.append(body);
  return li;
}

/**
 * Builds the CTA from the CTA cell (a link, or a bare URL).
 * @param {Element} cell The CTA cell
 * @param {boolean} newTab Whether the link opens in a new tab
 * @param {string} sectionTitle The block title, for analytics
 * @returns {HTMLParagraphElement|null} The CTA wrapper
 */
function buildCta(cell, newTab, sectionTitle) {
  const authored = cell.querySelector('a[href]');
  const href = authored?.getAttribute('href') || cellText(cell);
  if (!URL_PATTERN.test(href)) return null;

  const link = document.createElement('a');
  link.className = 'why-choose-us-cta';
  link.href = href;
  link.textContent = authored?.textContent.trim() || href;
  if (newTab) {
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  }
  link.addEventListener('click', () => {
    triggerCTAClickWithLinkAndTitle(link.href, link.textContent.trim(), sectionTitle);
  });

  const wrapper = document.createElement('p');
  wrapper.className = 'why-choose-us-cta-wrapper';
  wrapper.append(link);
  return wrapper;
}

/**
 * Decorates the why-choose-us block.
 *
 *   Title | Why Choose Us?
 *   Description | text
 *   CTA | link (optional)
 *   Open in new tab | true/false
 *   Image | Title | Subtitle        (header row)
 *   <icon> | title | subtitle       (one row per item)
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const settings = {};
  const list = document.createElement('ul');
  list.className = 'why-choose-us-list';

  [...block.children].forEach((row) => {
    const cells = [...row.children];
    if (isHeaderRow(row)) return;
    const setting = !row.querySelector('picture') && cells.length >= 2 && labelOf(cells[0]);
    if (setting) {
      [, settings[setting]] = cells;
      return;
    }
    if (row.querySelector('img') || cells.length >= 2) list.append(buildItem(row));
  });

  const content = [];
  const titleText = cellText(settings.title);
  if (titleText) {
    const authored = settings.title.querySelector(HEADINGS);
    const heading = document.createElement(authored ? authored.tagName.toLowerCase() : 'h2');
    heading.className = 'why-choose-us-title';
    heading.textContent = titleText;
    content.push(heading);
  }

  const descriptionText = cellText(settings.description);
  if (descriptionText) {
    const description = document.createElement('p');
    description.className = 'why-choose-us-description';
    description.textContent = descriptionText;
    content.push(description);
  }

  content.push(list);

  if (settings.cta) {
    const newTab = /^(true|yes)$/i.test(cellText(settings.ctaNewTab));
    const cta = buildCta(settings.cta, newTab, titleText);
    if (cta) content.push(cta);
  }

  block.replaceChildren(...content);
}
