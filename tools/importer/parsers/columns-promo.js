/* eslint-disable */
/* global WebImporter */

/**
 * Parser for columns-promo block
 *
 * Source: https://www.asianpaints.com/products/paints-and-textures/interior-walls/royale-play.html
 * Base Block: columns
 *
 * Block Structure:
 * - 2 columns: left promotional panel | right promotional panel
 * - Each panel has image, heading, description, CTA
 *
 * Source HTML Pattern:
 * <div class="trendingArticlesSec">
 *   <div class="trendingItem">
 *     <picture><img src="promo.jpg"></picture>
 *     <div class="heading">Roots</div>
 *     <div class="description">Traditional Indian handicraft...</div>
 *     <a href="/path">Explore Now</a>
 *   </div>
 *   <div class="trendingItem">...</div>
 * </div>
 *
 * Generated: 2026-01-30
 */
export default function parse(element, { document }) {
  const cells = [];

  // Find all promotional items
  const items = element.querySelectorAll('.trendingItem, .trending-item, .promo-item');

  // Build row with all columns
  const row = [];

  items.forEach(item => {
    // Create column content
    const columnContent = document.createElement('div');

    // Extract image
    const image = item.querySelector('picture img, img');
    if (image) {
      const imgClone = image.cloneNode(true);
      columnContent.appendChild(imgClone);
      columnContent.appendChild(document.createElement('br'));
    }

    // Extract heading/title
    const headingEl = item.querySelector('.heading, h2, h3, h4, .title');
    if (headingEl) {
      const strong = document.createElement('strong');
      strong.textContent = headingEl.textContent.trim();
      columnContent.appendChild(strong);
      columnContent.appendChild(document.createElement('br'));
    }

    // Extract description
    const descEl = item.querySelector('.description, .desc, p:not(.cta)');
    if (descEl) {
      const p = document.createElement('p');
      p.textContent = descEl.textContent.trim();
      columnContent.appendChild(p);
    }

    // Extract CTA link
    const ctaLink = item.querySelector('a.cta, .cta a, a[href]:not([href="javascript:void(0)"])');
    if (ctaLink) {
      const href = ctaLink.getAttribute('href');
      const text = ctaLink.textContent.trim() || 'Explore Now';
      if (href && href !== 'javascript:void(0)') {
        const ctaP = document.createElement('p');
        const strongCta = document.createElement('strong');
        const a = document.createElement('a');
        a.href = href;
        a.textContent = text;
        strongCta.appendChild(a);
        ctaP.appendChild(strongCta);
        columnContent.appendChild(ctaP);
      }
    }

    row.push(columnContent);
  });

  if (row.length > 0) {
    cells.push(row);
  }

  // Create block using WebImporter utility
  const block = WebImporter.Blocks.createBlock(document, { name: 'Columns-Promo', cells });

  // Replace original element with structured block table
  element.replaceWith(block);
}
