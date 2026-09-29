/*
** Authoring format **
One row per card:
Col 1 - image
Col 2 - title
Col 3 - subtitle
Col 4 - cta label
Col 5 - cta redirection link
*/

import { triggerCTAClickWithLinkAndTitle } from '../../scripts/analytics_1.js';
import { moveInstrumentation } from '../../scripts/scripts.js';

function getText(col) {
  return col?.textContent.trim() || '';
}

function getLink(col) {
  if (!col) return '';
  const anchor = col.querySelector('a');
  return anchor?.getAttribute('href') || getText(col);
}

export default function decorate(block) {
  const cardsContainer = document.createElement('div');
  cardsContainer.className = 'cards-action-container';

  [...block.children].forEach((row) => {
    const [imageCol, titleCol, subtitleCol, ctaLabelCol, ctaLinkCol] = [...row.children];

    const picture = imageCol?.querySelector('picture');
    const title = getText(titleCol);
    const subtitle = getText(subtitleCol);
    const ctaLabel = getText(ctaLabelCol);
    const ctaLink = getLink(ctaLinkCol);

    if (!picture && !title && !subtitle && !ctaLabel) return;

    const card = document.createElement('div');
    card.className = 'cards-action-card';
    moveInstrumentation(row, card);

    if (picture) {
      const imageWrapper = document.createElement('div');
      imageWrapper.className = 'cards-action-image';
      imageWrapper.appendChild(picture);
      card.appendChild(imageWrapper);
    }

    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'cards-action-content';

    if (title) {
      const titleEl = document.createElement('h3');
      titleEl.className = 'cards-action-title';
      titleEl.textContent = title;
      contentWrapper.appendChild(titleEl);
    }

    if (subtitle) {
      const subtitleEl = document.createElement('p');
      subtitleEl.className = 'cards-action-description';
      subtitleEl.textContent = subtitle;
      contentWrapper.appendChild(subtitleEl);
    }

    if (ctaLabel && ctaLink) {
      const ctaEl = document.createElement('a');
      ctaEl.className = 'cards-action-cta';
      ctaEl.href = ctaLink;
      ctaEl.textContent = ctaLabel;
      ctaEl.addEventListener('click', () => {
        triggerCTAClickWithLinkAndTitle(ctaLink, ctaLabel, title);
      });
      contentWrapper.appendChild(ctaEl);
    }

    card.appendChild(contentWrapper);
    cardsContainer.appendChild(card);
  });

  block.replaceChildren(cardsContainer);
}
