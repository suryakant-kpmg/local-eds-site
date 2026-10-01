/*
 * Expert Tips
 * A titled row of article cards. The cards sit beside the title on desktop, and
 * scroll horizontally with scroll-snap when they don't fit. Dot (mobile) or
 * prev/next (desktop) controls appear only when the cards overflow.
 *
 * Authoring:
 *   optional first row, one cell: heading (+ optional description) -> block title
 *   each further row, one column per field:
 *     | desktop image | mobile image | eyebrow text, heading, description, link |
 *   The desktop image is used from 992px (the block's desktop layout), the mobile image below;
 *   either one alone is used everywhere.
 * Older content with two columns (| image | text |) is still read, by content type.
 */
import { createOptimizedPicture } from '../../scripts/aem.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const ICONS = {
  prev: 'M15 5l-7 7 7 7',
  next: 'M9 5l7 7-7 7',
  external: 'M7 17L17 7M9 7h8v8',
};
const HEADINGS = 'h1, h2, h3, h4, h5, h6';
const DESKTOP_MEDIA = '(min-width: 992px)';

let instances = 0;

function createIcon(name) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', ICONS[name]);
  svg.append(path);
  return svg;
}

function createButton(className, label, icon) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.setAttribute('aria-label', label);
  if (icon) button.append(createIcon(icon));
  return button;
}

/** Wraps bare text in a cell into a paragraph so it can be styled consistently. */
function cellChildren(cell) {
  if (!cell.children.length && cell.textContent.trim()) {
    const p = document.createElement('p');
    p.textContent = cell.textContent.trim();
    cell.replaceChildren(p);
  }
  return [...cell.children];
}

/** The card image: desktop from 992px, mobile below (the same image when only one is set). */
function buildPicture(desktop, mobile) {
  const alt = desktop.alt || mobile?.alt || '';
  if (!mobile || mobile.src === desktop.src) {
    return createOptimizedPicture(desktop.src, alt, false, [
      { media: '(min-width: 600px)', width: '750' },
      { width: '450' },
    ]);
  }
  const picture = createOptimizedPicture(mobile.src, alt, false, [{ width: '450' }]);
  const wide = createOptimizedPicture(desktop.src, '', false, [
    { media: DESKTOP_MEDIA, width: '750' },
    { width: '450' },
  ]);
  picture.prepend(...wide.querySelectorAll(`source[media="${DESKTOP_MEDIA}"]`));
  return picture;
}

/** Splits a card row into its images and text cells (column layout or the older 2-column one). */
function readRow(row) {
  const cells = [...row.children];
  if (cells.length >= 3) {
    const [desktopCell, mobileCell, ...textCells] = cells;
    const desktop = desktopCell.querySelector('img');
    const mobile = mobileCell.querySelector('img');
    return { desktop: desktop || mobile, mobile: desktop ? mobile : null, textCells };
  }
  return { desktop: row.querySelector('picture img'), mobile: null, textCells: cells };
}

function buildCard(row, id) {
  const li = document.createElement('li');
  li.className = 'expert-tips-card';
  moveInstrumentation(row, li);

  const body = document.createElement('div');
  body.className = 'expert-tips-card-body';

  const { desktop: img, mobile, textCells } = readRow(row);
  textCells.forEach((cell) => {
    cellChildren(cell).forEach((el) => {
      if (el.matches('picture') || el.querySelector('picture')) return;
      if (el.textContent.trim()) body.append(el);
    });
  });

  const title = body.querySelector(HEADINGS) || body.querySelector('p:not(:has(a))');
  if (title) {
    title.classList.add('expert-tips-card-title');
    title.id = id;
    // anything authored above the title is the small label (e.g. category or date)
    [...body.children]
      .slice(0, [...body.children].indexOf(title))
      .forEach((el) => el.classList.add('expert-tips-card-eyebrow'));
  }

  const cta = [...body.querySelectorAll('a[href]')].pop();
  if (cta) {
    cta.closest('.expert-tips-card-body > *')?.classList.add('expert-tips-card-cta');
    cta.append(createIcon('external'));
    // "Read article" is ambiguous out of context; tie it to the card title
    if (title) cta.setAttribute('aria-describedby', id);
  }

  li.append(body);

  if (img) {
    const media = document.createElement('div');
    media.className = 'expert-tips-card-image';
    const picture = buildPicture(img, mobile);
    moveInstrumentation(img, picture.querySelector('img'));
    media.append(picture);
    li.append(media);
  }

  return li;
}

