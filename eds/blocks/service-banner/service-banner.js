/*
** Authoring format **
Col 1 contains the desktop image
Col 2 contains the mobile image (optional, falls back to Col 1)
Col 3 contains the content (heading, text, CTA buttons)
*/

import { createOptimizedPicture } from '../../scripts/aem.js';
import { triggerCTAClickWithLinkAndTitle } from '../../scripts/analytics_1.js';

export default function decorate(block) {
  const wrapper = block.firstElementChild;
  wrapper.classList.add('wrapper');

  const cells = [...wrapper.children];
  const banner = cells[0];
  // content is always the last column (also keeps older 2-column banners working)
  const content = cells[cells.length - 1];
  const desktopImg = banner.querySelector('img');
  const mobileImg = cells.length > 2 ? cells[1].querySelector('img') : null;

  // one <picture>: mobile image by default, desktop image from 992px up
  let picture = banner.querySelector('picture');
  if (desktopImg && mobileImg) {
    const alt = desktopImg.alt || mobileImg.alt || '';
    // keep the page's loading decision (eager only when it's the LCP image)
    const eager = desktopImg.loading === 'eager';
    picture = createOptimizedPicture(mobileImg.src, alt, eager, [{ width: '750' }]);
    const desktopPicture = createOptimizedPicture(desktopImg.src, alt, eager, [
      { media: '(min-width: 992px)', width: '2000' },
    ]);
    picture.prepend(...desktopPicture.querySelectorAll('source[media]'));
  }

  // drop the mobile-image column now that it's merged into the picture
  if (cells.length > 2) cells[1].remove();

  banner.innerHTML = '';
  banner.className = 'banner';
  content.className = 'content';

  if (picture) banner.appendChild(picture);

  content.querySelectorAll('.button-container a.button').forEach((cta) => {
    // The global bindButtonContainerTracking() (decorateMain) already binds
    // a click handler to every .button-container a.button and sets
    // dataset.analyticsBound. Respect that shared flag so we don't fire a
    // duplicate cta_link_text/custom_cta_click for the same click.
    if (cta.dataset.analyticsBound === 'true') return;
    if (cta.dataset.serviceBannerAnalyticsBound === 'true') return;

    cta.dataset.analyticsBound = 'true';
    cta.dataset.serviceBannerAnalyticsBound = 'true';
    cta.addEventListener('click', () => {
      const ctaLink = cta.getAttribute('href') || '';
      const btnTitle = cta.textContent.trim();
      const parentTitle = content.querySelector('h1, h2, h3, h4, h5, h6')?.textContent.trim() || 'service-banner';

      triggerCTAClickWithLinkAndTitle(ctaLink, btnTitle, parentTitle);
    });
  });
}
