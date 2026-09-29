import { createOptimizedPicture } from '../../scripts/aem.js';

/**
 * enables or disables the arrows depending on the scroll position
 * @param {HTMLElement} track the scrolling card list
 * @param {HTMLButtonElement} prev previous arrow
 * @param {HTMLButtonElement} next next arrow
 */
function updateArrows(track, prev, next) {
  const max = track.scrollWidth - track.clientWidth - 1;
  prev.disabled = track.scrollLeft <= 1;
  next.disabled = track.scrollLeft >= max;
}

/**
 * @param {string} direction prev or next
 * @param {string} label accessible label
 * @returns {HTMLButtonElement}
 */
function createArrow(direction, label) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `multicarousel-${direction}`;
  button.setAttribute('aria-label', label);
  return button;
}

/**
 * builds a card from a row: image cell | title, description and pdf link
 * @param {Element} row the block row
 * @param {HTMLImageElement} img the card image
 * @returns {HTMLLIElement}
 */
function buildCard(row, img) {
  const card = document.createElement('li');
  card.className = 'multicarousel-card';

  const image = document.createElement('div');
  image.className = 'multicarousel-image';
  image.append(createOptimizedPicture(img.src, img.alt, false, [{ width: '750' }]));

  const body = document.createElement('div');
  body.className = 'multicarousel-body';
  const content = [...row.children].find((cell) => !cell.querySelector('img'));
  if (content) body.append(...content.childNodes);

  const link = body.querySelector('a[href]');
  if (link) {
    const title = body.querySelector('h1, h2, h3, h4, h5, h6');
    link.className = 'multicarousel-download';
    link.target = '_blank';
    link.rel = 'noopener';
    if (title) link.setAttribute('aria-label', `${link.textContent.trim()}: ${title.textContent.trim()}`);
    const wrapper = link.closest('p');
    if (wrapper) wrapper.className = 'multicarousel-cta';
  }

  card.append(image, body);
  return card;
}

/**
 * loads and decorates the multicarousel block
 * @param {Element} block The multicarousel block element
 */
export default function decorate(block) {
  const header = document.createElement('div');
  header.className = 'multicarousel-header';
  const track = document.createElement('ul');
  track.className = 'multicarousel-track';

  [...block.children].forEach((row) => {
    const img = row.querySelector('img');
    if (img) {
      track.append(buildCard(row, img));
    } else if (row.firstElementChild) {
      // a row without an image holds the carousel title
      header.append(...row.firstElementChild.childNodes);
    }
  });

  const heading = header.querySelector('h1, h2, h3, h4, h5, h6');
  if (heading) {
    heading.id = heading.id || `multicarousel-${Math.random().toString(36).slice(2, 8)}`;
    track.setAttribute('aria-labelledby', heading.id);
  }

  const prev = createArrow('prev', 'Previous');
  const next = createArrow('next', 'Next');
  const nav = document.createElement('div');
  nav.className = 'multicarousel-nav';
  nav.append(prev, next);
  header.append(nav);

  // one card's width plus the gap between cards
  const step = () => {
    const card = track.querySelector('.multicarousel-card');
    const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
    return card ? card.getBoundingClientRect().width + gap : track.clientWidth;
  };
  const behavior = () => (window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');

  prev.addEventListener('click', () => track.scrollBy({ left: -step(), behavior: behavior() }));
  next.addEventListener('click', () => track.scrollBy({ left: step(), behavior: behavior() }));

  // pagination dots (shown on mobile instead of the arrows)
  const cards = [...track.children];
  const dots = document.createElement('div');
  dots.className = 'multicarousel-dots';
  cards.forEach((card, i) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'multicarousel-dot';
    dot.setAttribute('aria-label', `Show card ${i + 1} of ${cards.length}`);
    dot.addEventListener('click', () => track.scrollTo({ left: i * step(), behavior: behavior() }));
    dots.append(dot);
  });

  const updateDots = () => {
    const atEnd = track.scrollLeft >= track.scrollWidth - track.clientWidth - 1;
    const current = atEnd ? cards.length - 1 : Math.round(track.scrollLeft / step());
    [...dots.children].forEach((dot, i) => {
      if (i === current) dot.setAttribute('aria-current', 'true');
      else dot.removeAttribute('aria-current');
    });
  };

  const update = () => {
    updateArrows(track, prev, next);
    updateDots();
  };
  track.addEventListener('scroll', update, { passive: true });
  new ResizeObserver(update).observe(track);

  block.replaceChildren(header, track, dots);
}
