import { createOptimizedPicture } from '../../scripts/aem.js';
import removeLabelRows from '../../scripts/block-labels.js';

// author label rows in the DA table (see scripts/block-labels.js)
const LABELS = [
  'Section title',
  'Section description',
  'Room image',
  'Colours applied (Name, Code, #HEX, URL)',
  'Image description',
];

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

function optimize(picture, breakpoints) {
  const img = picture?.querySelector('img');
  if (!img) return null;
  // only media bus (same-origin) images support the optimization params
  if (new URL(img.src, window.location.href).origin !== window.location.origin) return picture;
  return createOptimizedPicture(img.src, img.alt, false, breakpoints);
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function buildHeader(cells) {
  const header = el('div', 'lookbookcarousel-header');
  cells.forEach((cell, i) => {
    const heading = cell.querySelector('h1, h2, h3, h4, h5, h6');
    if (heading) {
      heading.classList.add('lookbookcarousel-title');
      header.append(...cell.childNodes);
      return;
    }
    const node = el(i === 0 ? 'h2' : 'p', i === 0 ? 'lookbookcarousel-title' : 'lookbookcarousel-desc', cell.textContent.trim());
    header.append(node);
  });
  header.querySelectorAll(':scope > p:not([class])').forEach((p) => p.classList.add('lookbookcarousel-desc'));
  return header.children.length ? header : null;
}

const URL_TEXT = /^(https?:\/\/|\/)\S+$/i;

/**
 * Parses one "colour applied" list item:
 *   Name, Code, #HEX, URL        – URL is its own part (plain text or a link)
 * A swatch image can replace #HEX. The older form "[Name](URL), Code, #HEX"
 * (name linked to the shade page) is still supported.
 */
function parseColour(li) {
  const swatchImg = li.querySelector('img');
  let rest = li.textContent;
  let name = '';
  let url = '';

  [...li.querySelectorAll('a')].forEach((a) => {
    const text = a.textContent.trim();
    if (URL_TEXT.test(text)) {
      url = url || a.href;
      rest = rest.replace(a.textContent, '');
    } else if (text && !name) {
      // legacy: linked name
      name = text;
      url = url || a.href;
      rest = rest.replace(a.textContent, '');
    }
  });

  const parts = rest.split(/[,|]/).map((part) => part.trim()).filter(Boolean);
  const urlPart = parts.find((part) => URL_TEXT.test(part));
  if (urlPart && !url) url = new URL(urlPart, window.location.href).href;
  const colour = parts.find((part) => HEX.test(part));
  const others = parts.filter((part) => part !== colour && part !== urlPart);
  if (!name) name = others.shift() || '';
  const code = others.join(' ');
  return {
    name, code, colour, url, swatch: swatchImg?.src,
  };
}

function buildColour({
  name, code, colour, url, swatch,
}) {
  const item = el('li', 'lookbookcarousel-colour');
  const wrap = el(url ? 'a' : 'div', 'lookbookcarousel-colour-link');
  if (url) wrap.href = url;

  const chip = el('span', 'lookbookcarousel-chip');
  chip.setAttribute('aria-hidden', 'true');
  if (colour) chip.style.backgroundColor = colour;
  else if (swatch) chip.style.backgroundImage = `url("${swatch}")`;
  wrap.append(chip);

  if (name) wrap.append(el('span', 'lookbookcarousel-colour-name', name));
  if (code) wrap.append(el('span', 'lookbookcarousel-colour-code', code));
  item.append(wrap);
  return item;
}

function buildSlide(row) {
  const cells = [...row.children];
  const imageCell = cells.find((cell) => cell.querySelector('picture') && !cell.querySelector('li'));
  const coloursCell = cells.find((cell) => cell.querySelector('ul, ol'));
  const descCell = cells.find((cell) => ![imageCell, coloursCell].includes(cell)
    && cell.textContent.trim());

  const slide = el('li', 'lookbookcarousel-slide');

  const picture = optimize(imageCell?.querySelector('picture'), [{ width: '1100' }]);
  if (picture) {
    const media = el('div', 'lookbookcarousel-media');
    media.append(picture);
    slide.append(media);
  }

  const desc = descCell?.textContent.trim();
  if (desc) slide.append(el('p', 'lookbookcarousel-slide-desc', desc));

  const items = [...(coloursCell?.querySelectorAll('li') || [])]
    .map(parseColour)
    .filter((c) => c.name || c.code || c.colour || c.swatch);
  if (items.length) {
    const colours = el('ul', 'lookbookcarousel-colours');
    colours.setAttribute('aria-label', 'Colours applied');
    items.forEach((c) => colours.append(buildColour(c)));
    slide.append(colours);
  }

  return slide;
}

// copies stay clickable (shade links work on partly visible slides) but are
// hidden from assistive tech and skipped in the tab order
function makeClone(slide) {
  const clone = slide.cloneNode(true);
  clone.classList.add('is-clone');
  clone.setAttribute('aria-hidden', 'true');
  clone.querySelectorAll('a, button').forEach((node) => node.setAttribute('tabindex', '-1'));
  return clone;
}

/**
 * Infinite loop (like the original slick carousel): copies of the slide set
 * sit on both sides of the real slides; whenever scrolling settles outside
 * the real set, the position jumps by one set width to the same slide.
 */
function setupLoop(block, track, slides) {
  let pitch = 0;
  let setWidth = 0;
  let realStart = 0;

  const jumpTo = (left) => track.scrollTo({ left, behavior: 'instant' });

  const normalize = () => {
    if (!setWidth) return;
    let left = track.scrollLeft;
    while (left < realStart - pitch / 2) left += setWidth;
    while (left >= realStart + setWidth - pitch / 2) left -= setWidth;
    if (Math.abs(left - track.scrollLeft) > 1) jumpTo(left);
  };

  const build = () => {
    // current slide index within the real set, kept across rebuilds
    const index = pitch ? Math.round((track.scrollLeft - realStart) / pitch) : 0;
    track.querySelectorAll(':scope > .is-clone').forEach((clone) => clone.remove());
    setWidth = 0;

    const [first, second] = slides;
    if (!first || !track.clientWidth) return;
    pitch = second ? second.offsetLeft - first.offsetLeft : first.offsetWidth;
    const width = pitch * slides.length;
    const loops = slides.length > 1 && width - (pitch - first.offsetWidth) > track.clientWidth;
    block.classList.toggle('is-scrollable', loops);
    if (!loops) return;

    // enough copies on each side to fill the viewport plus one step
    const copies = Math.ceil((track.clientWidth + pitch) / width);
    for (let i = 0; i < copies; i += 1) {
      track.prepend(...[...slides].map(makeClone));
      track.append(...slides.map(makeClone));
    }
    setWidth = width;
    realStart = first.offsetLeft - track.firstElementChild.offsetLeft;
    const n = slides.length;
    jumpTo(realStart + (((index % n) + n) % n) * pitch);
  };

  let timer;
  track.addEventListener('scroll', () => {
    clearTimeout(timer);
    timer = setTimeout(normalize, 150);
  }, { passive: true });
  track.addEventListener('scrollend', normalize);

  let lastWidth = 0;
  new ResizeObserver(() => {
    if (track.clientWidth === lastWidth) return;
    lastWidth = track.clientWidth;
    build();
  }).observe(track);

  return {
    move: (dir) => {
      normalize();
      track.scrollBy({ left: dir * pitch, behavior: 'smooth' });
    },
  };
}

function setupNav(block, track, slides) {
  const nav = el('div', 'lookbookcarousel-nav');
  const prev = el('button', 'lookbookcarousel-prev');
  const next = el('button', 'lookbookcarousel-next');
  prev.type = 'button';
  next.type = 'button';
  prev.setAttribute('aria-label', 'Previous slide');
  next.setAttribute('aria-label', 'Next slide');
  nav.append(prev, next);

  const loop = setupLoop(block, track, slides);
  prev.addEventListener('click', () => loop.move(-1));
  next.addEventListener('click', () => loop.move(1));
  return nav;
}

/**
 * lookbookcarousel – migrated from the AEM "lookbookcarousel" component
 * ("get inspired" variant): heading, description and a carousel of room
 * images, each with the colours applied (swatch, name, shade code, link).
 * Desktop (>= 992px): 521px slides, prev/next arrows at the top right.
 * Mobile/tablet (< 992px): 300px slides, swipe to scroll, no arrows.
 * Loops endlessly in both directions when the slides overflow.
 *
 * Authoring (DA table):
 * Label rows (the LABELS above, e.g. "Section title") may sit above any row
 * to guide authors; they are removed before rendering.
 *
 * | lookbookcarousel |                     |                         |
 * | ---------------- | ------------------- | ----------------------- |
 * | Title            | Description         |                         |
 * | Image            | Colours applied     | Image description       |
 * | ...one row per slide...                                          |
 *
 * - Row 1: block name only ("lookbookcarousel").
 * - Row 2 – Header (optional, no image):
 *   - Column 1 – Title, rendered as an h2, e.g. "Inspiring ideas for your
 *     home". AEM dialog: title
 *   - Column 2 – Description (optional), e.g. "Find decor inspiration...".
 *     AEM dialog: subTitle
 * - Rows 3+ – Slides (one row per slide). AEM: carouselList entries.
 *   - Column 1 – Image (required): the room image, landscape (about 3:2).
 *     Its alt text is used for accessibility. AEM: lookbookImageModel
 *   - Column 2 – Colours applied (optional): a bulleted list, one colour
 *     per bullet, four parts separated by commas:
 *       Name, Code, #HEX, URL
 *     e.g. "Valley Flower, 8530, #E3CCAE,
 *           https://www.asianpaints.com/colour-catalogue/brown-wall-colours/valley-flower.html"
 *     - Name: shade name (AEM: productName)
 *     - Code: shade code (AEM: productCode)
 *     - #HEX: swatch colour (AEM: bgColour). For textures/products, put a
 *       small swatch image in the bullet instead (AEM: swatchImagePath).
 *     - URL: page the swatch opens when clicked (AEM: productUrl). Plain
 *       text or a link; leave it out for a non-clickable swatch.
 *   - Column 3 – Image description (optional): short text shown above the
 *     colours. AEM: imageDescription
 * - Add or remove slide rows to change the number of slides.
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

  const track = el('ul', 'lookbookcarousel-track');
  track.setAttribute('aria-label', header?.querySelector('.lookbookcarousel-title')?.textContent.trim() || 'Inspiration');
  const slides = rows.map(buildSlide);
  track.append(...slides);

  const viewport = el('div', 'lookbookcarousel-viewport');
  viewport.append(track);

  block.replaceChildren(...(header ? [header] : []), viewport);
  viewport.append(setupNav(block, track, slides));
}
