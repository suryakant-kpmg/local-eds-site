import { createOptimizedPicture } from '../../scripts/aem.js';

// below the desktop breakpoint the authored mobile image replaces the desktop image
const MOBILE_MEDIA = '(max-width: 991px)';

/**
 * builds the card picture, adding the mobile image as an art-directed
 * source when one is authored
 * @param {HTMLImageElement} desktopImg the desktop image
 * @param {HTMLImageElement} [mobileImg] optional separate image for mobile
 * @returns {HTMLPictureElement}
 */
function buildPicture(desktopImg, mobileImg) {
  const picture = createOptimizedPicture(desktopImg.src, desktopImg.alt, false, [
    { media: '(min-width: 992px)', width: '1320' },
    { width: '900' },
  ]);

  if (mobileImg) {
    const mobilePicture = createOptimizedPicture(mobileImg.src, mobileImg.alt, false, [
      { width: '750' },
    ]);
    // prepend so the mobile source wins below the breakpoint
    mobilePicture.querySelectorAll('source').forEach((source) => {
      source.setAttribute('media', MOBILE_MEDIA);
      picture.prepend(source);
    });
  }

  return picture;
}

/**
 * loads and decorates the twocolumndownload block
 * @param {Element} block The twocolumndownload block element
 */
export default function decorate(block) {
  const cards = [...block.children].map((row) => {
    const cells = [...row.children];
    // cells by position: desktop image | mobile image | hover image | pdf link
    const [desktopImg, mobileImg, hoverImg] = [0, 1, 2]
      .map((i) => cells[i]?.querySelector('img') || null);
    const link = row.querySelector('a[href]');

    // the whole card is the download link when a pdf is authored
    const card = document.createElement(link ? 'a' : 'div');
    card.className = 'twocolumndownload-card';

    if (desktopImg) {
      const image = document.createElement('div');
      image.className = 'twocolumndownload-image';
      image.append(buildPicture(desktopImg, mobileImg));
      card.append(image);
    }

    if (hoverImg) {
      const hover = document.createElement('div');
      hover.className = 'twocolumndownload-hover-image';
      // decorative: the card already has an accessible name
      hover.append(createOptimizedPicture(hoverImg.src, '', false, [{ width: '1600' }]));
      card.append(hover);
    }

    if (link) {
      const label = link.textContent.trim() || 'Download PDF';
      const name = desktopImg ? desktopImg.alt : '';
      card.href = link.href;
      card.target = '_blank';
      card.rel = 'noopener';
      card.setAttribute('aria-label', name ? `${label}: ${name}` : label);

      const button = document.createElement('span');
      button.className = 'twocolumndownload-button';
      button.textContent = label;
      card.append(button);
    }

    return card;
  });

  block.replaceChildren(...cards);
}
