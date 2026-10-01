import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';
import loadProductFeed, { productKey } from './product-feed.js';

/**
 * Popular product tiles (Cards convention: one row per product, | image | text |).
 * Live data: with a product feed (./product-feed.js) the tiles follow the source's curated
 * popular list; the authored tiles stay when there is no feed.
 * Each tile is one link to the product: pack shot on the left, name on the right. The row
 * scrolls sideways on mobile and fits in one row on desktop.
 */
function buildTile(row) {
  const cells = [...row.children];
  const imageCell = cells.find((cell) => cell.querySelector('picture, img'));
  const textCell = cells.find((cell) => cell !== imageCell && cell.textContent.trim());
  const link = textCell?.querySelector('a[href]') || imageCell?.querySelector('a[href]');
  const name = (textCell?.querySelector('h1, h2, h3, h4, h5, h6') || textCell || link)
    ?.textContent.trim();
  if (!name) return null;

  const tile = document.createElement('li');
  tile.className = 'cards-popular-tile';
  moveInstrumentation(row, tile);

  // one link per tile, so the whole tile is the target and is read once by screen readers
  const target = document.createElement(link ? 'a' : 'div');
  target.className = 'cards-popular-link';
  if (link) {
    target.href = link.href;
    moveInstrumentation(link, target);
  }

  const img = imageCell?.querySelector('img');
  if (img) {
    // the name is the tile's text, so the pack shot is decorative here
    const picture = createOptimizedPicture(img.src, '', false, [{ width: '160' }]);
    picture.classList.add('cards-popular-image');
    moveInstrumentation(img, picture.querySelector('img'));
    target.append(picture);
  }
  const label = document.createElement('span');
  label.className = 'cards-popular-name';
  label.textContent = name;
  target.append(label);

  tile.append(target);
  return tile;
}

// a tile from the feed, in the same markup as an authored tile
function feedTile(product) {
  const tile = document.createElement('li');
  tile.className = 'cards-popular-tile';
  tile.dataset.productCode = product.code;
  const link = document.createElement('a');
  link.className = 'cards-popular-link';
  link.href = product.url;
  if (product.image) {
    const picture = document.createElement('picture');
    picture.className = 'cards-popular-image';
    const img = document.createElement('img');
    img.src = product.image;
    img.alt = '';
    img.loading = 'lazy';
    img.width = 80;
    img.height = 90;
    picture.append(img);
    link.append(picture);
  }
  const name = document.createElement('span');
  name.className = 'cards-popular-name';
  name.textContent = product.name;
  link.append(name);
  tile.append(link);
  return tile;
}

// live data: follow the source's curated popular list (its order and products) from the feed
async function hydrate(list) {
  const products = await loadProductFeed();
  const popular = (products || []).filter((product) => product.popular)
    .sort((a, b) => a.popular - b.popular);
  if (!popular.length) return;
  const authored = new Map([...list.children].map((tile) => [
    productKey(tile.querySelector('a[href]')?.href || ''), tile,
  ]));
  list.replaceChildren(...popular.map((product) => {
    const tile = authored.get(productKey(product.url));
    if (!tile) return feedTile(product);
    // keep the authored tile (and its optimised image), with the live name
    const name = tile.querySelector('.cards-popular-name');
    if (name) name.textContent = product.name;
    tile.dataset.productCode = product.code;
    return tile;
  }));
}

export default async function decorate(block) {
  const list = document.createElement('ul');
  list.className = 'cards-popular-list';
  [...block.children].forEach((row) => {
    const tile = buildTile(row);
    if (tile) list.append(tile);
  });
  block.replaceChildren(list);
  // awaited (with a short timeout in the loader) so the section shows the final tiles: no shift
  await hydrate(list);
}
