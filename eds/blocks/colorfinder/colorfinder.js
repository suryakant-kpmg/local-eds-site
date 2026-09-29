import { createOptimizedPicture } from '../../scripts/aem.js';

// round arrow icon from the AEM colorfinder component
const ARROW_ICON = `<svg class="colorfinder-arrow" width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true" focusable="false">
  <path d="M0.5 16C0.5 7.43959 7.43959 0.5 16 0.5C24.5604 0.5 31.5 7.43959 31.5 16C31.5 24.5604 24.5604 31.5 16 31.5C7.43959 31.5 0.5 24.5604 0.5 16Z" stroke="white"/>
  <path d="M16.8887 11.3334L21.3332 16M21.3332 16L16.8887 20.6667M21.3332 16L10.6665 16" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

/**
 * @param {Element} el an element whose text may contain line breaks
 * @returns {string} its text with line breaks read as spaces
 */
function readableText(el) {
  const copy = el.cloneNode(true);
  copy.querySelectorAll('br').forEach((br) => br.replaceWith(' '));
  return copy.textContent.replace(/\s+/g, ' ').trim();
}

/**
 * @param {HTMLAnchorElement} link an authored link
 * @returns {boolean} true when the link text is just its URL (a bare link)
 */
function isBareLink(link) {
  const text = link.textContent.trim();
  return !text || text === link.href || text === link.getAttribute('href');
}

/**
 * builds one card from a row: image | heading, description, link | options
 * @param {Element} row the block row
 * @returns {HTMLElement}
 */
function buildCard(row) {
  const [imageCell, contentCell, optionsCell] = [...row.children];
  const link = contentCell && contentCell.querySelector('a[href]');
  const options = (optionsCell ? optionsCell.textContent : '').toLowerCase();
  const img = imageCell && imageCell.querySelector('img');

  // no heading or description: the image already contains the text (image-only card)
  const hasText = contentCell && ([...contentCell.querySelectorAll('h1, h2, h3, h4, h5, h6, p')]
    .some((el) => !el.querySelector('a[href]') && el.textContent.trim()));
  const imageOnly = !!img && !hasText;

  // the whole card is the link when one is authored
  const card = document.createElement(link ? 'a' : 'div');
  card.className = 'colorfinder-card';
  if (imageOnly) card.classList.add('image-only');
  if (options.includes('right')) card.classList.add('text-right');
  if (options.includes('gold')) card.classList.add('title-gold');

  if (img) {
    const image = document.createElement('div');
    image.className = 'colorfinder-image';
    // text cards: decorative background; image-only cards: the alt text describes the card
    image.append(createOptimizedPicture(img.src, imageOnly ? img.alt : '', false, [
      { media: '(min-width: 900px)', width: '1400' },
      { width: '750' },
    ]));
    card.append(image);
  }

  if (imageOnly) {
    if (link) {
      card.href = link.href;
      if (img.alt) card.setAttribute('aria-label', img.alt);
    }
    return card;
  }

  const content = document.createElement('div');
  content.className = 'colorfinder-content';

  if (contentCell) {
    const heading = contentCell.querySelector('h1, h2, h3, h4, h5, h6');
    if (heading) {
      heading.classList.add('colorfinder-title');
      content.append(heading);
    }
    contentCell.querySelectorAll('p').forEach((p) => {
      if (p.querySelector('a[href]') || !p.textContent.trim()) return;
      p.className = 'colorfinder-desc';
      content.append(p);
    });
  }

  if (link) {
    card.href = link.href;
    const title = content.querySelector('.colorfinder-title');
    if (isBareLink(link)) {
      // no button text: show the round arrow like the Home Colour Guide card
      content.insertAdjacentHTML('beforeend', ARROW_ICON);
      if (title) card.setAttribute('aria-label', readableText(title));
    } else {
      // link text becomes a pill button like the Quotation Calculator card
      const button = document.createElement('span');
      button.className = 'colorfinder-button';
      button.textContent = link.textContent.trim();
      content.append(button);
      card.classList.add('has-button');
    }
  }

  card.append(content);
  return card;
}

/**
 * loads and decorates the colorfinder block
 * @param {Element} block The colorfinder block element
 */
export default function decorate(block) {
  const cards = [...block.children].map(buildCard);
  block.replaceChildren(...cards);
}
