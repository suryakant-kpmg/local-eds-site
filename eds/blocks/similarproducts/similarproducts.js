import { createOptimizedPicture } from '../../scripts/aem.js';
import removeLabelRows from '../../scripts/block-labels.js';

// author label rows in the DA table (see scripts/block-labels.js)
const LABELS = [
  'Section title',
  'View all link',
  'Product image',
  'Product name',
  'Subtitle',
  'Description',
  'Key features',
  'Product link',
];

const DEFAULT_FEATURES_LABEL = 'Key features';
const DEFAULT_CTA_LABEL = 'View product';

function optimize(picture) {
  const img = picture?.querySelector('img');
  if (!img) return null;
  // only media bus (same-origin) images support the optimization params
  if (new URL(img.src, window.location.href).origin !== window.location.origin) return picture;
  return createOptimizedPicture(img.src, img.alt, false, [{ width: '460' }]);
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
  const header = el('div', 'similarproducts-header');
  cells.forEach((cell) => {
    if (isLinkCell(cell)) {
      const link = cell.querySelector('a');
      link.className = 'similarproducts-viewall';
      header.append(link);
      return;
    }
    const heading = cell.querySelector('h1, h2, h3, h4, h5, h6')
      || el('h2', '', cell.textContent.trim());
    heading.classList.add('similarproducts-title');
    header.prepend(heading);
  });
  return header.children.length ? header : null;
}

function buildCard(row) {
  const cells = [...row.children];
  const imageCell = cells.find((cell) => cell.querySelector('picture'));
  const featuresCell = cells.find((cell) => cell.querySelector('ul, ol'));
  const linkCell = cells.find((cell) => cell !== imageCell && isLinkCell(cell));
  const [nameCell, subtitleCell, descCell] = cells
    .filter((cell) => ![imageCell, featuresCell, linkCell].includes(cell));

  const name = nameCell?.textContent.trim() || '';
  const card = el('li', 'similarproducts-card');

  const fav = el('button', 'similarproducts-fav');
  fav.type = 'button';
  fav.setAttribute('aria-pressed', 'false');
  fav.setAttribute('aria-label', `Add ${name} to favourites`);
  fav.addEventListener('click', () => {
    const pressed = fav.getAttribute('aria-pressed') !== 'true';
    fav.setAttribute('aria-pressed', pressed);
    // hook for wishlist integrations
    card.dispatchEvent(new CustomEvent('similarproducts:favourite', {
      bubbles: true,
      detail: { name, favourite: pressed, url: linkCell?.querySelector('a')?.href },
    }));
  });

  // static face: image + name (desktop, before hover)
  const face = el('div', 'similarproducts-face');
  const picture = optimize(imageCell?.querySelector('picture'));
  if (picture) {
    const media = el('div', 'similarproducts-media');
    media.append(picture);
    face.append(media);
  }
  const faceName = el('p', 'similarproducts-face-name', name);
  faceName.setAttribute('aria-hidden', 'true');
  face.append(faceName);

  // details: revealed on hover/focus on desktop, always visible on mobile
  const details = el('div', 'similarproducts-details');
  details.append(el('h3', 'similarproducts-name', name));
  const subtitle = subtitleCell?.textContent.trim();
  if (subtitle) details.append(el('p', 'similarproducts-subtitle', subtitle));
  const desc = descCell?.textContent.trim();
  if (desc) details.append(el('p', 'similarproducts-desc', desc));

  const list = featuresCell?.querySelector('ul, ol');
  if (list) {
    const features = el('div', 'similarproducts-features');
    const label = [...featuresCell.children]
      .find((child) => child !== list && child.textContent.trim())?.textContent.trim();
    features.append(el('p', 'similarproducts-features-label', label || DEFAULT_FEATURES_LABEL));
    const ul = el('ul');
    [...list.children].forEach((li) => ul.append(el('li', '', li.textContent.trim())));
    features.append(ul);
    details.append(features);
  }

  const link = linkCell?.querySelector('a');
  if (link) {
    const cta = el('a', 'similarproducts-cta');
    cta.href = link.href;
    const text = link.textContent.trim();
    cta.textContent = !text || text === link.href ? DEFAULT_CTA_LABEL : text;
    cta.setAttribute('aria-label', `${cta.textContent} – ${name}`);
    details.append(cta);
  }

  card.append(fav, face, details);
  return card;
}

