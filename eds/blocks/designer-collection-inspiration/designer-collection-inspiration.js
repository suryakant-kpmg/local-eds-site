import { trackEvent, pushAdobeCtaClickEvent } from '../../scripts/analytics_1.js';

const CTA_CONFIG = {
  download: {
    icon: '/eds/icons/download-icon-black.svg',
    iconAlt: 'download icon',
    iconClass: 'link-icon link-icon-download',
  },
  redirection: {
    icon: '/eds/icons/arrow-icon-new.svg',
    iconAlt: 'arrow icon',
    iconClass: 'link-icon',
  },
};

/**
 * Block structure (one row per card):
 * Desktop image | Desktop image hover | Mobile image | Redirection or Download | CTA label | Link
 */
export default function decorate(block) {
  const items = [...block.children];

  items.forEach((item) => {
    const cells = [...item.children];
    const [desktopCell, hoverCell, mobileCell, typeCell, labelCell, linkCell] = cells;
    const desktopImg = desktopCell?.querySelector('img');

    // Skip header/label rows and incomplete rows
    if (!desktopImg) {
      item.remove();
      return;
    }

    const hoverImg = hoverCell?.querySelector('img');
    const mobileImg = mobileCell?.querySelector('img');

    const desktopSrc = desktopImg.src;
    const hoverSrc = hoverImg?.src || desktopSrc;
    const mobileSrc = mobileImg?.src || desktopSrc;

    const type = typeCell?.textContent.trim().toLowerCase() === 'download' ? 'download' : 'redirection';
    const cta = CTA_CONFIG[type];
    const ctaLabel = labelCell?.textContent.trim() || '';

    const linkAnchor = linkCell?.querySelector('a');
    const link = linkAnchor?.getAttribute('href') || linkCell?.textContent.trim() || '';

    // Create elements
    const div1 = document.createElement('div');
    div1.className = 'designer-collection-inspiration-default';
    div1.style.setProperty('--bg-desktop', `url(${desktopSrc})`);
    div1.style.setProperty('--bg-mobile', `url(${mobileSrc})`);

    const div2 = document.createElement('div');
    div2.className = 'designer-collection-inspiration-hover';
    div2.style.backgroundImage = `url(${hoverSrc})`;
    div2.style.backgroundSize = 'cover';

    const anchor = document.createElement('a');
    anchor.href = link;
    anchor.target = '_blank';
    anchor.classList.add(`cta-${type}`);
    anchor.textContent = `${ctaLabel} `;
    anchor.insertAdjacentHTML('beforeend', `<img src="${cta.icon}" alt="${cta.iconAlt}" class="${cta.iconClass}">`);

    // Extract image alt text for tracking
    const imageAltText = desktopImg.alt || 'Designer Collection';

    anchor.addEventListener('click', () => {
      const downloadPdfName = anchor.textContent?.trim() || '';
      trackEvent('download_multiple_pdf', {
        pdfName: downloadPdfName,
        Title: imageAltText,
      });
      pushAdobeCtaClickEvent({
        event: 'download_multiple_pdf',
        title: downloadPdfName,
      });
    });

    // Wrapper to hold all three as siblings
    const wrapper = document.createElement('div');
    wrapper.appendChild(div1);
    wrapper.appendChild(div2);
    wrapper.appendChild(anchor);

    // Replace original item
    item.replaceWith(wrapper);
  });
}
