import { trackEvent , pushAdobeCtaClickEvent } from '../../scripts/analytics_1.js';

export default function decorate(block) {
  const items = [...block.children];

  items.forEach((item) => {
    const pictures = item.querySelectorAll('picture');
    const linkEl = item.querySelector('p a') || item.querySelector('p');

    if (pictures.length < 2 || !linkEl) return;

    // Extract image URLs
    const img1 = pictures[0].querySelector('img')?.src;
    const img2 = pictures[1].querySelector('img')?.src;

    // Extract link
    const link = linkEl.textContent.trim();

    // Create elements
    const div1 = document.createElement('div');
    div1.style.backgroundImage = `url(${img1})`;
    div1.style.backgroundSize = 'cover';

    const div2 = document.createElement('div');
    div2.style.backgroundImage = `url(${img2})`;
    div2.style.backgroundSize = 'cover';

    const anchor = document.createElement('a');
    anchor.href = link;
    anchor.target = '_blank';
    anchor.innerHTML = 'Explore inspirations <img src="/eds/icons/arrow-icon-new.svg" alt="arrow icon" class="link-icon">';
    
    // Extract image alt text for tracking
    const imageAltText = pictures[0].querySelector('img')?.alt || 'Designer Collection';
    
    anchor.addEventListener('click', () => {
      const downloadPdfName = anchor.textContent?.trim() || '';
      trackEvent('download_multiple_pdf', {
        pdfName: downloadPdfName,
        Title: imageAltText,
      });
      pushAdobeCtaClickEvent({
        event: "download_multiple_pdf",
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
