/* eslint-disable */
/* global WebImporter */

/**
 * Parser for hero-services block
 * 
 * Source: https://www.asianpaints.com/services/interior-design-solutions.html
 * Base Block: hero
 * 
 * Block Structure:
 * - Row 1: Background image (optional)
 * - Row 2: Content (heading, description, CTAs)
 * 
 * Source HTML Pattern:
 * <div class="bannerImgWithLeftTextComp">
 *   <div class="banner-text-area">
 *     <h1>One Place For Every Space</h1>
 *     <p>For all your home decor...</p>
 *     <a href="#">Book Free Consultation</a>
 *   </div>
 * </div>
 * 
 * Generated: 2026-01-28
 */
export default function parse(element, { document }) {
  // Extract heading from banner text area
  const heading = element.querySelector('h1, h2, .bannerTextDesc h1, .bannerTextDesc h2, [class*="title"]');
  
  // Extract description paragraph
  const description = element.querySelector('p, .bannerTextDesc p, [class*="desc"]');
  
  // Extract CTA links
  const ctaLinks = Array.from(element.querySelectorAll('a.ctaText, a.trackCTA, .banner-text-area a, a[href]'));
  
  // Check for background image
  const bgImage = element.querySelector('img, picture img, [class*="banner"] img');
  
  // Build cells array
  const cells = [];
  
  // Row 1: Background image (optional)
  if (bgImage) {
    cells.push([bgImage.cloneNode(true)]);
  }
  
  // Row 2: Content cell with heading, description, and CTAs
  const contentCell = [];
  if (heading) contentCell.push(heading.cloneNode(true));
  if (description) contentCell.push(description.cloneNode(true));
  ctaLinks.forEach(cta => contentCell.push(cta.cloneNode(true)));
  
  if (contentCell.length > 0) {
    cells.push(contentCell);
  }
  
  // Create block using WebImporter utility
  const block = WebImporter.Blocks.createBlock(document, { name: 'Hero-Services', cells });
  
  // Replace original element with structured block table
  element.replaceWith(block);
}
