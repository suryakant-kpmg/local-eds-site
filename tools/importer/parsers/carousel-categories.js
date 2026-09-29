/* eslint-disable */
/* global WebImporter */

/**
 * Parser for carousel-categories block
 * 
 * Source: https://www.asianpaints.com/services/interior-design-solutions.html
 * Base Block: carousel
 * 
 * Block Structure:
 * - Each row: [image cell, category name cell]
 * 
 * Source HTML Pattern:
 * <div class="tabswithimagecarousel">
 *   <div class="TabsWithImageCarousel-left">
 *     <div class="title-parent">
 *       <div class="title">Categories</div>
 *       <div class="title text-gradient-royale-1">We Offer</div>
 *     </div>
 *     <ul class="TabsWithImageCarousel-left--tabs">
 *       <li class="TabsWithImageCarousel-left--item">Furniture</li>
 *       <li class="TabsWithImageCarousel-left--item">Lights</li>
 *     </ul>
 *   </div>
 *   <div class="TabsWithImageCarousel-right">
 *     <div class="tab-pane">
 *       <ul class="slider">
 *         <li class="slick-slide">
 *           <picture><img src="..." alt="Category"></picture>
 *         </li>
 *       </ul>
 *     </div>
 *   </div>
 * </div>
 * 
 * Generated: 2026-01-28
 */
export default function parse(element, { document }) {
  const cells = [];
  
  // Extract category tabs from left side
  const categoryTabs = element.querySelectorAll('.TabsWithImageCarousel-left--item, .nav-tab');
  
  // Extract images from right side carousel
  const carouselImages = element.querySelectorAll('.TabsWithImageCarousel-right img, .tab-pane img, .slick-slide img');
  
  // Build rows from category tabs
  categoryTabs.forEach((tab, index) => {
    const categoryName = tab.textContent.trim();
    
    // Try to match with corresponding image
    let image = null;
    if (carouselImages[index]) {
      image = carouselImages[index].cloneNode(true);
    }
    
    // Build row: [image cell, category name cell]
    const imageCell = image || '';
    const categoryCell = document.createTextNode(categoryName);
    
    cells.push([imageCell, categoryCell]);
  });
  
  // If no tabs found, try to extract from carousel slides
  if (cells.length === 0) {
    const slides = element.querySelectorAll('.slick-slide:not(.slick-cloned), .tab-pane li');
    slides.forEach(slide => {
      const image = slide.querySelector('img');
      const text = slide.querySelector('.title, .label, span') || image;
      
      if (image) {
        const imageCell = image.cloneNode(true);
        const textCell = text ? document.createTextNode(text.alt || text.textContent.trim()) : '';
        cells.push([imageCell, textCell]);
      }
    });
  }
  
  // Create block using WebImporter utility
  const block = WebImporter.Blocks.createBlock(document, { name: 'Carousel-Categories', cells });
  
  // Replace original element with structured block table
  element.replaceWith(block);
}
