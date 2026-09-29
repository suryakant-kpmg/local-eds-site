/* eslint-disable */
/* global WebImporter */

/**
 * Parser for cards-features block
 *
 * Source: https://www.asianpaints.com/painting-contractors.html
 * Base Block: cards
 *
 * Block Structure:
 * - Each row: [image cell, content cell with title + description]
 *
 * Source HTML Pattern:
 * <div class="whychooseus">
 *   <div class="whychooseus-wraper">
 *     <h2 class="whychooseus-title">Why Choose Us?</h2>
 *     <div class="whychooseus-content">
 *       <picture><img src="..." alt="Skilled Contractors"></picture>
 *       <div class="whychooseus-text-wraper">
 *         <h2 class="whychooseus-text-wraper-title">Skilled Contractors</h2>
 *         <p class="whychooseus-text-wraper-desc">Description...</p>
 *       </div>
 *     </div>
 *   </div>
 * </div>
 *
 * Generated: 2026-01-30
 */
export default function parse(element, { document }) {
  // Find all feature items
  const featureItems = element.querySelectorAll('.whychooseus-content');

  const cells = [];

  featureItems.forEach(item => {
    // Extract image
    const image = item.querySelector('picture img, img');

    // Extract title
    const title = item.querySelector('.whychooseus-text-wraper-title, h2, [class*="title"]');

    // Extract description
    const description = item.querySelector('.whychooseus-text-wraper-desc, p, [class*="desc"]');

    // Build row: [image cell, content cell]
    const imageCell = image ? image.cloneNode(true) : '';

    const contentCell = [];
    if (title) {
      const strong = document.createElement('strong');
      strong.textContent = title.textContent.trim();
      contentCell.push(strong);
    }
    if (description) {
      contentCell.push(description.cloneNode(true));
    }

    if (imageCell || contentCell.length > 0) {
      cells.push([imageCell, contentCell]);
    }
  });

  // Create block
  const block = WebImporter.Blocks.createBlock(document, { name: 'Cards-Features', cells });
  element.replaceWith(block);
}
