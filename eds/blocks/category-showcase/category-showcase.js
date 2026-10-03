/*
** Authoring format **
Row 1: Title | heading (e.g. Reimagine Your Space)
Row 2: Subtitle | intro text below the heading
Row 3: CTA | link (optional, no button when empty)
Row 4: Open in new tab | true/false
Row 5: Desktop image | Mobile image | Title | Subtitle | Link (header row, skipped)
Rows 6+ (one row per card)
  Col 1 contains the desktop image
  Col 2 contains the mobile image (optional, falls back to Col 1)
  Col 3 contains the card title
  Col 4 contains the card description
  Col 5 contains the card link (optional)
*/

import { createOptimizedPicture } from '../../scripts/aem.js';
import { triggerCTAClickWithLinkAndTitle } from '../../scripts/analytics_1.js';

const URL_PATTERN = /^(https?:\/\/|\/)\S*$/;

// Labels authors write in the first column of a settings row (label | value)
const SETTING_LABELS = {
  title: ['title', 'heading'],
  subtitle: ['subtitle', 'sub title', 'description'],
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
 * Reads a link from a cell: an authored link, or a bare URL.
 * @param {Element} [cell] The cell
 * @returns {string} The href, or empty string when none is authored
 */
function readHref(cell) {
  const href = cell?.querySelector('a[href]')?.getAttribute('href') || cellText(cell);
  return URL_PATTERN.test(href) ? href : '';
}

/**
 * Builds the CTA from the CTA cell, styled with the global outline button
 * unless it is a plain text link.
 * @param {Element} cell The CTA cell
 * @param {boolean} newTab Whether the link opens in a new tab
 * @param {string} sectionTitle The block heading, for analytics
 * @param {boolean} [plain] Whether to render a text link instead of a button
 * @returns {HTMLParagraphElement|null} The CTA wrapper
 */
function buildCta(cell, newTab, sectionTitle, plain = false) {
  const href = readHref(cell);
  if (!href) return null;

  const link = document.createElement('a');
  link.className = plain ? 'category-showcase-cta' : 'button secondary category-showcase-cta';
  link.href = href;
  link.textContent = cell.querySelector('a[href]')?.textContent.trim() || href;
  if (newTab) {
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  }
  link.addEventListener('click', () => {
    triggerCTAClickWithLinkAndTitle(link.href, link.textContent.trim(), sectionTitle);
  });

  const wrapper = document.createElement('p');
  wrapper.className = plain ? 'category-showcase-cta-wrapper' : 'button-container category-showcase-cta-wrapper';
  wrapper.append(link);
  return wrapper;
}

/**
 * Category Showcase
 * A centred heading and intro above a row of category cards (image, title,
 * short description). Desktop shows four cards per row; mobile scrolls
 * horizontally with fixed-width cards. See the authoring format above.
 *
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const rows = [...block.children];
  if (!rows.length) return;
  // side-cta-variant: CTA beside the heading, cards loop on mobile
  const sideCta = block.classList.contains('side-cta-variant');

  // settings rows are label | value; every row with an image is a card
  const settings = {};
  const cardRows = [];
  rows.forEach((row) => {
    if (row.querySelector('picture, img')) {
      cardRows.push(row);
      return;
    }
    const cells = [...row.children];
    const setting = labelOf(cells[0]);
    if (setting) [, settings[setting]] = cells;
  });

  const header = document.createElement('div');
  header.className = 'category-showcase-header';
  const headingText = cellText(settings.title);
  if (headingText) {
    const heading = document.createElement('h2');
    heading.className = 'category-showcase-heading';
    heading.textContent = headingText;
    header.append(heading);
  }
  const introText = cellText(settings.subtitle);
  if (introText) {
    const desc = document.createElement('p');
    desc.className = 'category-showcase-intro';
    desc.textContent = introText;
    header.append(desc);
  }

  const list = document.createElement('ul');
  list.className = 'category-showcase-cards';

  cardRows.forEach((row) => {
    // first image is desktop, second (optional) is mobile
    const imgs = [...row.querySelectorAll('img')];
    const desktopImg = imgs[0];
    const mobileImg = imgs[1] || imgs[0];
    const textCells = [...row.children].filter((c) => !c.querySelector('picture, img'));
    const title = textCells[0]?.textContent.trim() || '';
    // description is the first text cell after the title that isn't just the link
    const descCell = textCells.slice(1).find((c) => !readHref(c));
    const description = descCell?.textContent.trim() || '';
    const href = textCells.slice(1).map(readHref).find(Boolean)
      || row.querySelector('a[href]')?.getAttribute('href');

    const item = document.createElement('li');
    item.className = 'category-showcase-card';

    // wrap the whole card in the authored link, when there is one
    const inner = href ? document.createElement('a') : item;
    if (href) {
      inner.href = href;
      inner.className = 'category-showcase-link';
      item.append(inner);
    }

    if (mobileImg) {
      const alt = mobileImg.alt || desktopImg.alt || title;
      const picture = createOptimizedPicture(mobileImg.src, alt, false, [{ width: '750' }]);
      // swap in the desktop image from the 900px breakpoint up
      if (desktopImg !== mobileImg) {
        const desktopPicture = createOptimizedPicture(desktopImg.src, alt, false, [
          { media: '(min-width: 900px)', width: '750' },
        ]);
        picture.prepend(...desktopPicture.querySelectorAll('source[media]'));
      }
      picture.classList.add('category-showcase-image');
      inner.append(picture);
    }

    const titleEl = document.createElement('h3');
    titleEl.className = 'category-showcase-title';
    titleEl.textContent = title;
    inner.append(titleEl);

    if (description) {
      const descEl = document.createElement('p');
      descEl.className = 'category-showcase-desc';
      descEl.textContent = description;
      inner.append(descEl);
    }

    list.append(item);
  });

  block.replaceChildren(header, list);

  if (settings.cta) {
    const newTab = /^(true|yes)$/i.test(cellText(settings.ctaNewTab));
    const cta = buildCta(settings.cta, newTab, headingText, sideCta);
    if (cta) (sideCta ? header : block).append(cta);
  }

  // --- pagination dots (mobile only; hidden on desktop via CSS) -----------
  const cards = [...list.children];
  if (cards.length < 2) return;

  // looping: a copy of every card on each side; landing on a copy jumps to
  // the matching real card. The copies are hidden on desktop via CSS.
  const loop = sideCta;
  if (loop) {
    const makeClones = () => cards.map((card) => {
      const clone = card.cloneNode(true);
      clone.classList.add('category-showcase-clone');
      clone.setAttribute('aria-hidden', 'true');
      clone.querySelectorAll('a').forEach((a) => a.setAttribute('tabindex', '-1'));
      return clone;
    });
    list.prepend(...makeClones());
    list.append(...makeClones());
  }

  // the copies are display: none on desktop, which leaves them without an offsetParent
  const looping = () => loop && list.firstElementChild.offsetParent !== null;
  const origin = () => (looping() ? list.firstElementChild : cards[0]).offsetLeft;
  const leftOf = (card) => card.offsetLeft - origin();
  // step is 0 before layout, so fall back to 1 to keep the first dot active
  const stepOf = () => (cards[1].offsetLeft - cards[0].offsetLeft) || 1;

  const dots = document.createElement('div');
  dots.className = 'category-showcase-dots';
  const dotButtons = cards.map((card, i) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'category-showcase-dot';
    dot.setAttribute('aria-label', `Go to card ${i + 1}`);
    dot.addEventListener('click', () => {
      list.scrollTo({ left: leftOf(card), behavior: 'smooth' });
    });
    dots.append(dot);
    return dot;
  });
  list.after(dots);

  const setActive = () => {
    const step = stepOf();
    let active;
    if (looping()) {
      const n = cards.length;
      active = (((Math.round((list.scrollLeft - leftOf(cards[0])) / step)) % n) + n) % n;
    } else {
      // the last cards can't scroll to the start edge, so light the last dot at the end
      const atEnd = list.scrollLeft > 0
        && list.scrollLeft + list.clientWidth >= list.scrollWidth - 2;
      active = atEnd ? cards.length - 1 : Math.round(list.scrollLeft / step);
    }
    dotButtons.forEach((dot, i) => {
      dot.classList.toggle('active', i === active);
      dot.setAttribute('aria-current', i === active ? 'true' : 'false');
    });
  };

  // once the swipe settles on a copy, jump to the same spot among the real cards
  const wrap = () => {
    if (!looping()) return;
    const span = stepOf() * cards.length;
    const first = leftOf(cards[0]);
    if (list.scrollLeft < first - stepOf() / 2) list.scrollLeft += span;
    else if (list.scrollLeft > first + span - stepOf() / 2) list.scrollLeft -= span;
  };
  let settle;
  list.addEventListener('scroll', () => {
    setActive();
    clearTimeout(settle);
    settle = setTimeout(wrap, 120);
  }, { passive: true });

  if (loop) {
    // start on the first real card once the list has a width (and again on resize)
    let lastWidth = 0;
    new ResizeObserver(() => {
      if (!list.clientWidth || list.clientWidth === lastWidth) return;
      lastWidth = list.clientWidth;
      if (looping()) list.scrollLeft = leftOf(cards[0]);
      setActive();
    }).observe(list);
  }
  setActive();
}
