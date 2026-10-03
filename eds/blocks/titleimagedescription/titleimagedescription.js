import { createOptimizedPicture } from '../../scripts/aem.js';
import removeLabelRows from '../../scripts/block-labels.js';

// author label rows in the DA table (see scripts/block-labels.js)
const LABELS = [
  'Section title',
  'Card image',
  'Card title',
  'Description',
  'CTA link',
];

function optimize(picture) {
  const img = picture?.querySelector('img');
  if (!img) return null;
  // only media bus (same-origin) images support the optimization params
  if (new URL(img.src, window.location.href).origin !== window.location.origin) return picture;
  return createOptimizedPicture(img.src, img.alt, false, [
    { media: '(width >= 992px)', width: '1300' },
    { width: '750' },
  ]);
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

const isLinkCell = (cell) => {
  const a = cell.querySelector('a');
  return a && a.textContent.trim() === cell.textContent.trim();
};

function buildHeader(cells) {
  const cell = cells.find((c) => c.textContent.trim());
  if (!cell) return null;
  const heading = cell.querySelector('h1, h2, h3, h4, h5, h6')
    || el('h2', '', cell.textContent.trim());
  heading.classList.add('titleimagedescription-title');
  return heading;
}

function buildCard(row) {
  const cells = [...row.children];
  const imageCell = cells.find((cell) => cell.querySelector('picture'));
  const linkCell = cells.find((cell) => cell !== imageCell && isLinkCell(cell));
  const [titleCell, descCell] = cells
    .filter((cell) => ![imageCell, linkCell].includes(cell));

  const card = el('li', 'titleimagedescription-card');

  const picture = optimize(imageCell?.querySelector('picture'));
  if (picture) {
    const media = el('div', 'titleimagedescription-media');
    media.append(picture);
    card.append(media);
  }

  const title = titleCell?.textContent.trim();
  if (title) card.append(el('h3', 'titleimagedescription-name', title));

  // keep authored paragraphs (and inline formatting) in the description
  if (descCell?.textContent.trim()) {
    const desc = el('div', 'titleimagedescription-desc');
    const paras = [...descCell.querySelectorAll('p')];
    if (paras.length) desc.append(...paras);
    else desc.append(el('p', '', descCell.textContent.trim()));
    card.append(desc);
  }

  const link = linkCell?.querySelector('a');
  if (link) {
    link.className = 'titleimagedescription-cta';
    card.append(link);
  }

  return card;
}

/**
 * titleimagedescription – migrated from the AEM "You may also like"
 * (trendingArticlesSec) section: a heading and image cards with a title,
 * description and link.
 * Desktop (>= 992px): cards side by side (2 per row).
 * Mobile/tablet (< 992px): cards stacked one below the other.
 *
 * Authoring (DA table):
 * Label rows (the LABELS above, e.g. "Section title") may sit above any row
 * to guide authors; they are removed before rendering.
 *
 * | titleimagedescription |             |             |           |
 * | --------------------- | ----------- | ----------- | --------- |
 * | Section title         |             |             |           |
 * | Image                 | Card title  | Description | Link      |
 * | ...one row per card...                                        |
 *
 * - Row 1: block name only ("titleimagedescription").
 * - Row 2 – Header (optional, no image): section title, rendered as an h2
 *   (e.g. "You may also like"). AEM: Text (RTE) component above the cards.
 * - Rows 3+ – Cards (one row per card). AEM: one "trendingItem" per card.
 *   - Column 1 – Image (required): card image, landscape (about 2:1).
 *     Its alt text is used for accessibility. AEM: Image component.
 *   - Column 2 – Card title (required), rendered as an h3,
 *     e.g. "Interior Texture Catalogue". AEM: RTE heading.
 *   - Column 3 – Description (optional): one or more paragraphs; bold,
 *     italic and links are kept. AEM: RTE paragraph.
 *   - Column 4 – Link (optional): a link whose text is the call to action,
 *     e.g. "VIEW ALL TEXTURES". AEM: CTA component (text + URL).
 * - Add or remove card rows to change the number of cards; rows wrap two
 *   per line on desktop.
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

  const list = el('ul', 'titleimagedescription-list');
  rows.forEach((row) => list.append(buildCard(row)));

  block.replaceChildren(...(header ? [header] : []), list);
}
