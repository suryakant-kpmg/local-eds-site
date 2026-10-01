/*
** Authoring format **

Row 1 (Title)
Col 1 → Label "Title"
Col 2 → Carousel title (e.g. "Our shade cards")

Row 2 (optional column labels, ignored)
Desktop image | Mobile image | Title | Subtitle | CTA label | Link

Row 3 onwards (one row per card)
Col 1 → Desktop image (picture)
Col 2 → Mobile image (picture) - shown below 600px, falls back to the desktop image
Col 3 → Card title (e.g. "Royale Shade Card")
Col 4 → Subtitle (e.g. "Premium colour inspiration guide for interiors.")
Col 5 → CTA label (e.g. "Download PDF")
Col 6 → Link (e.g. /content/dam/asian_paints/.../Royale-Shade-Card-PDF-new.pdf)

----------------------------------------
Variant: magazine
(block authored as "multi-carousel (magazine)")

Same authoring format. Dark section, no arrows or dots; cards stack on mobile
and sit in a 3-column grid on desktop (Swiper is not initialised).
*/
import { createOptimizedPicture } from '../../scripts/aem.js';

const DESKTOP_MEDIA = '(min-width: 600px)';

/**
 * @param {Element} cell
 * @returns {string} trimmed text of the cell
 */
const text = (cell) => (cell?.textContent || '').trim();

/**
 * builds a picture that shows the mobile image below 600px and the desktop image above
 * @param {HTMLImageElement} desktop desktop image
 * @param {HTMLImageElement} mobile mobile image
 * @param {string} alt alternative text
 * @returns {HTMLPictureElement}
 */
function buildPicture(desktop, mobile, alt) {
  const base = mobile || desktop;
  const picture = createOptimizedPicture(base.src, alt, false, [{ width: '750' }]);
  if (desktop && mobile && desktop.src !== mobile.src) {
    const desktopPicture = createOptimizedPicture(desktop.src, alt, false, [
      { media: DESKTOP_MEDIA, width: '750' },
      { width: '750' },
    ]);
    picture.prepend(...desktopPicture.querySelectorAll('source[media]'));
  }
  return picture;
}

/**
 * builds a card from a row:
 * desktop image | mobile image | title | subtitle | cta label | link
 * @param {Element} row the block row
 * @returns {HTMLLIElement}
 */
function buildCard(row) {
  const [desktopCell, mobileCell, titleCell, subtitleCell, labelCell, linkCell] = row.children;
  const desktopImg = desktopCell?.querySelector('img');
  const mobileImg = mobileCell?.querySelector('img');
  const title = text(titleCell);

  const card = document.createElement('li');
  card.className = 'multi-carousel-card swiper-slide';

  const image = document.createElement('div');
  image.className = 'multi-carousel-image';
  const alt = desktopImg?.alt || mobileImg?.alt || title;
  image.append(buildPicture(desktopImg, mobileImg, alt));

  const body = document.createElement('div');
  body.className = 'multi-carousel-body';

  if (title) {
    const heading = document.createElement('h3');
    heading.textContent = title;
    body.append(heading);
  }

  const subtitle = text(subtitleCell);
  if (subtitle) {
    const p = document.createElement('p');
    p.textContent = subtitle;
    body.append(p);
  }

  // the link cell may hold an anchor or the plain path
  const href = linkCell?.querySelector('a[href]')?.getAttribute('href') || text(linkCell);
  if (href) {
    const label = text(labelCell) || 'Download PDF';
    const link = document.createElement('a');
    link.className = 'multi-carousel-download';
    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = label;
    if (title) link.setAttribute('aria-label', `${label}: ${title}`);
    const cta = document.createElement('p');
    cta.className = 'multi-carousel-cta';
    cta.append(link);
    body.append(cta);
  }

  card.append(image, body);
  return card;
}

/**
 * @param {string} direction prev or next
 * @param {string} label accessible label
 * @returns {HTMLButtonElement}
 */
function createArrow(direction, label) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `multi-carousel-${direction}`;
  button.setAttribute('aria-label', label);
  return button;
}

/**
 * loads and decorates the multi-carousel block
 * @param {Element} block The multi-carousel block element
 */
export default async function decorate(block) {
  const header = document.createElement('div');
  header.className = 'multi-carousel-header';
  const wrapper = document.createElement('ul');
  wrapper.className = 'multi-carousel-track swiper-wrapper';

  [...block.children].forEach((row) => {
    if (row.querySelector('img')) {
      wrapper.append(buildCard(row));
      return;
    }
    // "Title | value" row; any other row without an image (column labels) is ignored
    const [label, value] = row.children;
    if (text(label).toLowerCase() === 'title' && text(value)) {
      const heading = value.querySelector('h1, h2, h3, h4, h5, h6') || document.createElement('h2');
      if (!heading.parentElement) heading.textContent = text(value);
      header.append(heading);
    }
  });

  const heading = header.querySelector('h1, h2, h3, h4, h5, h6');
  if (heading) {
    heading.id = heading.id || `multi-carousel-${Math.random().toString(36).slice(2, 8)}`;
    wrapper.setAttribute('aria-labelledby', heading.id);
  }

  const container = document.createElement('div');
  container.className = 'multi-carousel-swiper swiper';
  container.append(wrapper);

  // magazine is a static grid, so no arrows, dots or Swiper
  if (block.classList.contains('magazine')) {
    block.replaceChildren(header, container);
    return;
  }

  const prev = createArrow('prev', 'Previous');
  const next = createArrow('next', 'Next');
  const nav = document.createElement('div');
  nav.className = 'multi-carousel-nav';
  nav.append(prev, next);
  header.append(nav);

  const dots = document.createElement('div');
  dots.className = 'multi-carousel-dots';

  block.replaceChildren(header, container, dots);

  const Swiper = await window.loadSwiper?.().catch(() => null);
  if (!Swiper) return;

  // visible cards: 1.75 on mobile, 2.75 on tablet, 4.4 to 4.6 on desktop
  // eslint-disable-next-line no-new
  new Swiper(container, {
    slidesPerView: 1.75,
    spaceBetween: 12,
    speed: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 400,
    navigation: { prevEl: prev, nextEl: next },
    pagination: {
      el: dots,
      clickable: true,
      bulletElement: 'button',
      bulletClass: 'multi-carousel-dot',
      bulletActiveClass: 'multi-carousel-dot-active',
    },
    a11y: {
      prevSlideMessage: 'Previous',
      nextSlideMessage: 'Next',
      paginationBulletMessage: 'Show card {{index}}',
    },
    breakpoints: {
      600: { slidesPerView: 2.75, spaceBetween: 24 },
      900: { slidesPerView: 4.4, spaceBetween: 40 },
      1200: { slidesPerView: 4.6, spaceBetween: 40 },
    },
  });
}
