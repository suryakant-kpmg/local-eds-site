/* eslint-disable */
/* global WebImporter */

/**
 * Parser for cards-services block
 * 
 * Source: https://www.asianpaints.com/services/interior-design-solutions.html
 * Base Block: cards
 * 
 * Block Structure:
 * - Each row: [image cell, content cell with title + description + CTA]
 * 
 * Source HTML Pattern:
 * <div class="textOverImageWrap__parent">
 *   <div class="textOverImageWrap--align-bottom">
 *     <img src="..." alt="Full Home Interiors">
 *     <strong>Full Home Interiors</strong>
 *     <p>Complete end-to-end home interior solutions</p>
 *     <a href="#">Know more</a>
 *   </div>
 * </div>
 * 
 * Generated: 2026-01-28
 */
export default function parse(element, { document }) {
  // Find all card items
  const cardItems = element.querySelectorAll('.textOverImageWrap--align-bottom, .col-lg-4, [class*="card-item"]');
  
  const cells = [];
  
  cardItems.forEach(card => {
    // Extract image
    const image = card.querySelector('img, picture img');
    
    // Extract title (strong or heading)
    const title = card.querySelector('strong, h3, h4, [class*="title"]');
    
    // Extract description
    const description = card.querySelector('p:not(.read-more-less), [class*="desc"]');
    
    // Extract CTA link
    const cta = card.querySelector('a.ctaText, a[href]');
    
    // Build row: [image cell, content cell]
    const imageCell = image ? image.cloneNode(true) : '';
    
    const contentCell = [];
    if (title) contentCell.push(title.cloneNode(true));
    if (description) contentCell.push(description.cloneNode(true));
    if (cta) contentCell.push(cta.cloneNode(true));
    
    if (imageCell || contentCell.length > 0) {
      cells.push([imageCell, contentCell]);
    }
  });
  
  // Create block using WebImporter utility
  const block = WebImporter.Blocks.createBlock(document, { name: 'Cards-Services', cells });
  
  // Replace original element with structured block table
  element.replaceWith(block);
}
