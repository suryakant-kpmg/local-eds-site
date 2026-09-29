/*
** Authoring format **
Row 1 (header)
  Col 1 contains the heading (plain text, e.g. "Reimagine Your Space")
  Col 2 contains the intro description (plain text)
Row 2+ (one row per card)
  Col 1 contains the desktop image
  Col 2 contains the mobile image (optional, falls back to Col 1)
  Col 3 contains the card title
  Col 4 contains the card description
*/

import { createOptimizedPicture } from '../../scripts/aem.js';

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

  // the header is the first row without an image; every row with one is a card
  const headerRow = rows.find((row) => !row.querySelector('picture, img'));
  const cardRows = rows.filter((row) => row.querySelector('picture, img'));

  const header = document.createElement('div');
  header.className = 'category-showcase-header';
  if (headerRow) {
    const [headingCell, descCell] = headerRow.children;
    const heading = document.createElement('h2');
    heading.className = 'category-showcase-heading';
    heading.textContent = headingCell?.textContent.trim() || '';
    header.append(heading);
    if (descCell?.textContent.trim()) {
      const desc = document.createElement('p');
      desc.className = 'category-showcase-intro';
      desc.textContent = descCell.textContent.trim();
      header.append(desc);
    }
  }

  const list = document.createElement('ul');
  list.className = 'category-showcase-cards';

  cardRows.forEach((row) => {
    // first image is desktop, second (optional) is mobile
    const imgs = [...row.querySelectorAll('img')];
    const desktopImg = imgs[0];
    const mobileImg = imgs[1] || imgs[0];
    const textCells = [...row.children].filter((c) => !c.querySelector('picture, img'));
    const link = row.querySelector('a');
    const title = textCells[0]?.textContent.trim() || '';
    // description is the first text cell after the title that isn't just the link
    const descCell = textCells.slice(1).find((c) => !c.querySelector('a'));
    const description = descCell?.textContent.trim() || '';

    const item = document.createElement('li');
    item.className = 'category-showcase-card';

    // wrap the whole card in the authored link, when there is one
    const inner = link ? document.createElement('a') : item;
    if (link) {
      inner.href = link.getAttribute('href');
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

  // --- pagination dots (mobile only; hidden on desktop via CSS) -----------
  const cards = [...list.children];
  if (cards.length < 2) return;

  const dots = document.createElement('div');
  dots.className = 'category-showcase-dots';
  const dotButtons = cards.map((card, i) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'category-showcase-dot';
    dot.setAttribute('aria-label', `Go to card ${i + 1}`);
    dot.addEventListener('click', () => {
      list.scrollTo({ left: card.offsetLeft - list.offsetLeft, behavior: 'smooth' });
    });
    dots.append(dot);
    return dot;
  });
  block.append(dots);

  const setActive = () => {
    // step is 0 before layout, so fall back to 1 to keep the first dot active
    const step = (cards[1].offsetLeft - cards[0].offsetLeft) || 1;
    // the last cards can't scroll to the start edge, so light the last dot at the end
    const atEnd = list.scrollLeft > 0
      && list.scrollLeft + list.clientWidth >= list.scrollWidth - 2;
    const active = atEnd ? cards.length - 1 : Math.round(list.scrollLeft / step);
    dotButtons.forEach((dot, i) => {
      dot.classList.toggle('active', i === active);
      dot.setAttribute('aria-current', i === active ? 'true' : 'false');
    });
  };
  list.addEventListener('scroll', setActive, { passive: true });
  setActive();
}
