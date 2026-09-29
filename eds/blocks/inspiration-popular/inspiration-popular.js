import { triggerCTAClickWithLinkAndTitle } from '../../scripts/analytics_1.js';

export default function decorate(block) {
  console.log('block', block);

  // scope cards inside block
  block.querySelectorAll(':scope > div').forEach((card) => {
    const divs = card.querySelectorAll(':scope > div');
    if (divs[0]) divs[0].classList.add('inspiration-popular-image');
    if (divs[1]) divs[1].classList.add('inspiration-popular-title');
    if (divs[2]) divs[2].classList.add('inspiration-popular-read-more');
  });

  // scope links inside block
  // Note: by the time decorate() runs, decorateMain() has already called
  // bindButtonContainerTracking() which attached a click listener to every
  // .button-container a.button. Cloning each anchor strips that pre-attached
  // listener so our own handler below is the sole source of custom_cta_click.
  block.querySelectorAll('a').forEach((originalA) => {
    const a = originalA.cloneNode(false);
    a.innerHTML = `Read more <img src="/eds/icons/arrow-icon-new.svg" alt="arrow icon" class="link-icon">`;
    a.dataset.analyticsBound = 'true';
    const card = originalA.closest('.inspiration-popular-read-more')?.parentElement;
    const title = card?.querySelector('.inspiration-popular-title')?.textContent?.trim();
    if (title) {
      a.setAttribute('aria-label', `Read more about ${title}`);
    }
    originalA.replaceWith(a);
  });

  block.addEventListener('click', (event) => {
    const cta = event.target.closest('.inspiration-popular-read-more a');
    if (!cta || !block.contains(cta)) return;

    const ctaLink = cta.getAttribute('href') || '';
    const btnTitle = 'Read more';
    // Walk up to the individual card (parent of .inspiration-popular-read-more),
    // then find its title. Works after the block-1/2/3 restructure.
    const card = cta.closest('.inspiration-popular-read-more')?.parentElement;
    const parentTitle = card?.querySelector('.inspiration-popular-title')?.textContent?.trim() || '';

    triggerCTAClickWithLinkAndTitle(ctaLink, btnTitle, parentTitle);
  });

  const items = Array.from(block.children);

  const isMobile = window.outerWidth < 900;

  // create blocks
  const blocks = (isMobile ? [1, 2] : [1, 2, 3]).map((i) => {
    const div = document.createElement('div');
    div.classList.add(`block-${i}`);
    return div;
  });

  // distribute items
  items.forEach((item, index) => {
    blocks[index % (isMobile ? 2 : 3)].appendChild(item);
  });

  // append back
  block.innerHTML = '';
  blocks.forEach((b) => block.appendChild(b));
}
