/* eslint-disable */
/* global WebImporter */

/**
 * Parser for cards-benefits block
 * 
 * Source: https://www.asianpaints.com/services/interior-design-solutions.html
 * Base Block: cards
 * 
 * Block Structure:
 * - Each row: [image cell, content cell with title + description]
 * 
 * Source HTML Pattern:
 * <div class="whychooseus">
 *   <div class="whychooseus-wraper">
 *     <h2 class="whychooseus-title">Why Choose Our Stores</h2>
 *     <div class="whychooseus-content-wraper">
 *       <div class="whychooseus-content">
 *         <picture class="img-wraper"><img src="..." alt="Limitless range"></picture>
 *         <div class="whychooseus-text-wraper">
 *           <h2 class="whychooseus-text-wraper-title">Limitless range</h2>
 *           <p class="whychooseus-text-wraper-desc">Description text...</p>
 *         </div>
 *       </div>
 *     </div>
 *   </div>
 * </div>
 * 
 * Generated: 2026-01-28
 */
export default function parse(element, { document }) {
  // Find all benefit items
  const benefitItems = element.querySelectorAll('.whychooseus-content');
  
  const cells = [];
  
  benefitItems.forEach(item => {
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
    if (description) contentCell.push(description.cloneNode(true));
    
    if (imageCell || contentCell.length > 0) {
      cells.push([imageCell, contentCell]);
    }
  });
  
  // Create block using WebImporter utility
  const block = WebImporter.Blocks.createBlock(document, { name: 'Cards-Benefits', cells });
  
  // Replace original element with structured block table
  element.replaceWith(block);
}
