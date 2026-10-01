import { createOptimizedPicture, toClassName } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';
import loadProductFeed, { productKey } from './product-feed.js';

/**
 * Product cards for listing pages (Nilaya range on the source).
 * Cards convention: one row per card, | image | text |. The text cell holds, in order:
 *   optional badge paragraph (e.g. *Most Popular*), the product name as a heading with a link,
 *   a features list, then the price paragraphs (MRP, tax note). The whole card links to the
 *   product page through the name's link.
 * A row with an image and no text is a promo banner that spans two card columns.
 *
 * Range: like the source's `listing-products-cards Royale`, each block names its range. Authors
 * set it as the block option, "Cards Nilaya (Royale)", which EDS renders as the class `royale`;
 * without an option the range is the brand of the authored products. The block marks itself with
 * the class and `data-range` (the exact brand name from the feed, e.g. "Royale") on every load.
 *
 * Live data: when the page has a product feed (./product-feed.js), the block renders its
 * whole range from it, like the source's server-side listing, in the source order, with live
 * prices, badges and features; new products appear and removed ones go. Authored images are
 * reused for matching products, banners keep their authored position, and the authored tiles
 * stay when there is no feed.
 */

const HEADING = 'h1, h2, h3, h4, h5, h6';

// wraps each "*" footnote mark so it can be coloured like the source
function markFootnotes(element) {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) if (walker.currentNode.nodeValue.includes('*')) nodes.push(walker.currentNode);
  nodes.forEach((node) => {
    const parts = node.nodeValue.split('*');
    const fragment = document.createDocumentFragment();
    parts.forEach((part, i) => {
      if (i) {
        const mark = document.createElement('span');
        mark.className = 'cards-nilaya-mark';
        mark.textContent = '*';
        fragment.append(mark);
      }
      if (part) fragment.append(part);
    });
    node.replaceWith(fragment);
  });
}

function buildTitle(source, link) {
  const title = document.createElement('h3');
  title.className = 'cards-nilaya-title';
  if (source) moveInstrumentation(source, title);
  const sourceLink = source?.querySelector('a[href]') || link;
  const label = (source || sourceLink)?.textContent.trim() || '';
  if (sourceLink) {
    const a = document.createElement('a');
    a.href = sourceLink.href;
    a.textContent = label || sourceLink.textContent.trim();
    moveInstrumentation(sourceLink, a);
    title.append(a);
  } else {
    title.textContent = label;
  }
  return title;
}

function buildCard(row) {
  const cells = [...row.children];
  const imageCell = cells.find((cell) => cell.querySelector('picture, img'));
  const nodes = cells.filter((cell) => cell !== imageCell).flatMap((cell) => [...cell.children]);
  if (!imageCell && !nodes.length) return null;

  const img = imageCell?.querySelector('img');
  if (img && !nodes.some((node) => node.textContent.trim())) {
    const banner = document.createElement('li');
    banner.className = 'cards-nilaya-banner';
    moveInstrumentation(row, banner);
    const picture = createOptimizedPicture(img.src, img.alt || '', false, [{ width: '750' }]);
    const optimized = picture.querySelector('img');
    // keep the creative's own size so the browser reserves its space (creatives differ in shape)
    ['width', 'height'].forEach((attr) => {
      if (img.getAttribute(attr)) optimized.setAttribute(attr, img.getAttribute(attr));
    });
    moveInstrumentation(img, optimized);
    banner.append(picture);
    return banner;
  }

  const card = document.createElement('li');
  card.className = 'cards-nilaya-card';
  moveInstrumentation(row, card);

  // the name is the first heading; without one, the first paragraph with a link
  let titleIndex = nodes.findIndex((node) => node.matches(HEADING));
  if (titleIndex < 0) titleIndex = nodes.findIndex((node) => node.matches('p') && node.querySelector('a[href]'));
  const titleNode = nodes[titleIndex];
  const before = titleIndex < 0 ? [] : nodes.slice(0, titleIndex);
  const after = titleIndex < 0 ? nodes : nodes.slice(titleIndex + 1);

  const badgeText = before.map((node) => node.textContent.trim()).filter(Boolean).join(' ');
  if (badgeText) {
    const badge = document.createElement('p');
    badge.className = 'cards-nilaya-badge';
    badge.textContent = badgeText;
    moveInstrumentation(before[0], badge);
    card.append(badge);
  }

  if (img) {
    const image = document.createElement('div');
    image.className = 'cards-nilaya-image';
    const picture = createOptimizedPicture(img.src, img.alt || '', false, [{ width: '240' }]);
    moveInstrumentation(img, picture.querySelector('img'));
    image.append(picture);
    card.append(image);
  }

  const fallbackLink = after.map((node) => node.querySelector('a[href]')).find(Boolean);
  if (titleNode || fallbackLink) {
    card.append(buildTitle(titleNode, titleNode ? null : fallbackLink));
  }

  const price = document.createElement('div');
  price.className = 'cards-nilaya-price';
  after.forEach((node) => {
    if (node.matches('ul, ol')) {
      node.classList.add('cards-nilaya-features');
      card.append(node);
    } else if (node.textContent.trim()) {
      node.classList.remove('button-container');
      node.querySelectorAll('.button').forEach((a) => a.classList.remove('button'));
      markFootnotes(node);
      price.append(node);
    }
  });
  if (price.children.length) card.append(price);
  return card;
}

