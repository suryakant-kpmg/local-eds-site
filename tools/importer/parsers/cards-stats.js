/* eslint-disable */
/* global WebImporter */

/**
 * Parser for cards-stats block
 *
 * Source: https://www.asianpaints.com/painting-contractors.html
 * Base Block: cards
 *
 * Block Structure:
 * - Single row with all stat cells: [stat1, stat2, stat3, stat4]
 * - Each stat: number + description
 *
 * Source HTML Pattern:
 * <div class="datadetails">
 *   <div class="data-parent-container">
 *     <div class="content-wrapper">
 *       <p class="title">170K</p>
 *       <p class="sub-title">Number of customers serviced till date.</p>
 *     </div>
 *     ...
 *   </div>
 * </div>
 *
 * Generated: 2026-01-30
 */
export default function parse(element, { document }) {
  // Find all stat items
  const statItems = element.querySelectorAll('.content-wrapper');

  const cells = [];
  const row = [];

  statItems.forEach(item => {
    // Extract number/title
    const titleEl = item.querySelector('.title, [class*="title"]');
    // Extract description
    const subtitleEl = item.querySelector('.sub-title, [class*="sub-title"]');

    if (titleEl) {
      const cellContent = [];

      // Create strong element for the stat number
      const strong = document.createElement('strong');
      strong.textContent = titleEl.textContent.trim();
      cellContent.push(strong);

      // Add description
      if (subtitleEl) {
        cellContent.push(subtitleEl.cloneNode(true));
      }

      row.push(cellContent);
    }
  });

  if (row.length > 0) {
    cells.push(row);
  }

  // Create block
  const block = WebImporter.Blocks.createBlock(document, { name: 'Cards-Stats', cells });
  element.replaceWith(block);
}
