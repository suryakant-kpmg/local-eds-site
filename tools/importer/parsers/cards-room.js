/* eslint-disable */
/* global WebImporter */

/**
 * Parser for cards-room block
 * 
 * Source: https://www.asianpaints.com/services/interior-design-solutions.html
 * Base Block: cards
 * 
 * Block Structure:
 * - Each row: [image cell, content cell with room name + CTA]
 * 
 * Source HTML Pattern:
 * <div class="trendingItem">
 *   <img src="..." alt="Kitchen">
 *   <h3>Modular Kitchen</h3>
 *   <p>Description...</p>
 *   <a href="#">EXPLORE NOW</a>
 * </div>
 * 
 * Generated: 2026-01-28
 */
export default function parse(element, { document }) {
  // Find all room card items
  const roomItems = element.querySelectorAll('.trendingItem, [class*="room-item"], [class*="card"]');
  
  const cells = [];
  
  roomItems.forEach(item => {
    // Extract image
    const image = item.querySelector('img, picture img, .cmp-image img');
    
    // Extract room name (heading)
    const roomName = item.querySelector('h3, h4, strong, [class*="title"]');
    
    // Extract CTA link
    const cta = item.querySelector('a.ctaText, a[href*="explore"], a[href]');
    
    // Build row: [image cell, content cell]
    const imageCell = image ? image.cloneNode(true) : '';
    
    const contentCell = [];
    if (roomName) contentCell.push(roomName.cloneNode(true));
    if (cta) contentCell.push(cta.cloneNode(true));
    
    if (imageCell || contentCell.length > 0) {
      cells.push([imageCell, contentCell]);
    }
  });
  
  // Create block using WebImporter utility
  const block = WebImporter.Blocks.createBlock(document, { name: 'Cards-Room', cells });
  
  // Replace original element with structured block table
  element.replaceWith(block);
}
