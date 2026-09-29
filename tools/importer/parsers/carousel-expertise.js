/* eslint-disable */
/* global WebImporter */

/**
 * Parser for carousel-expertise block
 *
 * Source: https://www.asianpaints.com/painting-contractors.html
 * Base Block: carousel
 *
 * Block Structure:
 * - Each row: [expertise image, content with heading + description + list]
 *
 * Source HTML Pattern:
 * <div class="multicarousel">
 *   <div class="carousel-section">
 *     <div class="carousel-image"><img src="..."></div>
 *     <div class="carousel-content">
 *       <h2>Emulsions</h2>
 *       <p>Description...</p>
 *       <ul><li>Feature 1</li></ul>
 *     </div>
 *   </div>
 * </div>
 *
 * Generated: 2026-01-30
 */
export default function parse(element, { document }) {
  // Find all expertise slides - look for sections with image and content
  const slides = element.querySelectorAll('[class*="carousel-section"], [class*="slick-slide"]');

  const cells = [];

  slides.forEach(slide => {
    // Extract image
    const imageContainer = slide.querySelector('.carousel-image, [class*="image"]');
    const image = imageContainer ? imageContainer.querySelector('img') : slide.querySelector('img');

    // Extract content elements
    const heading = slide.querySelector('h2, h3, [class*="title"]');
    const description = slide.querySelector('p, [class*="desc"]');
    const list = slide.querySelector('ul');

    if (image || heading) {
      const imageCell = image ? image.cloneNode(true) : '';

      const contentCell = [];

      // Add heading
      if (heading) {
        const h2 = document.createElement('h2');
        h2.textContent = heading.textContent.trim();
        contentCell.push(h2);
      }

      // Add description
      if (description) {
        contentCell.push(description.cloneNode(true));
      }

      // Add list
      if (list) {
        contentCell.push(list.cloneNode(true));
      }

      cells.push([imageCell, contentCell]);
    }
  });

  // Create block
  const block = WebImporter.Blocks.createBlock(document, { name: 'Carousel-Expertise', cells });
  element.replaceWith(block);
}