function setupNav(block, track) {
  const nav = el('div', 'similarproducts-nav');
  const prev = el('button', 'similarproducts-prev');
  const next = el('button', 'similarproducts-next');
  prev.type = 'button';
  next.type = 'button';
  prev.setAttribute('aria-label', 'Previous products');
  next.setAttribute('aria-label', 'Next products');
  nav.append(prev, next);

  const step = () => track.querySelector('.similarproducts-card')?.getBoundingClientRect().width || 0;
  prev.addEventListener('click', () => track.scrollBy({ left: -step(), behavior: 'smooth' }));
  next.addEventListener('click', () => track.scrollBy({ left: step(), behavior: 'smooth' }));

  const update = () => {
    const max = track.scrollWidth - track.clientWidth;
    block.classList.toggle('is-scrollable', max > 1);
    prev.disabled = track.scrollLeft <= 1;
    next.disabled = track.scrollLeft >= max - 1;
  };
  track.addEventListener('scroll', update, { passive: true });
  new ResizeObserver(update).observe(track);
  return nav;
}

/**
 * similarproducts – migrated from the AEM "similarproduct" component.
 * Desktop (>= 992px): cards show image + name; details slide up on hover/focus.
 * Mobile/tablet (< 992px): details always visible (image beside key features).
 * Cards scroll horizontally (3 per view desktop, 2 tablet, 1 + peek mobile).
 *
 * Authoring (DA table):
 * Label rows (the LABELS above, e.g. "Section title") may sit above any row
 * to guide authors; they are removed before rendering.
 *
 * | similarproducts |              |              |              |               |              |
 * | --------------- | ------------ | ------------ | ------------ | ------------- | ------------ |
 * | Section title   | View all link|              |              |               |              |
 * | Product image   | Product name | Subtitle     | Description  | Key features  | Product link |
 * | ...one row per product...                                                                   |
 *
 * - Row 1: block name only ("similarproducts").
 * - Row 2 – Header (optional, no image):
 *   - Column 1 – Section title, rendered as an h2 (e.g. "Similar products").
 *     AEM dialog: ./similarTitle
 *   - Column 2 – "View all" link; the link text is the label (e.g. "VIEW ALL").
 *     AEM dialog: ./ctaTitle (label) + ./ctaredirection (URL)
 * - Rows 3+ – Products (one row per card). In AEM these came from ./skuCode.
 *   - Column 1 – Product image (required): packshot, ideally 230 x 273.
 *     Its alt text is used for accessibility.
 *   - Column 2 – Product name (required), e.g. "Royale Shyne Luxury Emulsion".
 *   - Column 3 – Subtitle (optional): short tagline, shown on mobile only,
 *     e.g. "HIGH-SHEEN WITH SUPERIOR STAIN RESISTANCE".
 *   - Column 4 – Description (optional): short product description.
 *   - Column 5 – Key features (optional): a bulleted list. An optional line of
 *     text above the list sets its label; defaults to "Key features".
 *     AEM dialog: ./featureTagTitle (label)
 *   - Column 6 – Product link (required): link to the product page; the link
 *     text is the button label, e.g. "VIEW PRODUCT" (defaults to "View product").
 *     AEM dialog: ./prodctatitle (label)
 * - Add or remove product rows to change the number of cards.
 *
 * Put the block in a section with Section Metadata "Style | light" for the
 * grey background used on the original page.
 *
 * The heart button toggles aria-pressed and fires a bubbling
 * "similarproducts:favourite" event ({ name, favourite, url }) for wishlist
 * integrations.
 *
 * @param {Element} block
 */
export default function decorate(block) {
  removeLabelRows(block, LABELS);
  const rows = [...block.children].filter((row) => row.textContent.trim() || row.querySelector('picture'));

  let header;
  if (rows[0] && !rows[0].querySelector('picture')) {
    header = buildHeader([...rows.shift().children].filter((cell) => cell.textContent.trim()));
  }

  const track = el('ul', 'similarproducts-track');
  track.setAttribute('aria-label', header?.querySelector('.similarproducts-title')?.textContent || 'Products');
  rows.forEach((row) => track.append(buildCard(row)));

  const viewport = el('div', 'similarproducts-viewport');
  viewport.append(track);

  block.replaceChildren(...(header ? [header] : []), viewport);
  viewport.append(setupNav(block, track));
}