function setupControls(list, controls) {
  const cards = [...list.children];
  const smooth = () => (window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');
  const step = () => (cards[1] ? cards[1].offsetLeft - cards[0].offsetLeft : list.clientWidth);
  const maxScroll = () => list.scrollWidth - list.clientWidth;
  // index being scrolled to; lets repeated clicks queue up during a smooth scroll
  let target = null;
  const goTo = (i) => {
    const lastStart = Math.ceil(maxScroll() / step());
    target = Math.max(0, Math.min(i, cards.length - 1, lastStart));
    list.scrollTo({ left: Math.min(target * step(), maxScroll()), behavior: smooth() });
  };
  ['pointerdown', 'wheel', 'touchstart'].forEach((type) => {
    list.addEventListener(type, () => { target = null; }, { passive: true });
  });

  const prev = createButton('expert-tips-prev', 'Previous articles', 'prev');
  const next = createButton('expert-tips-next', 'Next articles', 'next');
  const dots = document.createElement('div');
  dots.className = 'expert-tips-dots';
  const dotButtons = cards.map((card, i) => {
    const dot = createButton('expert-tips-dot', `Show article ${i + 1} of ${cards.length}`);
    dot.addEventListener('click', () => goTo(i));
    dots.append(dot);
    return dot;
  });
  controls.append(prev, dots, next);

  const current = () => target ?? Math.round(list.scrollLeft / step());
  prev.addEventListener('click', () => goTo(current() - 1));
  next.addEventListener('click', () => goTo(current() + 1));

  const update = () => {
    const max = maxScroll();
    if (target !== null && Math.abs(list.scrollLeft - Math.min(target * step(), max)) < 2) {
      target = null;
    }
    controls.hidden = max <= 1;
    const index = list.scrollLeft >= max - 1 ? cards.length - 1 : current();
    dotButtons.forEach((dot, i) => {
      if (i === index) dot.setAttribute('aria-current', 'true');
      else dot.removeAttribute('aria-current');
    });
    prev.disabled = list.scrollLeft <= 1;
    next.disabled = list.scrollLeft >= max - 1;
  };

  let frame;
  list.addEventListener('scroll', () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(update);
  }, { passive: true });
  new ResizeObserver(update).observe(list);
}

export default function decorate(block) {
  instances += 1;
  const id = `expert-tips-${instances}`;
  const rows = [...block.children];

  // a leading row with a heading but no image or link is the block title
  const first = rows[0];
  const intro = first && first.querySelector(HEADINGS) && !first.querySelector('picture, a[href]')
    ? rows.shift()
    : null;

  const list = document.createElement('ul');
  list.className = 'expert-tips-list';
  rows.forEach((row, i) => list.append(buildCard(row, `${id}-title-${i}`)));
  if (!list.children.length) return;

  const content = [];
  if (intro) {
    const header = document.createElement('div');
    header.className = 'expert-tips-intro';
    moveInstrumentation(intro, header);
    [...intro.children].forEach((cell) => header.append(...cellChildren(cell)));
    const heading = header.querySelector(HEADINGS);
    heading.id = `${id}-heading`;
    list.setAttribute('aria-labelledby', heading.id);
    content.push(header);
  } else {
    list.setAttribute('aria-label', 'Articles');
  }

  const rail = document.createElement('div');
  rail.className = 'expert-tips-rail';
  const controls = document.createElement('div');
  controls.className = 'expert-tips-controls';
  controls.hidden = true;
  rail.append(list, controls);
  content.push(rail);

  block.replaceChildren(...content);
  if (list.children.length > 1) setupControls(list, controls);
}
