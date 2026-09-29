import { triggerCTAClickWithLinkAndTitle } from '../../scripts/analytics_1.js';

const calculatorBlocks = document.querySelectorAll('.inspiration-calculator');

calculatorBlocks.forEach((block) => {
  if (block.dataset.analyticsBound === 'true') return;

  block.dataset.analyticsBound = 'true';
  block.addEventListener('click', (event) => {
    const cta = event.target.closest('.image-wrapper a, .content-wrapper a');
    if (!cta || !block.contains(cta)) return;

    const ctaLink = cta.getAttribute('href') || '';
    
    // Extract button text from direct text nodes or image alt
    let btnTitle = Array.from(cta.childNodes)
      .filter(node => node.nodeType === Node.TEXT_NODE)
      .map(node => node.textContent)
      .join('')
      .trim() || cta.querySelector('img')?.alt?.trim() || 'CTA';
    
    const parentCard = cta.closest('.image-wrapper, .content-wrapper')?.parentElement;
    const parentTitle = parentCard?.querySelector('h1, h2, h3, h4, h5, h6, p')?.textContent?.trim()
      || parentCard?.querySelector('.image-wrapper img, img')?.alt?.trim()
      || '';

    triggerCTAClickWithLinkAndTitle(ctaLink, btnTitle, parentTitle);
  });
});

// Select all direct div children of .inspiration-calculator
const calculatorDivs = document.querySelectorAll('.inspiration-calculator > div');

calculatorDivs.forEach((div) => {
  const children = Array.from(div.children);
  if (children.length === 0) return; // Skip if no children

  // Wrap the first child in .image-wrapper
  const firstChild = children[0];
  const imageWrapper = document.createElement('div');
  imageWrapper.classList.add('image-wrapper');
  firstChild.replaceWith(imageWrapper);
  imageWrapper.appendChild(firstChild);

  // Wrap all other children in .content-wrapper
  if (children.length > 1) {
    const contentWrapper = document.createElement('div');
    contentWrapper.classList.add('content-wrapper');

    // Process remaining children
    const remainingChildren = children.slice(1);
    remainingChildren.forEach((child) => {
      const link = child.querySelector('a');
      if (link) {
        // Get the href
        const { href } = link;

        // Remove the original link from the DOM
        link.remove();

        // Create new "Calculate Now" anchor
        const calculateNowLink = document.createElement('a');
        calculateNowLink.href = href;
        calculateNowLink.innerHTML = 'Calculate Now <img src="/eds/icons/arrow-icon-new.svg" alt="arrow icon" class="link-icon">';
        calculateNowLink.classList.add('calculate-now-link'); // optional class
        contentWrapper.appendChild(calculateNowLink);
      } else {
        contentWrapper.appendChild(child);
      }
    });

    // Append the content wrapper to the original div
    div.appendChild(contentWrapper);
  }
});