const TAX_NOTE = '(Inclusive of all taxes) per L*';

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

// a card from the feed, in the same markup as an authored card
function feedCard(product, authored) {
  const card = el('li', 'cards-nilaya-card');
  card.dataset.productCode = product.code;
  if (product.badge) card.append(el('p', 'cards-nilaya-badge', product.badge));

  let image = authored?.querySelector('.cards-nilaya-image');
  if (!image && product.image) {
    image = el('div', 'cards-nilaya-image');
    const picture = document.createElement('picture');
    const img = document.createElement('img');
    img.src = product.image;
    img.alt = product.name;
    img.loading = 'lazy';
    img.width = 221;
    img.height = 264;
    picture.append(img);
    image.append(picture);
  }
  if (image) card.append(image);

  const title = el('h3', 'cards-nilaya-title');
  const link = el('a', '', product.name);
  link.href = product.url;
  title.append(link);
  card.append(title);

  if (product.features.length) {
    const features = el('ul', 'cards-nilaya-features');
    product.features.forEach((feature) => features.append(el('li', '', feature)));
    card.append(features);
  }

  if (product.price) {
    const price = el('div', 'cards-nilaya-price');
    const mrp = el('p', '', 'MRP ₹ ');
    mrp.append(el('strong', '', product.price));
    const tax = el('p', '', authored?.querySelector('.cards-nilaya-price p + p')?.textContent.trim() || TAX_NOTE);
    markFootnotes(tax);
    price.append(mrp, tax);
    card.append(price);
  }
  return card;
}

// the block option from the document, e.g. "Cards Nilaya (Royale)" -> class "royale"
const rangeOption = (block) => [...block.classList]
  .find((name) => name !== 'block' && !name.startsWith('cards-nilaya'));

// names the block's range like the source: class `royale` and data-range="Royale"
function markRange(block, range) {
  if (!range) return;
  block.classList.add(toClassName(range));
  block.dataset.range = range;
}

async function hydrate(block, list) {
  const products = await loadProductFeed();
  if (!products) return;
  const keyOf = (card) => productKey(card.querySelector('.cards-nilaya-title a')?.href || '');
  const cards = [...list.querySelectorAll('.cards-nilaya-card')];

  // the range: the block option, else the brand most of its authored products belong to
  const option = rangeOption(block);
  let brand = option && products.find((product) => toClassName(product.brand) === option)?.brand;
  if (!brand) {
    const feedByKey = new Map(products.map((product) => [productKey(product.url), product]));
    const counts = {};
    cards.map((card) => feedByKey.get(keyOf(card))).filter(Boolean)
      .forEach((product) => { counts[product.brand] = (counts[product.brand] || 0) + 1; });
    [brand] = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  }
  if (!brand) return;
  markRange(block, brand);
  const range = products.filter((product) => product.brand === brand)
    .sort((a, b) => a.popularity - b.popularity);
  const authored = new Map(cards.map((card) => [keyOf(card), card]));

  const banners = [...list.children]
    .map((item, index) => [item, index])
    .filter(([item]) => item.classList.contains('cards-nilaya-banner'));
  list.replaceChildren(...range.map((product) => (
    feedCard(product, authored.get(productKey(product.url)))
  )));
  banners.forEach(([banner, index]) => list.insertBefore(banner, list.children[index] || null));
}

export default async function decorate(block) {
  const list = document.createElement('ul');
  list.className = 'cards-nilaya-list';
  [...block.children].forEach((row) => {
    const card = buildCard(row);
    if (card) list.append(card);
  });
  block.replaceChildren(list);
  // without a feed the range is still named from the block option
  const option = rangeOption(block);
  if (option) block.dataset.range = option;
  // awaited (with a short timeout in the loader) so the section shows the final cards: no shift
  await hydrate(block, list);
}
