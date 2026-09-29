/* eslint-disable */
/* global WebImporter */

/**
 * Parser for tabs-categories block
 *
 * Source: https://www.asianpaints.com/products/paints-and-textures/interior-walls/royale-play.html
 * Base Block: tabs
 *
 * Block Structure:
 * - 2 columns: tab label | tab content (image, description, CTA)
 *
 * Source HTML Pattern:
 * <div class="main-seven-image-accordion-container">
 *   <div class="child-card">
 *     <img src="background.jpg">
 *     <picture class="packshot-image"><img src="packshot.png"></picture>
 *     <div class="txt-wrapper">
 *       <span class="heading">Stucco</span>
 *       <div class="additional-txt">
 *         <span class="desc-txt">Description...</span>
 *         <div class="explore-now-button">
 *           <a href="/path">View Details</a>
 *         </div>
 *       </div>
 *     </div>
 *   </div>
 * </div>
 *
 * Generated: 2026-01-30
 */
export default function parse(element, { document }) {
  const cells = [];

  // Find all tab/category items
  const items = element.querySelectorAll('.child-card');

  items.forEach(item => {
    // Extract tab label (heading/category name)
    const headingEl = item.querySelector('.heading, .txt-wrapper .heading, h3, h4');
    const tabLabel = headingEl ? headingEl.textContent.trim() : '';

    // Build tab content
    const tabContent = document.createElement('div');

    // Extract background/main image
    const bgImage = item.querySelector(':scope > img, .background-image img');
    if (bgImage) {
      const imgClone = bgImage.cloneNode(true);
      tabContent.appendChild(imgClone);
      tabContent.appendChild(document.createElement('br'));
    }

    // Extract packshot/product image
    const packshotImage = item.querySelector('.packshot-image img, picture.packshot-image img');
    if (packshotImage) {
      const packshotClone = packshotImage.cloneNode(true);
      tabContent.appendChild(packshotClone);
      tabContent.appendChild(document.createElement('br'));
    }

    // Extract description
    const descEl = item.querySelector('.desc-txt, .description, .additional-txt span');
    if (descEl) {
      const p = document.createElement('p');
      p.textContent = descEl.textContent.trim();
      tabContent.appendChild(p);
    }

    // Extract CTA link
    const ctaLink = item.querySelector('.explore-now-button a, .cta a, a[href]:not([href="javascript:void(0)"])');
    if (ctaLink) {
      const href = ctaLink.getAttribute('href');
      let text = ctaLink.textContent.trim().replace(/\s+/g, ' ');
      if (href && href !== 'javascript:void(0)') {
        const ctaP = document.createElement('p');
        const strong = document.createElement('strong');
        const a = document.createElement('a');
        a.href = href;
        a.textContent = text || 'View Details';
        strong.appendChild(a);
        ctaP.appendChild(strong);
        tabContent.appendChild(ctaP);
      }
    }

    if (tabLabel) {
      cells.push([tabLabel, tabContent]);
    }
  });

  // Create block using WebImporter utility
  const block = WebImporter.Blocks.createBlock(document, { name: 'Tabs-Categories', cells });

  // Replace original element with structured block table
  element.replaceWith(block);
}
